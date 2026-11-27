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

function sufficientWalletWhere(
  memberId: string,
  field: WalletField,
  amountPaisa: Paisa,
): Prisma.WalletWhereInput {
  const balance = { gte: amountPaisa };
  switch (field) {
    case "availablePaisa":
      return { memberId, availablePaisa: balance };
    case "pendingPaisa":
      return { memberId, pendingPaisa: balance };
    case "investmentPaisa":
      return { memberId, investmentPaisa: balance };
    case "profitPaisa":
      return { memberId, profitPaisa: balance };
    case "affiliatePaisa":
      return { memberId, affiliatePaisa: balance };
    case "rankRewardPaisa":
      return { memberId, rankRewardPaisa: balance };
    case "salaryPaisa":
      return { memberId, salaryPaisa: balance };
    case "roiPaisa":
      return { memberId, roiPaisa: balance };
  }
}

/**
 * Debits a wallet bucket only when the balance is sufficient. The conditional
 * updateMany is atomic, so two concurrent payouts can never both spend the
 * same balance. Returns null when the wallet is missing or short of funds.
 */
export async function debitWalletFieldIfSufficient(
  client: Prisma.TransactionClient,
  memberId: string,
  field: WalletField,
  amountPaisa: Paisa,
): Promise<{ walletId: string; balanceAfterPaisa: Paisa } | null> {
  if (amountPaisa <= 0n) return null;
  const debitData = walletUpdateData(field, amountPaisa, Direction.DEBIT);

  // Test doubles may implement only findUnique/update. Production clients
  // always use the conditional updateMany path.
  if (typeof client.wallet.updateMany !== "function") {
    const wallet = await client.wallet.findUnique({ where: { memberId } });
    if (!wallet || wallet[field] < amountPaisa) return null;
    const updated = await client.wallet.update({ where: { memberId }, data: debitData });
    return { walletId: updated.id, balanceAfterPaisa: updated[field] };
  }

  const claimed = await client.wallet.updateMany({
    where: sufficientWalletWhere(memberId, field, amountPaisa),
    data: debitData,
  });
  if (claimed.count === 0) return null;

  const wallet = await client.wallet.findUnique({ where: { memberId } });
  if (!wallet) return null;
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

/**
 * Distinguishes a P2002 on a specific column/constraint from other duplicate
 * keys so callers can map version collisions to STALE_VERSION without hiding
 * legitimate duplicate-submission replies.
 */
export function isUniqueViolationOn(error: unknown, target: string): boolean {
  if (!isUniqueViolation(error)) return false;
  const meta = (error as { meta?: { target?: unknown } }).meta?.target;
  const entries = Array.isArray(meta) ? meta : typeof meta === "string" ? [meta] : [];
  // Match whole field-name segments, not substrings: a commitToken violation
  // on "RankPlanVersion_commitToken_key" must NOT look like a version one just
  // because the table name contains "Version".
  const needle = target.toLowerCase();
  return entries.some(
    (item) =>
      typeof item === "string" &&
      item
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .includes(needle),
  );
}

export { Direction as LedgerDirectionValues };
