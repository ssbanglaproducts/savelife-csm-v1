import { NextResponse } from "next/server";
import { writeAuditLog } from "@/lib/audit";
import { activeMemberErrorResponse, requireActiveMemberApi } from "@/lib/member-access";
import { prisma } from "@/lib/prisma";
import { evaluateMemberRanks } from "@/lib/services/rank-rewards";

export const dynamic = "force-dynamic";

export async function POST() {
  const access = await requireActiveMemberApi();
  if (!access.ok) return activeMemberErrorResponse(access);

  try {
    const created = await evaluateMemberRanks(prisma, access.memberId);
    await writeAuditLog({
      actorId: access.memberId,
      actorRole: "MEMBER",
      action: "RANK_QUALIFICATION_REFRESHED",
      entityType: "Member",
      entityId: access.memberId,
      after: { createdCount: created.length },
    });
    return NextResponse.json({ ok: true, createdCount: created.length });
  } catch (error) {
    console.error("Rank qualification refresh failed", error);
    return NextResponse.json({ error: "RANK_REFRESH_FAILED" }, { status: 500 });
  }
}
