import { NextResponse } from "next/server";
import { activeMemberErrorResponse, requireActiveMemberApi } from "@/lib/member-access";
import { prisma } from "@/lib/prisma";
import { getMemberRankData } from "@/lib/services/rank-rewards";

export const dynamic = "force-dynamic";

export async function GET() {
  const access = await requireActiveMemberApi();
  if (!access.ok) return activeMemberErrorResponse(access);

  const data = await getMemberRankData(prisma, access.memberId);
  return NextResponse.json(data);
}
