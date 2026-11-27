import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { writeAuditLog } from "@/lib/audit";
import { allocateMemberId, normalizeMemberId } from "@/lib/member-id";
import { prisma } from "@/lib/prisma";
import { getSponsorRegistrationError } from "@/lib/registration";
import {
  getPlacementSlots,
  isPlacementConflictError,
  isPlacementSlot,
  validatePlacementSelection,
  type PlacementSlotInfo,
} from "@/lib/services/placement";
import { notifyWelcome } from "@/lib/services/notification-events";
import { verifySignupInvite } from "@/lib/signup-invite";
import { isUploadedImageUrl } from "@/lib/uploads";

export const dynamic = "force-dynamic";

const registrationSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  phone: z.string().trim().min(8).max(30),
  email: z.string().trim().email(),
  password: z.string().min(8).max(128),
  profileImage: z.string().nullable().optional(),
  sponsorMemberId: z.string().trim().min(5).max(20),
  placementMemberId: z.string().trim().min(5).max(20),
  placementSlot: z.number().int(),
  invite: z.string().max(2048).nullable().optional(),
});

const REGISTRATION_ERRORS = [
  "SPONSOR_NOT_FOUND",
  "SPONSOR_NOT_ELIGIBLE",
  "SPONSOR_INACTIVE",
  "PLACEMENT_NOT_FOUND",
  "PLACEMENT_NOT_ELIGIBLE",
  "PLACEMENT_INACTIVE",
  "PLACEMENT_OUTSIDE_SPONSOR_NETWORK",
  "PLACEMENT_SLOT_INVALID",
  "PLACEMENT_SLOT_UNAVAILABLE",
  "PLACEMENT_CYCLE",
] as const;

type RegistrationError = (typeof REGISTRATION_ERRORS)[number];
type SlotRefreshError = "PLACEMENT_SLOT_UNAVAILABLE" | "PLACEMENT_SLOT_TAKEN";

function fail(code: string, status: number, slots?: PlacementSlotInfo[] | null) {
  return NextResponse.json({ error: code, slots: slots ?? null }, { status });
}

function errorCode(cause: unknown): string {
  return typeof cause === "object" && cause !== null && "code" in cause
    ? String(cause.code)
    : "";
}

/**
 * Single-page registration. Everything is validated and committed in one
 * transaction; the new account starts INACTIVE and completes the same
 * activation purchase as a clone.
 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail("INVALID_REQUEST", 400);
  }

  const parsed = registrationSchema.safeParse(body);
  if (!parsed.success || !isPlacementSlot(parsed.data.placementSlot)) {
    return fail("INVALID_ACCOUNT", 400);
  }

  const {
    fullName,
    email,
    password,
    sponsorMemberId: rawSponsorId,
    placementMemberId: rawPlacementId,
    placementSlot,
  } = parsed.data;
  const phone = parsed.data.phone.trim();
  const normalizedEmail = email.toLowerCase().trim();
  const image = parsed.data.profileImage?.trim() ? parsed.data.profileImage.trim() : null;
  if (image && !isUploadedImageUrl(image)) return fail("INVALID_IMAGE", 400);

  const sponsorMemberId = normalizeMemberId(rawSponsorId);
  const placementMemberId = normalizeMemberId(rawPlacementId);
  const passwordHash = await bcrypt.hash(password, 12);

  if (parsed.data.invite) {
    const invite = verifySignupInvite(parsed.data.invite);
    if (!invite) return fail("INVITE_INVALID", 400);
    if (
      invite.sponsorMemberId !== sponsorMemberId ||
      invite.placementMemberId !== placementMemberId ||
      invite.placementSlot !== placementSlot
    ) {
      return fail("INVITE_MISMATCH", 400);
    }
  }

  try {
    const member = await prisma.$transaction(async (tx) => {
      const sponsor = await tx.member.findUnique({
        where: { memberId: sponsorMemberId },
        select: { id: true, status: true, role: true },
      });
      const sponsorError = getSponsorRegistrationError(sponsor);
      if (sponsorError) throw new Error(sponsorError);

      const placement = await tx.member.findUnique({
        where: { memberId: placementMemberId },
        select: { id: true },
      });
      if (!placement) throw new Error("PLACEMENT_NOT_FOUND");

      const selection = await validatePlacementSelection(tx, {
        sponsorId: sponsor!.id,
        placementMemberId: placement.id,
        placementSlot,
      });
      if (!selection.ok) throw new Error(selection.error);

      const memberId = await allocateMemberId(tx);
      const created = await tx.member.create({
        data: {
          memberId,
          fullName,
          email: normalizedEmail,
          phone,
          passwordHash,
          profileImage: image,
          role: "MEMBER",
          status: "INACTIVE",
          activationDate: null,
          sponsorId: sponsor!.id,
          placementParentId: placement.id,
          placementSlot,
        },
        select: { id: true, memberId: true, fullName: true, email: true, createdAt: true },
      });

      // No address is collected at signup. Active members add saved addresses
      // in profile settings or from the Buy Now address dialog.
      await tx.wallet.create({ data: { memberId: created.id } });
      await tx.accountOwnership.create({
        data: { id: `self_${created.id}`, ownerId: created.id, accountId: created.id },
      });

      const sponsorUplines = await tx.upline.findMany({
        where: { memberId: sponsor!.id },
        orderBy: { level: "asc" },
        select: { uplineId: true, level: true },
      });
      await tx.upline.createMany({
        data: [
          { memberId: created.id, uplineId: sponsor!.id, level: 1 },
          ...sponsorUplines
            .filter((row) => row.level < 3)
            .map((row) => ({
              memberId: created.id,
              uplineId: row.uplineId,
              level: row.level + 1,
            })),
        ],
        skipDuplicates: true,
      });

      return created;
    });

    try {
      await notifyWelcome(member.id, member.memberId);
    } catch (notificationError) {
      console.error("Unable to send welcome notification", notificationError);
    }

    await writeAuditLog({
      actorId: member.id,
      actorRole: "MEMBER",
      action: "MEMBER_REGISTERED",
      entityType: "Member",
      entityId: member.id,
      after: {
        memberId: member.memberId,
        sponsorMemberId,
        placementMemberId,
        placementSlot,
        status: "INACTIVE",
        registeredAt: member.createdAt.toISOString(),
      },
    });

    return NextResponse.json({ member }, { status: 201 });
  } catch (cause) {
    if (cause instanceof Error) {
      const code = cause.message as RegistrationError;
      if (REGISTRATION_ERRORS.includes(code)) {
        const slots =
          code === "PLACEMENT_SLOT_UNAVAILABLE"
            ? await loadPlacementSlots(placementMemberId, code)
            : null;
        return fail(code, 400, slots);
      }
    }

    if (isPlacementConflictError(cause)) {
      const slots = await loadPlacementSlots(placementMemberId, "PLACEMENT_SLOT_TAKEN");
      return fail("PLACEMENT_SLOT_TAKEN", 409, slots);
    }

    if (errorCode(cause) === "P2002") return fail("ACCOUNT_EXISTS", 409);

    console.error("Unable to register member", cause);
    return fail("REGISTRATION_FAILED", 500);
  }
}

/** Refreshes the slot row so the form can recover from a stale availability check. */
async function loadPlacementSlots(
  placementMemberId: string,
  code: SlotRefreshError,
): Promise<PlacementSlotInfo[] | null> {
  if (code !== "PLACEMENT_SLOT_UNAVAILABLE" && code !== "PLACEMENT_SLOT_TAKEN") return null;

  const placement = await prisma.member.findUnique({
    where: { memberId: placementMemberId },
    select: { id: true },
  });
  return placement ? getPlacementSlots(prisma, placement.id) : null;
}
