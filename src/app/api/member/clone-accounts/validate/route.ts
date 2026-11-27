import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { normalizeMemberId } from "@/lib/member-id";
import { prisma } from "@/lib/prisma";
import { getSponsorRegistrationError } from "@/lib/registration";
import { getPlacementSlots, isInPlacementSubtree } from "@/lib/services/placement";

export const dynamic = "force-dynamic";

const schema = z.object({
  sponsorMemberId: z.string().trim().min(5).max(20),
  placementMemberId: z.string().trim().min(5).max(20),
});

function preview(member: {
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
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "LOGIN_REQUIRED" }, { status: 401 });
  }

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

  const sponsorMemberId = normalizeMemberId(parsed.data.sponsorMemberId);
  const placementMemberId = normalizeMemberId(parsed.data.placementMemberId);

  const sponsor = await prisma.member.findUnique({
    where: { memberId: sponsorMemberId },
    select: { id: true, memberId: true, fullName: true, status: true, role: true, profileImage: true },
  });
  if (!sponsor) {
    return NextResponse.json({ error: "SPONSOR_NOT_FOUND" }, { status: 400 });
  }

  const placement = await prisma.member.findUnique({
    where: { memberId: placementMemberId },
    select: { id: true, memberId: true, fullName: true, status: true, role: true, profileImage: true },
  });
  if (!placement) {
    return NextResponse.json({ error: "PLACEMENT_NOT_FOUND" }, { status: 400 });
  }

  // Return previews even when a member is inactive so the UI can show the avatar,
  // verified tick, and inactive state. The create endpoint remains authoritative.
  const errors: string[] = [];
  const sponsorError = getSponsorRegistrationError(sponsor);
  if (sponsorError) errors.push(sponsorError);
  if (placement.role === "ADMIN") errors.push("PLACEMENT_NOT_ELIGIBLE");
  else if (placement.status !== "ACTIVE") errors.push("PLACEMENT_INACTIVE");
  if (!(await isInPlacementSubtree(prisma, sponsor.id, placement.id))) {
    errors.push("PLACEMENT_OUTSIDE_SPONSOR_NETWORK");
  }

  const slots = await getPlacementSlots(prisma, placement.id);
  return NextResponse.json({
    sponsor: preview(sponsor),
    placement: preview(placement),
    slots,
    errors,
  });
}
