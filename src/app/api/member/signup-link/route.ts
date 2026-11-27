import { NextResponse } from "next/server";
import { z } from "zod";
import { activeMemberErrorResponse, requireActiveMemberApi } from "@/lib/member-access";
import { normalizeMemberId } from "@/lib/member-id";
import { prisma } from "@/lib/prisma";
import { getSponsorRegistrationError } from "@/lib/registration";
import { isPlacementSlot, validatePlacementSelection } from "@/lib/services/placement";
import { createSignupInvite } from "@/lib/signup-invite";

export const dynamic = "force-dynamic";

const schema = z.object({
  sponsorMemberId: z.string().trim().min(5).max(20),
  placementMemberId: z.string().trim().min(5).max(20),
  placementSlot: z.number().int(),
});

export async function POST(request: Request) {
  const access = await requireActiveMemberApi();
  if (!access.ok) return activeMemberErrorResponse(access);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "INVALID_REQUEST" }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success || !isPlacementSlot(parsed.data.placementSlot)) {
    return NextResponse.json({ error: "INVALID_REQUEST" }, { status: 400 });
  }

  const sponsorMemberId = normalizeMemberId(parsed.data.sponsorMemberId);
  const placementMemberId = normalizeMemberId(parsed.data.placementMemberId);

  const [sponsor, placement] = await Promise.all([
    prisma.member.findUnique({
      where: { memberId: sponsorMemberId },
      select: { id: true, memberId: true, fullName: true, status: true, role: true },
    }),
    prisma.member.findUnique({
      where: { memberId: placementMemberId, role: "MEMBER" },
      select: { id: true, memberId: true, fullName: true },
    }),
  ]);

  const sponsorError = getSponsorRegistrationError(sponsor);
  if (sponsorError) return NextResponse.json({ error: sponsorError }, { status: 400 });
  if (!placement) {
    return NextResponse.json({ error: "PLACEMENT_NOT_FOUND" }, { status: 400 });
  }

  const selection = await validatePlacementSelection(prisma, {
    sponsorId: sponsor!.id,
    placementMemberId: placement.id,
    placementSlot: parsed.data.placementSlot,
  });
  if (!selection.ok) {
    return NextResponse.json({ error: selection.error }, { status: 400 });
  }

  const payload = { sponsorMemberId, placementMemberId, placementSlot: parsed.data.placementSlot };
  return NextResponse.json({
    token: createSignupInvite(payload),
    ...payload,
    sponsor: { memberId: sponsor!.memberId, fullName: sponsor!.fullName },
    placement: { memberId: placement.memberId, fullName: placement.fullName },
  });
}
