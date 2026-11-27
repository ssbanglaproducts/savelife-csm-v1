import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  getIndividualPerformance,
  serializeIndividualPerformance,
} from "@/lib/services/team-performance";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "LOGIN_REQUIRED" }, { status: 401 });
  }
  if (session.user.role !== "MEMBER") return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

  const memberId = new URL(request.url).searchParams.get("memberId")?.trim().toUpperCase();
  if (!memberId) {
    return NextResponse.json({ error: "INVALID_REQUEST" }, { status: 400 });
  }

  const target = await prisma.member.findUnique({
    where: { memberId, role: "MEMBER" },
    select: { id: true },
  });
  if (!target) {
    return NextResponse.json({ error: "MEMBER_NOT_FOUND" }, { status: 404 });
  }

  const performance = await getIndividualPerformance(
    prisma,
    session.user.id,
    target.id,
    new Date(),
  );
  if (!performance) {
    return NextResponse.json({ error: "MEMBER_OUTSIDE_TEAM" }, { status: 403 });
  }
  return NextResponse.json({ performance: serializeIndividualPerformance(performance) });
}
