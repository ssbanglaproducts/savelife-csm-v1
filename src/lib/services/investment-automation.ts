import { writeAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { creditDueInstallments, payDuePrincipalWithdrawals } from "./operations";

const DEFAULT_BATCH_LIMIT = 200;

export type InvestmentAutomationBatch = {
  readonly processed: number;
  readonly skipped: number;
  readonly totalPaisa: string;
  readonly error?: string;
};

export type InvestmentAutomationResult = {
  readonly ok: boolean;
  readonly ranAt: string;
  readonly installments: InvestmentAutomationBatch;
  readonly principalWithdrawals: InvestmentAutomationBatch;
};

function errorCode(error: unknown): string {
  return error instanceof Error ? error.message : "UNKNOWN_ERROR";
}

/**
 * Runs the scheduled investment money movements in one safe pass. Both service
 * functions are idempotent, so repeated runs never credit the same item twice.
 */
export async function runInvestmentAutomation(
  input: { asOf?: Date; limit?: number } = {},
): Promise<InvestmentAutomationResult> {
  const asOf = input.asOf ?? new Date();
  const limit = input.limit ?? DEFAULT_BATCH_LIMIT;

  let installments: InvestmentAutomationBatch = {
    processed: 0,
    skipped: 0,
    totalPaisa: "0",
  };
  let principalWithdrawals: InvestmentAutomationBatch = {
    processed: 0,
    skipped: 0,
    totalPaisa: "0",
  };

  try {
    const result = await creditDueInstallments(prisma, { asOf, limit });
    installments = {
      processed: result.appliedIds.length,
      skipped: result.skippedIds.length,
      totalPaisa: result.totalCreditedPaisa.toString(),
    };
  } catch (error) {
    console.error("Automatic installment credit failed", error);
    installments = { ...installments, error: errorCode(error) };
  }

  try {
    const result = await payDuePrincipalWithdrawals(prisma, { asOf, limit });
    principalWithdrawals = {
      processed: result.appliedIds.length,
      skipped: result.skippedIds.length,
      totalPaisa: result.totalReturnedPaisa.toString(),
    };
  } catch (error) {
    console.error("Automatic principal withdrawal failed", error);
    principalWithdrawals = { ...principalWithdrawals, error: errorCode(error) };
  }

  const result: InvestmentAutomationResult = {
    ok: !installments.error && !principalWithdrawals.error,
    ranAt: asOf.toISOString(),
    installments,
    principalWithdrawals,
  };

  await writeAuditLog({
    actorId: null,
    actorRole: null,
    action: "INVESTMENT_AUTOMATION",
    entityType: "System",
    entityId: "investment-automation",
    after: {
      ok: result.ok,
      ranAt: result.ranAt,
      installmentCredits: installments.processed,
      installmentPaisa: installments.totalPaisa,
      principalWithdrawals: principalWithdrawals.processed,
      principalPaisa: principalWithdrawals.totalPaisa,
      installmentError: installments.error ?? null,
      principalError: principalWithdrawals.error ?? null,
    },
  });

  return result;
}
