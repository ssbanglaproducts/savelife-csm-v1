import { allocateProportionally, sumPaisa, type Paisa } from "../money";
import { invalidInput } from "./errors";

/** 1,000 SP expressed in paisa. */
export const PAISA_PER_THOUSAND_SP = 100_000n;

export interface ProfitEligibleInvestment {
  readonly investmentId: string;
  readonly memberId: string;
  readonly eligiblePaisa: Paisa;
}

export interface ProfitDistributionLineCalculation {
  readonly investmentId: string;
  readonly memberId: string;
  readonly eligiblePaisa: Paisa;
  readonly allocatedPaisa: Paisa;
  /** Allocation minus the amount implied by the floored per-1,000 SP rate. */
  readonly roundingAdjustmentPaisa: Paisa;
}

export interface ProfitDistributionCalculation {
  readonly distributablePaisa: Paisa;
  readonly totalEligiblePaisa: Paisa;
  readonly profitPerThousandPaisa: Paisa;
  readonly lines: readonly ProfitDistributionLineCalculation[];
}

/** Paisa earned per 1,000 SP of eligible investment (floored, display rate). */
export function computeProfitPerThousandPaisa(
  distributablePaisa: Paisa,
  totalEligiblePaisa: Paisa,
): Paisa {
  if (distributablePaisa < 0n) throw invalidInput("Distributable profit cannot be negative");
  if (totalEligiblePaisa <= 0n) throw invalidInput("Total eligible amount must be positive");
  return (distributablePaisa * PAISA_PER_THOUSAND_SP) / totalEligiblePaisa;
}

/** Amount implied by the displayed per-1,000 SP rate before remainder rounding. */
export function profitForEligiblePaisa(
  eligiblePaisa: Paisa,
  profitPerThousandPaisa: Paisa,
): Paisa {
  if (eligiblePaisa < 0n) throw invalidInput("Eligible amount cannot be negative");
  if (profitPerThousandPaisa < 0n) {
    throw invalidInput("Profit per thousand cannot be negative");
  }
  return (eligiblePaisa * profitPerThousandPaisa) / PAISA_PER_THOUSAND_SP;
}

/**
 * Allocates actual distributable profit with the largest-remainder method.
 * The sum of all allocations is always exactly `distributablePaisa`; the
 * per-1,000 SP figure is derived for reporting and never used to cap the total.
 */
export function calculateMonthlyProfitDistribution(
  distributablePaisa: Paisa,
  eligible: readonly ProfitEligibleInvestment[],
): ProfitDistributionCalculation {
  if (distributablePaisa < 0n) throw invalidInput("Distributable profit cannot be negative");
  if (eligible.length === 0) throw invalidInput("At least one eligible investment is required");
  const seenInvestmentIds = new Set<string>();
  for (const entry of eligible) {
    if (entry.eligiblePaisa < 0n) throw invalidInput("Eligible amount cannot be negative");
    if (seenInvestmentIds.has(entry.investmentId)) {
      throw invalidInput(`Duplicate eligible investment: ${entry.investmentId}`);
    }
    seenInvestmentIds.add(entry.investmentId);
  }

  const totalEligiblePaisa = sumPaisa(eligible.map((entry) => entry.eligiblePaisa));
  if (totalEligiblePaisa <= 0n) throw invalidInput("Total eligible amount must be positive");

  const profitPerThousandPaisa = computeProfitPerThousandPaisa(
    distributablePaisa,
    totalEligiblePaisa,
  );
  const allocations = allocateProportionally(
    distributablePaisa,
    eligible.map((entry) => entry.eligiblePaisa),
  );

  const lines = eligible.map((entry, index) => {
    const allocatedPaisa = allocations[index] ?? 0n;
    return {
      investmentId: entry.investmentId,
      memberId: entry.memberId,
      eligiblePaisa: entry.eligiblePaisa,
      allocatedPaisa,
      roundingAdjustmentPaisa:
        allocatedPaisa - profitForEligiblePaisa(entry.eligiblePaisa, profitPerThousandPaisa),
    };
  });

  return {
    distributablePaisa,
    totalEligiblePaisa,
    profitPerThousandPaisa,
    lines,
  };
}

/** Guards the invariant before any wallet or ledger write. */
export function assertDistributionReconciles(
  calculation: ProfitDistributionCalculation,
): void {
  if (sumPaisa(calculation.lines.map((line) => line.allocatedPaisa)) !== calculation.distributablePaisa) {
    throw invalidInput("Profit distribution does not reconcile to distributable profit");
  }
}
