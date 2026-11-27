import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminApiSession } from "@/lib/admin-access";
import { writeAuditLog } from "@/lib/audit";
import { LedgerEntryType as LedgerType, WalletCategory as Category } from "@/generated/prisma/enums";
import { formatSP, spToPaisa } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import { notifyAdminAdjustment } from "@/lib/services/notification-events";
import {
  LedgerDirectionValues as Direction,
  adjustWalletField,
  hasLedgerEntry,
  isUniqueViolation,
  makeKey,
  recordLedgerEntry,
} from "@/lib/services/ledger";

export const dynamic = "force-dynamic";

const schema = z.object({
  amount: z.string().trim().regex(/^\d+(\.\d{1,2})?$/),
  note: z.string().trim().max(300).optional(),
  idempotencyKey: z.string().trim().min(1).max(200),
});

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await requireAdminApiSession("members.manage");
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
    return NextResponse.json({ error: "Please check the amount" }, { status: 400 });
  }

  const { amount, idempotencyKey } = parsed.data;
  const note = parsed.data.note?.trim() || "Admin top up";
  const paisa = spToPaisa(amount);
  if (paisa <= 0n) {
    return NextResponse.json({ error: "Please check the amount" }, { status: 400 });
  }

  const existing = await prisma.member.findFirst({
    where: { id, role: "MEMBER" },
    select: { memberId: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "MEMBER_NOT_FOUND" }, { status: 404 });
  }

  // Namespaced per member so the same client key can be reused for a different
  // account without blocking a legitimate top-up.
  const ledgerKey = makeKey("admin-top-up", id, idempotencyKey);
  let balanceAfterPaisa: bigint | null;
  try {
    balanceAfterPaisa = await prisma.$transaction(async (tx) => {
      if (await hasLedgerEntry(tx, ledgerKey)) return null;

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
        idempotencyKey: ledgerKey,
        description: note,
        createdBy: session.user.id,
      });
      return balance;
    });
  } catch (error) {
    if (isUniqueViolation(error) && (await hasLedgerEntry(prisma, ledgerKey))) {
      return NextResponse.json({ error: "DUPLICATE" }, { status: 409 });
    }
    console.error("Admin member top-up failed", error);
    return NextResponse.json({ error: "TOP_UP_FAILED" }, { status: 500 });
  }

  if (balanceAfterPaisa === null) {
    return NextResponse.json({ error: "DUPLICATE" }, { status: 409 });
  }

  await notifyAdminAdjustment(id, paisa);

  await writeAuditLog({
    actorId: session.user.id,
    actorRole: session.user.role,
    action: "MEMBER_TOP_UP",
    entityType: "Member",
    entityId: id,
    after: { amount, balance: formatSP(balanceAfterPaisa), note, idempotencyKey },
  });

  return NextResponse.json({ memberId: existing.memberId, balance: formatSP(balanceAfterPaisa) });
}
