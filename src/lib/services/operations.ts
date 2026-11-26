import { createHash } from "node:crypto";
import type { PaymentMethod, Prisma, PrismaClient } from "../../generated/prisma/client";
import {
  DistributionStatus,
  InstallmentStatus,
  InvestmentStatus,
  InvestmentType,
  LedgerEntryType as LedgerType,
  WalletCategory as Category,
} from "../../generated/prisma/enums";
import type { Paisa } from "../money";
import {
  findSkippedAffiliateLevels,
  planAffiliateRewards,
  type AffiliateRateConfig,
  type AffiliateUplineCandidate,
} from "./affiliate";
import { isValidDate } from "./date";
import { invalidInput, notFound } from "./errors";
import {
  LedgerDirectionValues as Direction,
  adjustWalletField,
  categoryForWalletField,
  hasLedgerEntry,
  isUniqueViolation,
  makeKey,
  recordLedgerEntry,
} from "./ledger";
import {
  calculatePrincipalPayableDate,
  isProfitOnlyMatured,
  resolveProfitOnlyMaturityDate,
} from "./maturity";
import { notifyProfitDistributed } from "./notification-events";
import {
  assertDistributionReconciles,
  calculateMonthlyProfitDistribution,
  type ProfitEligibleInvestment,
} from "./profit";
import {
  loadRoiRateConfig,
  loadRoiSponsorIndex,
  postRoiCommissions,
  type RoiCommissionPostResult,
  type RoiCommissionSourceLine,
} from "./roi-commission";
import { loadAffiliateRateConfig, loadWithdrawalFeeConfig } from "./settings";
import type { BatchOperationResult, NoOpReason, OperationResult } from "./types";
import { calculateWithdrawalFee, type WithdrawalFeeConfig } from "./withdrawal";

const CREDIT = Direction.CREDIT;
const DEBIT = Direction.DEBIT;
const AVAILABLE = Category.AVAILABLE;
const DEFAULT_PREFIX = "csm";
const DEFAULT_BATCH_LIMIT = 200;
const MAX_BATCH_LIMIT = 1000;

function shouldRethrow(error: unknown): boolean {
  return !isUniqueViolation(error);
}

function assertIdempotencyKey(key: string): void {
  if (typeof key !== "string" || key.trim().length === 0) {
    throw invalidInput("A non-empty idempotency key is required");
  }
}

function assertBatchLimit(limit: number): void {
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_BATCH_LIMIT) {
    throw invalidInput(`Batch limit must be between 1 and ${MAX_BATCH_LIMIT}`);
  }
}

function makeWithdrawalRequestNumber(key: string): string {
  return `WD-${createHash("sha256").update(key).digest("hex").slice(0, 16).toUpperCase()}`;
}

// ---------------------------------------------------------------------------
// Profit distribution
// ---------------------------------------------------------------------------

export interface PostProfitDistributionInput {
  readonly month: string;
  readonly distributablePaisa: Paisa;
  readonly eligible: readonly ProfitEligibleInvestment[];
  readonly createdBy: string;
  readonly idempotencyPrefix?: string;
}

export type PostProfitDistributionResult = OperationResult & {
  readonly distributionId?: string;
  readonly allocatedPaisa: Paisa;
  readonly roiCommission?: RoiCommissionPostResult;
};

/**
 * Posts a distribution with an auto-generated timestamp. Multiple distributions
 * may share a month or day; the distribution id makes each ledger key unique.
 */
export async function postProfitDistribution(
  client: PrismaClient,
  input: PostProfitDistributionInput,
): Promise<PostProfitDistributionResult> {
  const calculation = calculateMonthlyProfitDistribution(
    input.distributablePaisa,
    input.eligible,
  );
  assertDistributionReconciles(calculation);

  const prefix = input.idempotencyPrefix ?? DEFAULT_PREFIX;
  // Sponsor chain and rates are snapshotted once per posting. ROI is computed
  // from each profit line's allocated amount; the original allocation is never
  // changed or reduced.
  const [roiConfig, roiSponsorIndex] = await Promise.all([
    loadRoiRateConfig(client),
    loadRoiSponsorIndex(client),
  ]);

  const post = async (tx: Prisma.TransactionClient): Promise<PostProfitDistributionResult> => {
    const distribution = await tx.profitDistribution.create({
      data: {
        month: input.month,
        distributablePaisa: calculation.distributablePaisa,
        totalEligiblePaisa: calculation.totalEligiblePaisa,
        profitPerThousandPaisa: calculation.profitPerThousandPaisa,
        status: DistributionStatus.POSTED,
        createdBy: input.createdBy,
        postedAt: new Date(),
      },
    });

    const ledgerEntryIds: string[] = [];
    const roiLines: RoiCommissionSourceLine[] = [];
    for (const line of calculation.lines) {
      const lineRecord = await tx.profitDistributionLine.create({
        data: {
          distributionId: distribution.id,
          memberId: line.memberId,
          investmentId: line.investmentId,
          eligiblePaisa: line.eligiblePaisa,
          allocatedPaisa: line.allocatedPaisa,
          roundingAdjustmentPaisa: line.roundingAdjustmentPaisa,
        },
      });

      const { walletId, balanceAfterPaisa } = await adjustWalletField(
        tx,
        line.memberId,
        "profitPaisa",
        line.allocatedPaisa,
        CREDIT,
      );
      const ledger = await recordLedgerEntry(tx, {
        walletId,
        memberId: line.memberId,
        category: Category.PROFIT,
        direction: CREDIT,
        amountPaisa: line.allocatedPaisa,
        balanceAfterPaisa,
        type: LedgerType.PROFIT_DISTRIBUTION,
        idempotencyKey: makeKey(
          prefix,
          "profit-distribution",
          distribution.id,
          line.investmentId,
        ),
        referenceType: "ProfitDistributionLine",
        referenceId: lineRecord.id,
        investmentId: line.investmentId,
        createdBy: input.createdBy,
      });
      ledgerEntryIds.push(ledger.id);
      if (line.allocatedPaisa > 0n) {
        roiLines.push({
          profitDistributionLineId: lineRecord.id,
          sourceMemberId: line.memberId,
          investmentId: line.investmentId,
          basisPaisa: line.allocatedPaisa,
        });
      }
    }

    const roiCommission = await postRoiCommissions(tx, {
      distributionId: distribution.id,
      month: input.month,
      lines: roiLines,
      sponsorIndex: roiSponsorIndex,
      config: roiConfig,
      createdBy: input.createdBy,
      idempotencyPrefix: prefix,
    });
    ledgerEntryIds.push(...roiCommission.ledgerEntryIds);

    return {
      applied: true,
      ledgerEntryIds,
      distributionId: distribution.id,
      allocatedPaisa: calculation.distributablePaisa,
      roiCommission,
    };
  };

  const result = await client.$transaction(post);
  if (result.applied) {
    await Promise.all(
      calculation.lines.map((line) =>
        notifyProfitDistributed(line.memberId, line.allocatedPaisa, input.month),
      ),
    );
  }
  return result;
}

// ---------------------------------------------------------------------------
// Installment credits
// ---------------------------------------------------------------------------

export interface CreditDueInstallmentsInput {
  readonly asOf?: Date;
  readonly limit?: number;
  readonly createdBy?: string;
  readonly idempotencyPrefix?: string;
}

export type CreditDueInstallmentsResult = BatchOperationResult & {
  readonly totalCreditedPaisa: Paisa;
};

type InstallmentOutcome =
  | { readonly applied: true; readonly ledgerId: string }
  | { readonly applied: false; readonly reason: NoOpReason };

/** Auto-credits PENDING installments whose contractual due date has arrived. */
export async function creditDueInstallments(
  client: PrismaClient,
  input: CreditDueInstallmentsInput = {},
): Promise<CreditDueInstallmentsResult> {
  const asOf = input.asOf ?? new Date();
  if (!isValidDate(asOf)) throw invalidInput("A valid as-of date is required");
  const limit = input.limit ?? DEFAULT_BATCH_LIMIT;
  assertBatchLimit(limit);
  const prefix = input.idempotencyPrefix ?? DEFAULT_PREFIX;

  const due = await client.investmentInstallment.findMany({
    where: { status: InstallmentStatus.PENDING, dueDate: { lte: asOf } },
    orderBy: { dueDate: "asc" },
    take: limit,
    include: {
      investment: {
        select: { memberId: true, remainingPrincipalPaisa: true, status: true },
      },
    },
  });

  const appliedIds: string[] = [];
  const skippedIds: string[] = [];
  const skippedReasons: Record<string, NoOpReason> = {};
  const ledgerEntryIds: string[] = [];
  let totalCreditedPaisa = 0n;

  for (const installment of due) {
    const memberId = installment.investment.memberId;
    const key = makeKey(prefix, "installment", installment.id, "credit");

    try {
      const outcome = await client.$transaction(
        async (tx): Promise<InstallmentOutcome> => {
          if (await hasLedgerEntry(tx, key)) return { applied: false, reason: "DUPLICATE" };

          const claimed = await tx.investmentInstallment.updateMany({
            where: { id: installment.id, status: InstallmentStatus.PENDING },
            data: { status: InstallmentStatus.PAID, paidAt: asOf },
          });
          if (claimed.count === 0) return { applied: false, reason: "ALREADY_APPLIED" };

          // Each payout returns capital, so the next month's profit share is
          // weighted against a smaller remaining principal.
          const investment = await tx.investment.findUnique({
            where: { id: installment.investmentId },
            select: { remainingPrincipalPaisa: true },
          });
          if (!investment) return { applied: false, reason: "NOT_FOUND" };
          const remainingPrincipalPaisa =
            investment.remainingPrincipalPaisa > installment.amountPaisa
              ? investment.remainingPrincipalPaisa - installment.amountPaisa
              : 0n;
          await tx.investment.update({
            where: { id: installment.investmentId },
            data: {
              remainingPrincipalPaisa,
              ...(remainingPrincipalPaisa === 0n
                ? { status: InvestmentStatus.CLOSED }
                : {}),
            },
          });

          const { walletId, balanceAfterPaisa } = await adjustWalletField(
            tx,
            memberId,
            "availablePaisa",
            installment.amountPaisa,
            CREDIT,
          );
          const ledger = await recordLedgerEntry(tx, {
            walletId,
            memberId,
            category: AVAILABLE,
            direction: CREDIT,
            amountPaisa: installment.amountPaisa,
            balanceAfterPaisa,
            type: LedgerType.INSTALLMENT_PAYMENT,
            idempotencyKey: key,
            referenceType: "InvestmentInstallment",
            referenceId: installment.id,
            investmentId: installment.investmentId,
            installmentId: installment.id,
            description: "Monthly capital installment",
            createdBy: input.createdBy,
          });
          return { applied: true, ledgerId: ledger.id };
        },
      );

      if (outcome.applied) {
        appliedIds.push(installment.id);
        ledgerEntryIds.push(outcome.ledgerId);
        totalCreditedPaisa += installment.amountPaisa;
      } else {
        skippedIds.push(installment.id);
        skippedReasons[installment.id] = outcome.reason;
      }
    } catch (error) {
      if (shouldRethrow(error) || !(await hasLedgerEntry(client, key))) throw error;
      skippedIds.push(installment.id);
      skippedReasons[installment.id] = "DUPLICATE";
    }
  }

  return { appliedIds, skippedIds, skippedReasons, ledgerEntryIds, totalCreditedPaisa };
}

export interface ReverseInstallmentCreditInput {
  readonly installmentId: string;
  readonly createdBy?: string;
  readonly idempotencyPrefix?: string;
}

/**
 * Admin correction for an installment credit. The installment stays PAID so a
 * reversed credit can never be auto-credited a second time.
 */
export async function reverseInstallmentCredit(
  client: PrismaClient,
  input: ReverseInstallmentCreditInput,
): Promise<OperationResult> {
  const prefix = input.idempotencyPrefix ?? DEFAULT_PREFIX;
  const creditKey = makeKey(prefix, "installment", input.installmentId, "credit");
  const reversalKey = `${creditKey}:reversal`;

  const credit = await client.ledgerEntry.findUnique({ where: { idempotencyKey: creditKey } });
  if (!credit) return { applied: false, reason: "NOT_FOUND", ledgerEntryIds: [] };
  if (await hasLedgerEntry(client, reversalKey)) {
    return { applied: false, reason: "DUPLICATE", ledgerEntryIds: [] };
  }
  const investment = credit.investmentId
    ? await client.investment.findUnique({
        where: { id: credit.investmentId },
        select: { amountPaisa: true, remainingPrincipalPaisa: true },
      })
    : null;

  const reverse = async (tx: Prisma.TransactionClient): Promise<OperationResult> => {
    if (await hasLedgerEntry(tx, reversalKey)) {
      return { applied: false, reason: "DUPLICATE", ledgerEntryIds: [] };
    }
    const { walletId, balanceAfterPaisa } = await adjustWalletField(
      tx,
      credit.memberId,
      "availablePaisa",
      credit.amountPaisa,
      DEBIT,
    );
    const ledger = await recordLedgerEntry(tx, {
      walletId,
      memberId: credit.memberId,
      category: AVAILABLE,
      direction: DEBIT,
      amountPaisa: credit.amountPaisa,
      balanceAfterPaisa,
      type: LedgerType.ADMIN_ADJUSTMENT,
      idempotencyKey: reversalKey,
      referenceType: "LedgerEntry",
      referenceId: credit.id,
      // installmentId is @unique on LedgerEntry, so the reversal links to the
      // original entry via referenceId instead of repeating installmentId.
      description: "Reversal of installment credit",
      createdBy: input.createdBy,
    });
    if (investment && credit.investmentId) {
      const restored = investment.remainingPrincipalPaisa + credit.amountPaisa;
      await tx.investment.update({
        where: { id: credit.investmentId },
        data: {
          remainingPrincipalPaisa:
            restored > investment.amountPaisa ? investment.amountPaisa : restored,
          status: InvestmentStatus.ACTIVE,
        },
      });
    }
    return { applied: true, ledgerEntryIds: [ledger.id] };
  };

  try {
    return await client.$transaction(reverse);
  } catch (error) {
    if (isUniqueViolation(error) && (await hasLedgerEntry(client, reversalKey))) {
      return { applied: false, reason: "DUPLICATE", ledgerEntryIds: [] };
    }
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Profit Only principal withdrawal by notice
// ---------------------------------------------------------------------------

export interface CreatePrincipalNoticeInput {
  readonly memberId: string;
  readonly investmentId: string;
  readonly method: PaymentMethod;
  readonly accountDetails: Prisma.InputJsonValue;
  readonly note?: string;
  /** Stable caller-generated key; one notice per key. */
  readonly idempotencyKey: string;
}

export type CreatePrincipalNoticeResult = OperationResult & {
  readonly withdrawalId?: string;
  readonly requestNumber?: string;
  readonly payableAt?: Date;
  readonly amountPaisa: Paisa;
};

/**
 * Registers a two-month notice for a Profit Only investment whose lock-in has
 * ended. No money moves yet: profit keeps accruing while the capital remains.
 */
export async function createPrincipalWithdrawalNotice(
  client: PrismaClient,
  input: CreatePrincipalNoticeInput,
): Promise<CreatePrincipalNoticeResult> {
  assertIdempotencyKey(input.idempotencyKey);
  const requestNumber = makeWithdrawalRequestNumber(input.idempotencyKey);
  if (await client.withdrawal.findUnique({ where: { requestNumber } })) {
    return { applied: false, reason: "DUPLICATE", ledgerEntryIds: [], amountPaisa: 0n };
  }

  const investment = await client.investment.findUnique({
    where: { id: input.investmentId },
    select: {
      memberId: true,
      type: true,
      status: true,
      remainingPrincipalPaisa: true,
      lockInEndsAt: true,
      startDate: true,
      lockInMonths: true,
      createdAt: true,
    },
  });
  if (!investment || investment.memberId !== input.memberId) {
    return { applied: false, reason: "NOT_FOUND", ledgerEntryIds: [], amountPaisa: 0n };
  }
  if (
    investment.type !== InvestmentType.PROFIT_ONLY ||
    investment.status !== InvestmentStatus.ACTIVE ||
    investment.remainingPrincipalPaisa <= 0n
  ) {
    return { applied: false, reason: "INELIGIBLE", ledgerEntryIds: [], amountPaisa: 0n };
  }

  const maturity = resolveProfitOnlyMaturityDate({
    lockInEndsAt: investment.lockInEndsAt,
    startDate: investment.startDate,
    lockInMonths: investment.lockInMonths,
    fallbackStartDate: investment.createdAt,
  });
  if (!maturity || !isProfitOnlyMatured(maturity)) {
    return { applied: false, reason: "NOT_MATURED", ledgerEntryIds: [], amountPaisa: 0n };
  }

  const existing = await client.withdrawal.findFirst({
    where: {
      investmentId: input.investmentId,
      type: "PRINCIPAL",
      status: { in: ["PENDING", "APPROVED"] },
    },
    select: { id: true },
  });
  if (existing) {
    return { applied: false, reason: "DUPLICATE", ledgerEntryIds: [], amountPaisa: 0n };
  }

  const noticeAt = new Date();
  const payableAt = calculatePrincipalPayableDate(noticeAt);
  const amountPaisa = investment.remainingPrincipalPaisa;

  try {
    const withdrawal = await client.withdrawal.create({
      data: {
        requestNumber,
        memberId: input.memberId,
        type: "PRINCIPAL",
        investmentId: input.investmentId,
        amountPaisa,
        feePaisa: 0n,
        netPaisa: amountPaisa,
        method: input.method,
        accountDetails: input.accountDetails,
        note: input.note || null,
        status: "PENDING",
        noticeAt,
        payableAt,
      },
    });
    return {
      applied: true,
      ledgerEntryIds: [],
      withdrawalId: withdrawal.id,
      requestNumber: withdrawal.requestNumber,
      payableAt: withdrawal.payableAt ?? undefined,
      amountPaisa,
    };
  } catch (error) {
    if (isUniqueViolation(error)) {
      return { applied: false, reason: "DUPLICATE", ledgerEntryIds: [], amountPaisa: 0n };
    }
    throw error;
  }
}

export interface PayDuePrincipalWithdrawalsInput {
  readonly asOf?: Date;
  readonly limit?: number;
  readonly createdBy?: string;
  readonly idempotencyPrefix?: string;
}

export type PayDuePrincipalWithdrawalsResult = BatchOperationResult & {
  readonly totalReturnedPaisa: Paisa;
};

/** Releases principal whose notice window has elapsed, once per withdrawal. */
export async function payDuePrincipalWithdrawals(
  client: PrismaClient,
  input: PayDuePrincipalWithdrawalsInput = {},
): Promise<PayDuePrincipalWithdrawalsResult> {
  const asOf = input.asOf ?? new Date();
  if (!isValidDate(asOf)) throw invalidInput("A valid as-of date is required");
  const limit = input.limit ?? DEFAULT_BATCH_LIMIT;
  assertBatchLimit(limit);
  const prefix = input.idempotencyPrefix ?? DEFAULT_PREFIX;

  const due = await client.withdrawal.findMany({
    where: {
      type: "PRINCIPAL",
      status: "PENDING",
      payableAt: { lte: asOf },
    },
    orderBy: { payableAt: "asc" },
    take: limit,
    include: {
      investment: {
        select: {
          memberId: true,
          status: true,
          remainingPrincipalPaisa: true,
        },
      },
    },
  });

  const appliedIds: string[] = [];
  const skippedIds: string[] = [];
  const skippedReasons: Record<string, NoOpReason> = {};
  const ledgerEntryIds: string[] = [];
  let totalReturnedPaisa = 0n;

  for (const withdrawal of due) {
    const investment = withdrawal.investment;
    const investmentId = withdrawal.investmentId;
    if (
      !investment ||
      !investmentId ||
      investment.status !== InvestmentStatus.ACTIVE ||
      investment.remainingPrincipalPaisa <= 0n
    ) {
      skippedIds.push(withdrawal.id);
      skippedReasons[withdrawal.id] = "INELIGIBLE";
      continue;
    }

    const key = makeKey(prefix, "principal-withdrawal", withdrawal.id);
    const debitKey = `${key}:investment-debit`;
    try {
      const outcome = await client.$transaction(
        async (tx): Promise<
          | { applied: true; ledgerIds: readonly string[]; amountPaisa: Paisa }
          | { applied: false; reason: NoOpReason }
        > => {
          if (await hasLedgerEntry(tx, key)) return { applied: false, reason: "DUPLICATE" };
          const amountPaisa =
            withdrawal.netPaisa > investment.remainingPrincipalPaisa
              ? investment.remainingPrincipalPaisa
              : withdrawal.netPaisa;

          const claimed = await tx.withdrawal.updateMany({
            where: { id: withdrawal.id, status: "PENDING" },
            data: { status: "APPROVED", processedAt: asOf },
          });
          if (claimed.count === 0) return { applied: false, reason: "ALREADY_APPLIED" };

          const closed = await tx.investment.updateMany({
            where: {
              id: investmentId,
              status: InvestmentStatus.ACTIVE,
            },
            data: { status: InvestmentStatus.CLOSED, remainingPrincipalPaisa: 0n },
          });
          if (closed.count === 0) return { applied: false, reason: "INELIGIBLE" };

          const debit = await adjustWalletField(
            tx,
            investment.memberId,
            "investmentPaisa",
            amountPaisa,
            DEBIT,
          );
          const debitLedger = await recordLedgerEntry(tx, {
            walletId: debit.walletId,
            memberId: investment.memberId,
            category: Category.INVESTMENT,
            direction: DEBIT,
            amountPaisa,
            balanceAfterPaisa: debit.balanceAfterPaisa,
            type: LedgerType.PRINCIPAL_RETURN,
            idempotencyKey: debitKey,
            referenceType: "Withdrawal",
            referenceId: withdrawal.id,
            investmentId,
            description: "Profit Only principal released after notice",
            createdBy: input.createdBy,
          });

          const credit = await adjustWalletField(
            tx,
            investment.memberId,
            "availablePaisa",
            amountPaisa,
            CREDIT,
          );
          const creditLedger = await recordLedgerEntry(tx, {
            walletId: credit.walletId,
            memberId: investment.memberId,
            category: AVAILABLE,
            direction: CREDIT,
            amountPaisa,
            balanceAfterPaisa: credit.balanceAfterPaisa,
            type: LedgerType.PRINCIPAL_RETURN,
            idempotencyKey: key,
            referenceType: "Withdrawal",
            referenceId: withdrawal.id,
            investmentId,
            description: "Profit Only principal available after notice",
            createdBy: input.createdBy,
          });
          return { applied: true, ledgerIds: [debitLedger.id, creditLedger.id], amountPaisa };
        },
      );

      if (outcome.applied) {
        appliedIds.push(withdrawal.id);
        ledgerEntryIds.push(...outcome.ledgerIds);
        totalReturnedPaisa += outcome.amountPaisa;
      } else {
        skippedIds.push(withdrawal.id);
        skippedReasons[withdrawal.id] = outcome.reason;
      }
    } catch (error) {
      if (shouldRethrow(error) || !(await hasLedgerEntry(client, key))) throw error;
      skippedIds.push(withdrawal.id);
      skippedReasons[withdrawal.id] = "DUPLICATE";
    }
  }

  return { appliedIds, skippedIds, skippedReasons, ledgerEntryIds, totalReturnedPaisa };
}

/** Admin records the payout of an already released principal notice. */
export async function completePrincipalWithdrawal(
  client: PrismaClient,
  input: {
    readonly withdrawalId: string;
    readonly processedBy: string;
    readonly idempotencyPrefix?: string;
  },
): Promise<OperationResult> {
  const withdrawal = await client.withdrawal.findUnique({
    where: { id: input.withdrawalId },
    select: {
      id: true,
      memberId: true,
      type: true,
      status: true,
      netPaisa: true,
    },
  });
  if (!withdrawal || withdrawal.type !== "PRINCIPAL" || withdrawal.status !== "APPROVED") {
    return { applied: false, reason: "INELIGIBLE", ledgerEntryIds: [] };
  }

  const prefix = input.idempotencyPrefix ?? DEFAULT_PREFIX;
  const key = makeKey(prefix, "principal-payout", withdrawal.id);
  if (await hasLedgerEntry(client, key)) {
    return { applied: false, reason: "DUPLICATE", ledgerEntryIds: [] };
  }

  const complete = async (tx: Prisma.TransactionClient): Promise<OperationResult> => {
    if (await hasLedgerEntry(tx, key)) {
      return { applied: false, reason: "DUPLICATE", ledgerEntryIds: [] };
    }
    const claimed = await tx.withdrawal.updateMany({
      where: { id: withdrawal.id, status: "APPROVED" },
      data: {
        status: "PAID",
        processedBy: input.processedBy,
        processedAt: new Date(),
      },
    });
    if (claimed.count === 0) return { applied: false, reason: "ALREADY_APPLIED", ledgerEntryIds: [] };

    const debited = await adjustWalletField(
      tx,
      withdrawal.memberId,
      "availablePaisa",
      withdrawal.netPaisa,
      DEBIT,
    );
    const ledger = await recordLedgerEntry(tx, {
      walletId: debited.walletId,
      memberId: withdrawal.memberId,
      category: AVAILABLE,
      direction: DEBIT,
      amountPaisa: withdrawal.netPaisa,
      balanceAfterPaisa: debited.balanceAfterPaisa,
      type: LedgerType.WITHDRAWAL,
      idempotencyKey: key,
      referenceType: "Withdrawal",
      referenceId: withdrawal.id,
      description: "Principal withdrawal paid after notice",
      createdBy: input.processedBy,
    });
    return { applied: true, ledgerEntryIds: [ledger.id] };
  };

  try {
    return await client.$transaction(complete);
  } catch (error) {
    if (isUniqueViolation(error) && (await hasLedgerEntry(client, key))) {
      return { applied: false, reason: "DUPLICATE", ledgerEntryIds: [] };
    }
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Balance transfer (reward wallet -> Available)
// ---------------------------------------------------------------------------

export type TransferSource = "PROFIT" | "AFFILIATE" | "RANK_REWARD";

type TransferWalletField = "profitPaisa" | "affiliatePaisa" | "rankRewardPaisa";

const TRANSFER_SOURCE_FIELDS: Record<TransferSource, TransferWalletField> = {
  PROFIT: "profitPaisa",
  AFFILIATE: "affiliatePaisa",
  RANK_REWARD: "rankRewardPaisa",
};

export interface TransferBalanceToAvailableInput {
  readonly memberId: string;
  readonly source: TransferSource;
  readonly amountPaisa: Paisa;
  /** Stable caller-generated key; the same key can never move money twice. */
  readonly idempotencyKey: string;
  readonly createdBy?: string;
}

export type TransferBalanceToAvailableResult = OperationResult;

export async function transferBalanceToAvailable(
  client: PrismaClient,
  input: TransferBalanceToAvailableInput,
): Promise<TransferBalanceToAvailableResult> {
  assertIdempotencyKey(input.idempotencyKey);
  if (input.amountPaisa <= 0n) throw invalidInput("Transfer amount must be positive");

  const debitKey = makeKey(input.idempotencyKey, "debit");
  const creditKey = makeKey(input.idempotencyKey, "credit");
  if ((await hasLedgerEntry(client, debitKey)) || (await hasLedgerEntry(client, creditKey))) {
    return { applied: false, reason: "DUPLICATE", ledgerEntryIds: [] };
  }

  const sourceField = TRANSFER_SOURCE_FIELDS[input.source];

  const transfer = async (tx: Prisma.TransactionClient): Promise<OperationResult> => {
    if ((await hasLedgerEntry(tx, debitKey)) || (await hasLedgerEntry(tx, creditKey))) {
      return { applied: false, reason: "DUPLICATE", ledgerEntryIds: [] };
    }
    const wallet = await tx.wallet.findUnique({
      where: { memberId: input.memberId },
      select: {
        profitPaisa: true,
        affiliatePaisa: true,
        rankRewardPaisa: true,
      },
    });
    if (!wallet) return { applied: false, reason: "NOT_FOUND", ledgerEntryIds: [] };

    const sourceBalance = wallet[sourceField];
    if (sourceBalance < input.amountPaisa) {
      return { applied: false, reason: "INSUFFICIENT_BALANCE", ledgerEntryIds: [] };
    }

    const debited = await adjustWalletField(
      tx,
      input.memberId,
      sourceField,
      input.amountPaisa,
      DEBIT,
    );
    const credited = await adjustWalletField(
      tx,
      input.memberId,
      "availablePaisa",
      input.amountPaisa,
      CREDIT,
    );

    const debitLedger = await recordLedgerEntry(tx, {
      walletId: debited.walletId,
      memberId: input.memberId,
      category: categoryForWalletField(sourceField),
      direction: DEBIT,
      amountPaisa: input.amountPaisa,
      balanceAfterPaisa: debited.balanceAfterPaisa,
      type: LedgerType.BALANCE_TRANSFER,
      idempotencyKey: debitKey,
      referenceType: "BalanceTransfer",
      referenceId: input.idempotencyKey,
      createdBy: input.createdBy,
    });
    const creditLedger = await recordLedgerEntry(tx, {
      walletId: credited.walletId,
      memberId: input.memberId,
      category: AVAILABLE,
      direction: CREDIT,
      amountPaisa: input.amountPaisa,
      balanceAfterPaisa: credited.balanceAfterPaisa,
      type: LedgerType.BALANCE_TRANSFER,
      idempotencyKey: creditKey,
      referenceType: "BalanceTransfer",
      referenceId: input.idempotencyKey,
      createdBy: input.createdBy,
    });

    return { applied: true, ledgerEntryIds: [debitLedger.id, creditLedger.id] };
  };

  try {
    return await client.$transaction(transfer);
  } catch (error) {
    if (
      isUniqueViolation(error) &&
      ((await hasLedgerEntry(client, debitKey)) || (await hasLedgerEntry(client, creditKey)))
    ) {
      return { applied: false, reason: "DUPLICATE", ledgerEntryIds: [] };
    }
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Withdrawal request
// ---------------------------------------------------------------------------

export interface CreateWithdrawalRequestInput {
  readonly memberId: string;
  readonly amountPaisa: Paisa;
  readonly method: PaymentMethod;
  readonly accountDetails: Prisma.InputJsonValue;
  readonly note?: string;
  /** Stable caller-generated key; one request per key. */
  readonly idempotencyKey: string;
  readonly feeConfig?: WithdrawalFeeConfig;
}

export type CreateWithdrawalRequestResult = OperationResult & {
  readonly withdrawalId?: string;
  readonly requestNumber?: string;
  readonly feePaisa: Paisa;
  readonly netPaisa: Paisa;
};

/** Creates a PENDING withdrawal drawn only from the Available balance. */
export async function createWithdrawalRequest(
  client: PrismaClient,
  input: CreateWithdrawalRequestInput,
): Promise<CreateWithdrawalRequestResult> {
  assertIdempotencyKey(input.idempotencyKey);
  const withdrawalKey = makeKey(input.idempotencyKey, "withdrawal");
  const feeKey = makeKey(input.idempotencyKey, "fee");
  if ((await hasLedgerEntry(client, withdrawalKey)) || (await hasLedgerEntry(client, feeKey))) {
    return {
      applied: false,
      reason: "DUPLICATE",
      ledgerEntryIds: [],
      feePaisa: 0n,
      netPaisa: 0n,
    };
  }

  const config = input.feeConfig ?? (await loadWithdrawalFeeConfig(client));
  const fee = calculateWithdrawalFee(input.amountPaisa, config);
  if (!fee.meetsMinimum) {
    return {
      applied: false,
      reason: "BELOW_MINIMUM",
      ledgerEntryIds: [],
      feePaisa: 0n,
      netPaisa: 0n,
    };
  }

  const request = async (tx: Prisma.TransactionClient): Promise<CreateWithdrawalRequestResult> => {
    if ((await hasLedgerEntry(tx, withdrawalKey)) || (await hasLedgerEntry(tx, feeKey))) {
      return {
        applied: false,
        reason: "DUPLICATE",
        ledgerEntryIds: [],
        feePaisa: 0n,
        netPaisa: 0n,
      };
    }
    const wallet = await tx.wallet.findUnique({
      where: { memberId: input.memberId },
      select: { availablePaisa: true },
    });
    if (!wallet) {
      return {
        applied: false,
        reason: "NOT_FOUND",
        ledgerEntryIds: [],
        feePaisa: 0n,
        netPaisa: 0n,
      };
    }
    if (wallet.availablePaisa < input.amountPaisa) {
      return {
        applied: false,
        reason: "INSUFFICIENT_BALANCE",
        ledgerEntryIds: [],
        feePaisa: 0n,
        netPaisa: 0n,
      };
    }

    const debited = await adjustWalletField(
      tx,
      input.memberId,
      "availablePaisa",
      input.amountPaisa,
      DEBIT,
    );
    const requestNumber = makeWithdrawalRequestNumber(input.idempotencyKey);
    const withdrawal = await tx.withdrawal.create({
      data: {
        requestNumber,
        memberId: input.memberId,
        amountPaisa: fee.amountPaisa,
        feePaisa: fee.feePaisa,
        netPaisa: fee.netPaisa,
        method: input.method,
        accountDetails: input.accountDetails,
        note: input.note || null,
        status: "PENDING",
      },
    });

    // Net + fee always equal the single Available debit; both entries carry the
    // same resulting balance because they describe that one atomic debit.
    const withdrawalLedger = await recordLedgerEntry(tx, {
      walletId: debited.walletId,
      memberId: input.memberId,
      category: AVAILABLE,
      direction: DEBIT,
      amountPaisa: fee.netPaisa,
      balanceAfterPaisa: debited.balanceAfterPaisa,
      type: LedgerType.WITHDRAWAL,
      idempotencyKey: withdrawalKey,
      referenceType: "Withdrawal",
      referenceId: withdrawal.id,
    });
    const feeLedger = await recordLedgerEntry(tx, {
      walletId: debited.walletId,
      memberId: input.memberId,
      category: AVAILABLE,
      direction: DEBIT,
      amountPaisa: fee.feePaisa,
      balanceAfterPaisa: debited.balanceAfterPaisa,
      type: LedgerType.WITHDRAWAL_FEE,
      idempotencyKey: feeKey,
      referenceType: "Withdrawal",
      referenceId: withdrawal.id,
    });

    return {
      applied: true,
      ledgerEntryIds: [withdrawalLedger.id, feeLedger.id],
      withdrawalId: withdrawal.id,
      requestNumber,
      feePaisa: fee.feePaisa,
      netPaisa: fee.netPaisa,
    };
  };

  try {
    return await client.$transaction(request);
  } catch (error) {
    if (
      isUniqueViolation(error) &&
      ((await hasLedgerEntry(client, withdrawalKey)) || (await hasLedgerEntry(client, feeKey)))
    ) {
      return {
        applied: false,
        reason: "DUPLICATE",
        ledgerEntryIds: [],
        feePaisa: 0n,
        netPaisa: 0n,
      };
    }
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Affiliate rewards
// ---------------------------------------------------------------------------

export interface CreditAffiliateRewardsInput {
  readonly investmentId: string;
  /** Immutable upline snapshot captured when the investment was created. */
  readonly uplines: readonly AffiliateUplineCandidate[];
  readonly rateConfig?: AffiliateRateConfig;
  readonly idempotencyPrefix?: string;
}

export type CreditAffiliateRewardsResult = BatchOperationResult & {
  readonly skippedLevels: readonly number[];
};

export const AFFILIATE_PLAN_AUDIT_ACTION = "AFFILIATE_REWARD_PLAN_FINALIZED";
export const AFFILIATE_PLAN_AUDIT_ENTITY = "AffiliateRewardPlan";

function parseFinalizedSkippedLevels(value: Prisma.JsonValue | null): readonly number[] {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return [];
  const candidate = (value as Record<string, unknown>).skippedLevels;
  if (!Array.isArray(candidate)) return [];
  return candidate.filter(
    (level): level is number => typeof level === "number" && Number.isInteger(level),
  );
}

/**
 * Credits up to three reward levels. A level absent from the upline snapshot is
 * skipped permanently: the skipped level list is finalized in an audit entry so
 * a later call with a different chain cannot backfill it.
 */
export async function creditAffiliateRewardsForInvestment(
  client: PrismaClient,
  input: CreditAffiliateRewardsInput,
): Promise<CreditAffiliateRewardsResult> {
  const investment = await client.investment.findUnique({
    where: { id: input.investmentId },
    select: { amountPaisa: true },
  });
  if (!investment) throw notFound(`Investment not found: ${input.investmentId}`);

  const config = input.rateConfig ?? (await loadAffiliateRateConfig(client));
  const planned = planAffiliateRewards(investment.amountPaisa, input.uplines, config);
  const plannedSkippedLevels = findSkippedAffiliateLevels(input.uplines, config);
  const prefix = input.idempotencyPrefix ?? DEFAULT_PREFIX;

  const run = async (tx: Prisma.TransactionClient): Promise<CreditAffiliateRewardsResult> => {
    const finalized = await tx.auditLog.findFirst({
      where: {
        action: AFFILIATE_PLAN_AUDIT_ACTION,
        entityType: AFFILIATE_PLAN_AUDIT_ENTITY,
        entityId: input.investmentId,
      },
      orderBy: { createdAt: "desc" },
    });
    const skippedLevels = finalized
      ? parseFinalizedSkippedLevels(finalized.after)
      : plannedSkippedLevels;
    const effective = planned.filter((reward) => !skippedLevels.includes(reward.level));

    const appliedIds: string[] = [];
    const skippedIds: string[] = [];
    const skippedReasons: Record<string, NoOpReason> = {};
    const ledgerEntryIds: string[] = [];

    for (const reward of effective) {
      const identity = `${reward.level}:${reward.beneficiaryId}`;
      const existing = await tx.affiliateReward.findUnique({
        where: {
          investmentId_beneficiaryId_level: {
            investmentId: input.investmentId,
            beneficiaryId: reward.beneficiaryId,
            level: reward.level,
          },
        },
        select: { id: true },
      });
      if (existing) {
        skippedIds.push(identity);
        skippedReasons[identity] = "DUPLICATE";
        continue;
      }

      const rewardRecord = await tx.affiliateReward.create({
        data: {
          investmentId: input.investmentId,
          beneficiaryId: reward.beneficiaryId,
          level: reward.level,
          rateBps: reward.rateBps,
          amountPaisa: reward.amountPaisa,
        },
      });
      const { walletId, balanceAfterPaisa } = await adjustWalletField(
        tx,
        reward.beneficiaryId,
        "affiliatePaisa",
        reward.amountPaisa,
        CREDIT,
      );
      const ledger = await recordLedgerEntry(tx, {
        walletId,
        memberId: reward.beneficiaryId,
        category: Category.AFFILIATE,
        direction: CREDIT,
        amountPaisa: reward.amountPaisa,
        balanceAfterPaisa,
        type: LedgerType.AFFILIATE_REWARD,
        idempotencyKey: makeKey(
          prefix,
          "affiliate-reward",
          input.investmentId,
          String(reward.level),
        ),
        referenceType: "AffiliateReward",
        referenceId: rewardRecord.id,
        investmentId: input.investmentId,
      });
      appliedIds.push(identity);
      ledgerEntryIds.push(ledger.id);
    }

    if (!finalized) {
      await tx.auditLog.create({
        data: {
          action: AFFILIATE_PLAN_AUDIT_ACTION,
          entityType: AFFILIATE_PLAN_AUDIT_ENTITY,
          entityId: input.investmentId,
          after: { skippedLevels: plannedSkippedLevels } as Prisma.InputJsonValue,
        },
      });
    }

    return { appliedIds, skippedIds, skippedReasons, ledgerEntryIds, skippedLevels };
  };

  try {
    return await client.$transaction(run);
  } catch (error) {
    if (isUniqueViolation(error)) {
      const skippedIds = planned.map(
        (reward) => `${reward.level}:${reward.beneficiaryId}`,
      );
      const skippedReasons: Record<string, NoOpReason> = {};
      for (const identity of skippedIds) skippedReasons[identity] = "DUPLICATE";
      return {
        appliedIds: [],
        skippedIds,
        skippedReasons,
        ledgerEntryIds: [],
        skippedLevels: plannedSkippedLevels,
      };
    }
    throw error;
  }
}
