import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { buildCloneMemberData, canAccessAccount } from "@/lib/account-ownership";
import { writeAuditLog } from "@/lib/audit";
import { allocateMemberId, normalizeMemberId } from "@/lib/member-id";
import { prisma } from "@/lib/prisma";
import { getSponsorRegistrationError } from "@/lib/registration";
import { isUploadedImageUrl } from "@/lib/uploads";
import {
  isPlacementConflictError,
  isPlacementSlot,
  validatePlacementSelection,
  type PlacementSlotInfo,
} from "@/lib/services/placement";

export const dynamic = "force-dynamic";

const schema = z.object({
  fullName: z.string().trim().min(2).max(120),
  profileImage: z.string().trim().max(2048).nullable().optional(),
  sponsorMemberId: z.string().trim().min(5).max(20),
  placementMemberId: z.string().trim().min(5).max(20),
  placementSlot: z.number().int(),
});

const ERROR_CODES = [
  "ORIGINAL_INACTIVE",
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
  "INVALID_IMAGE",
] as const;

function fail(code: string, status: number, slots?: PlacementSlotInfo[] | null) {
  return NextResponse.json({ error: code, slots: slots ?? null }, { status });
}

export async function POST(request: Request) {
  const session = await auth();
  const user = session?.user;
  if (!user?.id) {
    return NextResponse.json({ error: "LOGIN_REQUIRED" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail("INVALID_REQUEST", 400);
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success || !isPlacementSlot(parsed.data.placementSlot)) {
    return fail("INVALID_REQUEST", 400);
  }

  const { fullName, profileImage } = parsed.data;
  if (profileImage && !isUploadedImageUrl(profileImage)) return fail("INVALID_IMAGE", 400);

  const sponsorMemberId = normalizeMemberId(parsed.data.sponsorMemberId);
  const placementMemberId = normalizeMemberId(parsed.data.placementMemberId);
  const placementSlot = parsed.data.placementSlot;
  const principalId = user.principalId ?? user.id;

  try {
    const clone = await prisma.$transaction(async (tx) => {
      const original = await tx.member.findUnique({
        where: { id: user.id },
        select: {
          id: true,
          fullName: true,
          email: true,
          phone: true,
          passwordHash: true,
          tPinHash: true,
          tPinUpdatedAt: true,
          status: true,
        },
      });
      if (!original || !(await canAccessAccount(tx, principalId, original.id))) {
        throw new Error("ACCOUNT_NOT_OWNED");
      }
      if (original.status !== "ACTIVE") throw new Error("ORIGINAL_INACTIVE");

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
        data: buildCloneMemberData({
          source: original,
          memberId,
          fullName,
          profileImage,
          sponsorId: sponsor!.id,
          placementId: placement.id,
          placementSlot,
        }),
        select: { id: true, memberId: true, fullName: true },
      });

      await tx.wallet.create({ data: { memberId: created.id } });

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

      const addresses = await tx.address.findMany({
        where: { memberId: original.id },
        select: {
          label: true,
          fullName: true,
          phone: true,
          street: true,
          city: true,
          thana: true,
          district: true,
          postalCode: true,
          country: true,
          isDefault: true,
        },
      });
      if (addresses.length > 0) {
        await tx.address.createMany({
          data: addresses.map((address) => ({ ...address, memberId: created.id, fullName })),
        });
      }

      await tx.accountOwnership.create({
        data: {
          id: `clone_${created.id}`,
          ownerId: principalId,
          accountId: created.id,
          label: "Clone account",
        },
      });

      return created;
    });

    await writeAuditLog({
      actorId: principalId,
      actorRole: user.role,
      action: "CLONE_ACCOUNT_CREATED",
      entityType: "Member",
      entityId: clone.id,
      after: {
        cloneMemberId: clone.memberId,
        fullName,
        profileImage: profileImage ?? null,
        sponsorMemberId,
        placementMemberId,
        placementSlot,
      },
    });

    return NextResponse.json({ member: clone }, { status: 201 });
  } catch (cause) {
    if (cause instanceof Error) {
      const code = cause.message as (typeof ERROR_CODES)[number] | "ACCOUNT_NOT_OWNED";
      if (code === "ACCOUNT_NOT_OWNED") return fail(code, 403);
      if (ERROR_CODES.includes(code)) return fail(code, 400);
    }
    if (isPlacementConflictError(cause)) return fail("PLACEMENT_SLOT_TAKEN", 409);
    if (
      typeof cause === "object" &&
      cause !== null &&
      "code" in cause &&
      String(cause.code) === "P2002"
    ) {
      return fail("ACCOUNT_EXISTS", 409);
    }
    console.error("Unable to create clone account", cause);
    return fail("CLONE_FAILED", 500);
  }
}
