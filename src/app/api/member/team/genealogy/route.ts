import { NextResponse } from "next/server";
import { activeMemberErrorResponse, requireActiveMemberApi } from "@/lib/member-access";
import { prisma } from "@/lib/prisma";
import { getGenealogyView } from "@/lib/services/team-performance";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const access = await requireActiveMemberApi();
  if (!access.ok) return activeMemberErrorResponse(access);

  const memberId = new URL(request.url).searchParams.get("memberId")?.trim().toUpperCase();
  const target = memberId
    ? await prisma.member.findUnique({
        where: { memberId, role: "MEMBER" },
        select: { id: true },
      })
    : await prisma.member.findUnique({
        where: { id: access.memberId, role: "MEMBER" },
        select: { id: true },
      });
  if (!target) {
    return NextResponse.json({ error: "MEMBER_NOT_FOUND" }, { status: 404 });
  }

  const view = await getGenealogyView(prisma, access.memberId, target.id);
  if (!view) {
    return NextResponse.json({ error: "MEMBER_OUTSIDE_TEAM" }, { status: 403 });
  }
  return NextResponse.json({ view });
}
