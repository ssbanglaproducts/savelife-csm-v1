import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { writeAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { evaluateMemberRanks } from "@/lib/services/rank-rewards";

export const dynamic = "force-dynamic";

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "LOGIN_REQUIRED" }, { status: 401 });
  }
  if (session.user.role !== "MEMBER") return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

  try {
    const created = await evaluateMemberRanks(prisma, session.user.id);
    await writeAuditLog({
      actorId: session.user.id,
      actorRole: "MEMBER",
      action: "RANK_QUALIFICATION_REFRESHED",
      entityType: "Member",
      entityId: session.user.id,
      after: { createdCount: created.length },
    });
    return NextResponse.json({ ok: true, createdCount: created.length });
  } catch (error) {
    console.error("Rank qualification refresh failed", error);
    return NextResponse.json({ error: "RANK_REFRESH_FAILED" }, { status: 500 });
  }
}
