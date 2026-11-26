import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getGenealogyView } from "@/lib/services/team-performance";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "LOGIN_REQUIRED" }, { status: 401 });
  }

  const memberId = new URL(request.url).searchParams.get("memberId")?.trim().toUpperCase();
  const target = memberId
    ? await prisma.member.findUnique({ where: { memberId }, select: { id: true } })
    : await prisma.member.findUnique({ where: { id: session.user.id }, select: { id: true } });
  if (!target) {
    return NextResponse.json({ error: "MEMBER_NOT_FOUND" }, { status: 404 });
  }

  const view = await getGenealogyView(prisma, session.user.id, target.id);
  if (!view) {
    return NextResponse.json({ error: "MEMBER_OUTSIDE_TEAM" }, { status: 403 });
  }
  return NextResponse.json({ view });
}
