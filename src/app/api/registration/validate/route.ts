import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSponsorRegistrationError } from "@/lib/registration";
import { getPlacementSlots, isPlacementSlot, validatePlacementSelection } from "@/lib/services/placement";

export const dynamic = "force-dynamic";

const schema = z.discriminatedUnion("mode", [
  z.object({
    mode: z.literal("sponsor"),
    memberId: z.string().trim().min(5).max(20),
  }),
  z.object({
    mode: z.literal("placement"),
    sponsorMemberId: z.string().trim().min(5).max(20),
    memberId: z.string().trim().min(5).max(20),
  }),
]);

function memberPreview(member: {
  memberId: string;
  fullName: string;
  status: string;
  profileImage: string | null;
}) {
  return {
    memberId: member.memberId,
    fullName: member.fullName,
    status: member.status,
    profileImage: member.profileImage,
  };
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "INVALID_REQUEST" }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "INVALID_REQUEST" }, { status: 400 });
  }

  const payload = parsed.data;
  const memberId = payload.memberId.trim().toUpperCase();

  if (payload.mode === "sponsor") {
    const member = await prisma.member.findUnique({
      where: { memberId },
      select: { id: true, memberId: true, fullName: true, status: true, profileImage: true },
    });
    const error = getSponsorRegistrationError(member);
    if (error) return NextResponse.json({ error }, { status: 400 });
    if (!member) return NextResponse.json({ error: "SPONSOR_NOT_FOUND" }, { status: 400 });
    return NextResponse.json({ member: memberPreview(member) });
  }

  const sponsorId = payload.sponsorMemberId.trim().toUpperCase();
  const sponsor = await prisma.member.findUnique({
    where: { memberId: sponsorId },
    select: { id: true, status: true },
  });
  const sponsorError = getSponsorRegistrationError(sponsor);
  if (sponsorError) return NextResponse.json({ error: sponsorError }, { status: 400 });
  if (!sponsor) return NextResponse.json({ error: "SPONSOR_NOT_FOUND" }, { status: 400 });

  const placement = await prisma.member.findUnique({
    where: { memberId },
    select: { id: true, memberId: true, fullName: true, status: true, profileImage: true },
  });
  if (!placement) {
    return NextResponse.json({ error: "PLACEMENT_NOT_FOUND" }, { status: 400 });
  }

  const result = await validatePlacementSelection(prisma, {
    sponsorId: sponsor.id,
    placementMemberId: placement.id,
    placementSlot: 1,
  });

  if (!result.ok && result.error !== "PLACEMENT_SLOT_UNAVAILABLE") {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  const slots = await getPlacementSlots(prisma, placement.id);
  return NextResponse.json({
    member: memberPreview(placement),
    slots,
    hasAvailableSlot: slots.some((slot) => !slot.occupied && isPlacementSlot(slot.slot)),
  });
}
