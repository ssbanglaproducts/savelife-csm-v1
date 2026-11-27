import { NextResponse } from "next/server";
import { activeMemberErrorResponse, requireActiveMemberApi } from "@/lib/member-access";
import { prisma } from "@/lib/prisma";
import { getMemberSalaryData } from "@/lib/services/member-salary";

export const dynamic = "force-dynamic";

export async function GET() {
  const access = await requireActiveMemberApi();
  if (!access.ok) return activeMemberErrorResponse(access);

  const data = await getMemberSalaryData(prisma, access.memberId);
  return NextResponse.json(data);
}
