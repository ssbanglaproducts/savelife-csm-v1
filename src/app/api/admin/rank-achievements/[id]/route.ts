import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminApiSession } from "@/lib/admin-access";
import { prisma } from "@/lib/prisma";
import { markPhysicalRewardCollected } from "@/lib/services/rank-rewards";

export const dynamic = "force-dynamic";

const schema = z.object({
  action: z.literal("MARK_COLLECTED"),
  note: z.string().trim().max(500).optional().nullable(),
});

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const session = await requireAdminApiSession("ranks.manage");
  if (!session) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  const { id } = await context.params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  try {
    const achievement = await markPhysicalRewardCollected(
      prisma,
      id,
      session.user.id,
      parsed.data.note ?? null,
      session.user.role,
    );
    if (!achievement) {
      return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    }
    // The client refreshes the server-rendered table; avoid sending BigInt
    // reward snapshots through JSON.
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Physical rank reward collection failed", error);
    return NextResponse.json({ error: "COLLECTION_FAILED" }, { status: 500 });
  }
}
