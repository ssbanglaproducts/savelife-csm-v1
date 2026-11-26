import type {
  LedgerDirection,
  LedgerEntry,
  LedgerEntryType,
  Prisma,
  PrismaClient,
  WalletCategory,
} from "../../generated/prisma/client";
import {
  LedgerDirection as Direction,
  WalletCategory as Category,
} from "../../generated/prisma/enums";
import type { Paisa } from "../money";

export type WalletField =
  | "availablePaisa"
  | "pendingPaisa"
  | "investmentPaisa"
  | "profitPaisa"
  | "affiliatePaisa"
  | "rankRewardPaisa"
  | "salaryPaisa"
  | "roiPaisa";

const FIELD_CATEGORIES: Record<WalletField, WalletCategory> = {
  availablePaisa: Category.AVAILABLE,
  pendingPaisa: Category.PENDING,
  investmentPaisa: Category.INVESTMENT,
  profitPaisa: Category.PROFIT,
  affiliatePaisa: Category.AFFILIATE,
  rankRewardPaisa: Category.RANK_REWARD,
  salaryPaisa: Category.SALARY,
  roiPaisa: Category.ROI_COMMISSION,
};

export function categoryForWalletField(field: WalletField): WalletCategory {
  return FIELD_CATEGORIES[field];
}

export function makeKey(...parts: readonly string[]): string {
  return parts.join(":");
}

function walletUpdateData(
  field: WalletField,
  amountPaisa: Paisa,
  direction: LedgerDirection,
): Prisma.WalletUpdateInput {
  const operation =
    direction === Direction.CREDIT ? { increment: amountPaisa } : { decrement: amountPaisa };
  switch (field) {
    case "availablePaisa":
      return { availablePaisa: operation };
    case "pendingPaisa":
      return { pendingPaisa: operation };
    case "investmentPaisa":
      return { investmentPaisa: operation };
    case "profitPaisa":
      return { profitPaisa: operation };
    case "affiliatePaisa":
      return { affiliatePaisa: operation };
    case "rankRewardPaisa":
      return { rankRewardPaisa: operation };
    case "salaryPaisa":
      return { salaryPaisa: operation };
    case "roiPaisa":
      return { roiPaisa: operation };
  }
}

/** Adjusts one wallet bucket atomically and returns the resulting balance. */
export async function adjustWalletField(
  client: Prisma.TransactionClient,
  memberId: string,
  field: WalletField,
  amountPaisa: Paisa,
  direction: LedgerDirection,
): Promise<{ walletId: string; balanceAfterPaisa: Paisa }> {
  const wallet = await client.wallet.update({
    where: { memberId },
    data: walletUpdateData(field, amountPaisa, direction),
  });
  return { walletId: wallet.id, balanceAfterPaisa: wallet[field] };
}

export interface RecordLedgerInput {
  readonly id?: string;
  readonly walletId: string;
  readonly memberId: string;
  readonly category: WalletCategory;
  readonly direction: LedgerDirection;
  readonly amountPaisa: Paisa;
  readonly balanceAfterPaisa: Paisa;
  readonly type: LedgerEntryType;
  readonly idempotencyKey: string;
  readonly referenceType?: string;
  readonly referenceId?: string;
  readonly investmentId?: string;
  readonly installmentId?: string;
  readonly description?: string;
  readonly createdBy?: string;
}

/** Ledger entries are append-only; every mutation writes one through this helper. */
export async function recordLedgerEntry(
  client: Prisma.TransactionClient,
  input: RecordLedgerInput,
): Promise<LedgerEntry> {
  return client.ledgerEntry.create({
    data: {
      ...(input.id ? { id: input.id } : {}),
      walletId: input.walletId,
      memberId: input.memberId,
      category: input.category,
      direction: input.direction,
      amountPaisa: input.amountPaisa,
      balanceAfterPaisa: input.balanceAfterPaisa,
      type: input.type,
      idempotencyKey: input.idempotencyKey,
      referenceType: input.referenceType ?? null,
      referenceId: input.referenceId ?? null,
      investmentId: input.investmentId ?? null,
      installmentId: input.installmentId ?? null,
      description: input.description ?? null,
      createdBy: input.createdBy ?? null,
    },
  });
}

export async function hasLedgerEntry(
  client: Prisma.TransactionClient | PrismaClient,
  idempotencyKey: string,
): Promise<boolean> {
  const existing = await client.ledgerEntry.findUnique({
    where: { idempotencyKey },
    select: { id: true },
  });
  return existing !== null;
}

/** Prisma unique-constraint violation (P2002), checked without importing a runtime error class. */
export function isUniqueViolation(error: unknown): boolean {
  if (typeof error !== "object" || error === null || !("code" in error)) return false;
  return (error as { code?: unknown }).code === "P2002";
}

export { Direction as LedgerDirectionValues };
