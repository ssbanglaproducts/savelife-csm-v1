import type { Paisa } from "../money";
import {
  isSalaryRankEnabled,
  nextSalaryBoundary,
  planSalaryPayments,
  salaryPeriodFor,
  type SalaryRankConfig,
} from "../salary";

export type SalaryTreasuryMemberState =
  | "eligible"
  | "week-limit-reached"
  | "member-inactive"
  | "rank-disabled";

export type SalaryTreasuryRunMember = {
  readonly entitlementId: string;
  readonly memberRecordId: string;
  readonly memberDisplayId: string;
  readonly memberName: string;
  readonly memberStatus: string;
  readonly weeksPaid: number;
  readonly projectedPaisa: Paisa;
  readonly state: SalaryTreasuryMemberState;
};

export type SalaryTreasuryRun = {
  readonly nextBoundaryAt: Date;
  readonly periodStartAt: Date;
  readonly periodEndAt: Date;
  readonly balancePaisa: Paisa;
  readonly eligibleCount: number;
  readonly projectedTotalPaisa: Paisa;
  readonly capped: boolean;
  readonly members: readonly SalaryTreasuryRunMember[];
};

type TreasuryEntitlement = {
  readonly id: string;
  readonly memberId: string;
  readonly weeksPaid: number;
  readonly member: {
    readonly memberId: string;
    readonly fullName: string;
    readonly status: string;
  };
};

function memberState(
  entitlement: TreasuryEntitlement,
  config: SalaryRankConfig,
  enabled: boolean,
): SalaryTreasuryMemberState {
  if (!enabled) return "rank-disabled";
  if (entitlement.member.status !== "ACTIVE") return "member-inactive";
  if (config.maxWeeks !== null && entitlement.weeksPaid >= config.maxWeeks) {
    return "week-limit-reached";
  }
  return "eligible";
}

/**
 * Read-only projection for the next Sunday 00:00 BDT salary run. It mirrors the
 * distribution service's eligibility and capped split, but never writes.
 */
export function buildSalaryTreasuryRun(input: {
  readonly config: SalaryRankConfig;
  readonly balancePaisa: Paisa;
  readonly entitlements: readonly TreasuryEntitlement[];
  readonly now?: Date;
}): SalaryTreasuryRun {
  const now = input.now ?? new Date();
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) {
    throw new Error("A valid date is required");
  }

  const nextBoundaryAt = nextSalaryBoundary(now);
  const period = salaryPeriodFor(nextBoundaryAt);
  const enabled = isSalaryRankEnabled(input.config);

  const states = input.entitlements.map((entitlement) =>
    memberState(entitlement, input.config, enabled),
  );
  const eligibleIndices = states
    .map((state, index) => (state === "eligible" ? index : -1))
    .filter((index) => index >= 0);

  const allocation = enabled
    ? planSalaryPayments(
        input.balancePaisa,
        eligibleIndices.length,
        input.config.maxWeeklySalaryPaisa,
      )
    : null;
  const projectedByIndex = new Map<number, Paisa>();
  eligibleIndices.forEach((index, eligibleIndex) => {
    projectedByIndex.set(index, allocation?.amounts[eligibleIndex] ?? (0n as Paisa));
  });

  return {
    nextBoundaryAt,
    periodStartAt: period.start,
    periodEndAt: period.end,
    balancePaisa: input.balancePaisa,
    eligibleCount: eligibleIndices.length,
    projectedTotalPaisa: allocation?.totalPaidPaisa ?? (0n as Paisa),
    capped: allocation?.capped ?? false,
    members: input.entitlements.map((entitlement, index) => ({
      entitlementId: entitlement.id,
      memberRecordId: entitlement.memberId,
      memberDisplayId: entitlement.member.memberId,
      memberName: entitlement.member.fullName,
      memberStatus: entitlement.member.status,
      weeksPaid: entitlement.weeksPaid,
      projectedPaisa: projectedByIndex.get(index) ?? (0n as Paisa),
      state: states[index],
    })),
  };
}
