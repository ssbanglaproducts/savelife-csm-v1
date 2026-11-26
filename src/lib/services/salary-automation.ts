import { writeAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import {
  runSalaryDistribution,
  type SalaryDistributionResult,
} from "./salary-distribution";
import { getActiveSalaryPlan } from "./salary-plan";

export interface SalaryAutomationInput {
  readonly asOf?: Date;
  readonly createdBy?: string;
}

export interface SalaryAutomationResult {
  readonly ok: boolean;
  readonly ranAt: string;
  readonly distribution: SalaryDistributionResult | null;
  readonly error?: string;
}

export type SerializedSalaryAutomationResult = Omit<
  SalaryAutomationResult,
  "distribution"
> & {
  readonly distribution:
    | (Omit<SalaryDistributionResult, "totalPaidPaisa"> & {
        readonly totalPaidPaisa: string;
      })
    | null;
};

/** BigInt values cannot be serialized by `Response.json`, so expose paisa as a string. */
export function serializeSalaryAutomationResult(
  result: SalaryAutomationResult,
): SerializedSalaryAutomationResult {
  return {
    ...result,
    distribution: result.distribution
      ? {
          ...result.distribution,
          totalPaidPaisa: result.distribution.totalPaidPaisa.toString(),
        }
      : null,
  };
}

function errorCode(error: unknown): string {
  return error instanceof Error ? error.message : "UNKNOWN_ERROR";
}

/**
 * Idempotent automation entry point. The Sunday 00:00 BDT distribution is
 * derived from `asOf`, so late or repeated runs never pay the same week twice.
 */
export async function runSalaryAutomation(
  input: SalaryAutomationInput = {},
): Promise<SalaryAutomationResult> {
  const ranAt = new Date();
  try {
    const salaryPlan = await getActiveSalaryPlan(prisma);
    const distribution = await runSalaryDistribution(
      prisma,
      {
        asOf: input.asOf ?? ranAt,
        createdBy: input.createdBy,
      },
      salaryPlan,
    );
    await writeAuditLog({
      actorId: input.createdBy ?? null,
      actorRole: input.createdBy ? "ADMIN" : null,
      action: "SALARY_AUTOMATION",
      entityType: "SalaryDistribution",
      entityId: distribution.distributionId ?? undefined,
      after: {
        applied: distribution.applied,
        reason: distribution.reason ?? null,
        weekEndAt: distribution.weekEndAt,
        totalPaidPaisa: distribution.totalPaidPaisa.toString(),
        recipientCount: distribution.recipientCount,
        failedCount: distribution.failedCount,
      },
    });
    return { ok: true, ranAt: ranAt.toISOString(), distribution };
  } catch (error) {
    const code = errorCode(error);
    await writeAuditLog({
      actorId: input.createdBy ?? null,
      actorRole: input.createdBy ? "ADMIN" : null,
      action: "SALARY_AUTOMATION_FAILED",
      entityType: "SalaryDistribution",
      after: { error: code },
    });
    return { ok: false, ranAt: ranAt.toISOString(), distribution: null, error: code };
  }
}
