import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { writeAuditLog } from "@/lib/audit";
import { LedgerEntryType as LedgerType, WalletCategory as Category } from "@/generated/prisma/enums";
import { formatSP, spToPaisa } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import { notifyAdminAdjustment } from "@/lib/services/notification-events";
import {
  LedgerDirectionValues as Direction,
  adjustWalletField,
  makeKey,
  recordLedgerEntry,
} from "@/lib/services/ledger";

export const dynamic = "force-dynamic";

const schema = z.object({
  amount: z.string().trim().regex(/^\d+(\.\d{1,2})?$/),
  note: z.string().trim().max(300).optional(),
});

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
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
    return NextResponse.json({ error: "Please check the amount" }, { status: 400 });
  }

  const { amount } = parsed.data;
  const note = parsed.data.note?.trim() || "Admin top up";
  const paisa = spToPaisa(amount);
  if (paisa <= 0n) {
    return NextResponse.json({ error: "Please check the amount" }, { status: 400 });
  }

  const existing = await prisma.member.findUnique({
    where: { id },
    select: { memberId: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "MEMBER_NOT_FOUND" }, { status: 404 });
  }

  let balanceAfterPaisa: bigint;
  try {
    balanceAfterPaisa = await prisma.$transaction(async (tx) => {
      const { walletId, balanceAfterPaisa: balance } = await adjustWalletField(
        tx,
        id,
        "availablePaisa",
        paisa,
        Direction.CREDIT,
      );
      await recordLedgerEntry(tx, {
        walletId,
        memberId: id,
        category: Category.AVAILABLE,
        direction: Direction.CREDIT,
        amountPaisa: paisa,
        balanceAfterPaisa: balance,
        type: LedgerType.ADMIN_ADJUSTMENT,
        idempotencyKey: makeKey("admin-top-up", id, randomUUID()),
        description: note,
        createdBy: session.user.id,
      });
      return balance;
    });
  } catch {
    return NextResponse.json({ error: "TOP_UP_FAILED" }, { status: 500 });
  }

  await notifyAdminAdjustment(id, paisa);

  await writeAuditLog({
    actorId: session.user.id,
    actorRole: "ADMIN",
    action: "MEMBER_TOP_UP",
    entityType: "Member",
    entityId: id,
    after: { amount, balance: formatSP(balanceAfterPaisa), note },
  });

  return NextResponse.json({ memberId: existing.memberId, balance: formatSP(balanceAfterPaisa) });
}
