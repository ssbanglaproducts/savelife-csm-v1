import { applyBps, allocateProportionally, type Paisa } from "./money";

/**
 * Stable salary rank keys. Every rank has a configurable treasury. By default
 * R1 is disabled at 0% / 0 cap, but an admin can enable it like any other rank.
 */
export const SALARY_RANK_KEYS = [
  "R1",
  "R2",
  "R3",
  "R4",
  "R5",
  "R6",
  "R7",
  "R8",
  "R9",
] as const;
export type SalaryRankKey = (typeof SALARY_RANK_KEYS)[number];

export type SalaryRankConfig = {
  readonly rankKey: SalaryRankKey;
  readonly sortOrder: number;
  /** Admin-controlled toggle. Disabled ranks retain all historical records. */
  readonly isEnabled: boolean;
  readonly defaultName: string;
  readonly defaultNameBn: string;
  /** Basis points of each eligible investment assigned to this treasury. */
  readonly allocationBps: number;
  /** Hard weekly cap. Never a guaranteed payment. */
  readonly maxWeeklySalaryPaisa: Paisa;
  /** null means ongoing. */
  readonly maxWeeks: number | null;
};

function sp(value: string): Paisa {
  return (BigInt(value) * 100n) as Paisa;
}

/** Default salary configuration. The active values live in SalaryPlanVersion. */
export const SALARY_RANK_CONFIG: Readonly<Record<SalaryRankKey, SalaryRankConfig>> = {
  R1: {
    rankKey: "R1",
    sortOrder: 1,
    isEnabled: false,
    defaultName: "1 Star",
    defaultNameBn: "১ স্টার",
    allocationBps: 0,
    maxWeeklySalaryPaisa: sp("0"),
    maxWeeks: null,
  },
  R2: {
    rankKey: "R2",
    sortOrder: 2,
    isEnabled: true,
    defaultName: "2 Star",
    defaultNameBn: "২ স্টার",
    allocationBps: 200,
    maxWeeklySalaryPaisa: sp("10000"),
    maxWeeks: 12,
  },
  R3: {
    rankKey: "R3",
    sortOrder: 3,
    isEnabled: true,
    defaultName: "3 Star",
    defaultNameBn: "৩ স্টার",
    allocationBps: 150,
    maxWeeklySalaryPaisa: sp("25000"),
    maxWeeks: 16,
  },
  R4: {
    rankKey: "R4",
    sortOrder: 4,
    isEnabled: true,
    defaultName: "4 Star",
    defaultNameBn: "৪ স্টার",
    allocationBps: 125,
    maxWeeklySalaryPaisa: sp("35000"),
    maxWeeks: 24,
  },
  R5: {
    rankKey: "R5",
    sortOrder: 5,
    isEnabled: true,
    defaultName: "5 Star",
    defaultNameBn: "৫ স্টার",
    allocationBps: 125,
    maxWeeklySalaryPaisa: sp("100000"),
    maxWeeks: 36,
  },
  R6: {
    rankKey: "R6",
    sortOrder: 6,
    isEnabled: true,
    defaultName: "6 Star",
    defaultNameBn: "৬ স্টার",
    allocationBps: 100,
    maxWeeklySalaryPaisa: sp("200000"),
    maxWeeks: 48,
  },
  R7: {
    rankKey: "R7",
    sortOrder: 7,
    isEnabled: true,
    defaultName: "7 Star",
    defaultNameBn: "৭ স্টার",
    allocationBps: 100,
    maxWeeklySalaryPaisa: sp("300000"),
    maxWeeks: null,
  },
  R8: {
    rankKey: "R8",
    sortOrder: 8,
    isEnabled: true,
    defaultName: "Board Member",
    defaultNameBn: "বোর্ড সদস্য",
    allocationBps: 100,
    maxWeeklySalaryPaisa: sp("400000"),
    maxWeeks: null,
  },
  R9: {
    rankKey: "R9",
    sortOrder: 9,
    isEnabled: true,
    defaultName: "Vice Chairman",
    defaultNameBn: "ভাইস চেয়ারম্যান",
    allocationBps: 50,
    maxWeeklySalaryPaisa: sp("500000"),
    maxWeeks: null,
  },
};

/** 950 bps = 9.5%. R1 contributes nothing by default. */
export const TOTAL_SALARY_ALLOCATION_BPS = SALARY_RANK_KEYS.reduce(
  (total, rankKey) => total + SALARY_RANK_CONFIG[rankKey].allocationBps,
  0,
);

export function isSalaryRankKey(value: string): value is SalaryRankKey {
  return (SALARY_RANK_KEYS as readonly string[]).includes(value);
}

export type SalaryPlan = {
  readonly version: number | null;
  readonly versionId: string | null;
  readonly configs: Readonly<Record<SalaryRankKey, SalaryRankConfig>>;
};

/** Used only as a fallback for pure helpers and tests. Runtime uses the DB plan. */
export const DEFAULT_SALARY_PLAN: SalaryPlan = {
  version: null,
  versionId: null,
  configs: SALARY_RANK_CONFIG,
};

/**
 * A rank is payable only when its admin toggle is on and both its allocation
 * and weekly cap are positive. Disabled ranks keep their values and history.
 */
export function isSalaryRankEnabled(config: SalaryRankConfig): boolean {
  return (
    config.isEnabled && config.allocationBps > 0 && config.maxWeeklySalaryPaisa > 0n
  );
}

export function enabledSalaryRankKeys(
  plan: SalaryPlan = DEFAULT_SALARY_PLAN,
): readonly SalaryRankKey[] {
  return SALARY_RANK_KEYS.filter((rankKey) =>
    isSalaryRankEnabled(plan.configs[rankKey]),
  );
}

export function totalSalaryAllocationBps(plan: SalaryPlan = DEFAULT_SALARY_PLAN): number {
  return SALARY_RANK_KEYS.reduce(
    (total, rankKey) => total + plan.configs[rankKey].allocationBps,
    0,
  );
}

export type SalaryWeeksProgress = {
  /** Ongoing ranks have no finite duration, so their entitlement is full. */
  readonly percent: number;
  readonly remaining: number | null;
};

/** Presentation helper for the dashboard salary bar; never changes payments. */
export function salaryWeeksProgress(
  weeksPaid: number,
  maxWeeks: number | null,
): SalaryWeeksProgress {
  const paid = Number.isFinite(weeksPaid) ? Math.max(0, Math.trunc(weeksPaid)) : 0;

  if (maxWeeks === null) return { percent: 100, remaining: null };

  const total = Number.isFinite(maxWeeks) ? Math.max(0, Math.trunc(maxWeeks)) : 0;
  if (total === 0) return { percent: 0, remaining: 0 };

  return {
    percent: Math.min(100, Math.round((paid * 100) / total)),
    remaining: Math.max(0, total - paid),
  };
}

/** Salary allocations for one eligible investment, keyed by stable rank. */
export function planSalaryAllocations(
  amountPaisa: Paisa,
  plan: SalaryPlan = DEFAULT_SALARY_PLAN,
): Readonly<Record<SalaryRankKey, Paisa>> {
  if (amountPaisa < 0n) throw new Error("Investment amount cannot be negative");
  return Object.fromEntries(
    SALARY_RANK_KEYS.map((rankKey) => [
      rankKey,
      applyBps(amountPaisa, plan.configs[rankKey].allocationBps),
    ]),
  ) as Record<SalaryRankKey, Paisa>;
}

export type SalaryPaymentPlan = {
  readonly amounts: readonly Paisa[];
  readonly totalPaidPaisa: Paisa;
  readonly remainingPaisa: Paisa;
  readonly capped: boolean;
};

/**
 * Equal share per eligible member, capped at the rank's weekly maximum.
 * Integer paisa remainders are distributed with the largest-remainder method
 * so an uncapped treasury is fully paid out; a capped treasury keeps its
 * excess for the same rank.
 */
export function planSalaryPayments(
  treasuryPaisa: Paisa,
  eligibleMembers: number,
  maxWeeklySalaryPaisa: Paisa,
): SalaryPaymentPlan {
  if (treasuryPaisa < 0n) throw new Error("Treasury balance cannot be negative");
  if (!Number.isInteger(eligibleMembers) || eligibleMembers < 0) {
    throw new Error("Eligible member count must be a non-negative integer");
  }
  if (maxWeeklySalaryPaisa <= 0n) throw new Error("Weekly salary cap must be positive");
  if (eligibleMembers === 0 || treasuryPaisa === 0n) {
    return { amounts: [], totalPaidPaisa: 0n, remainingPaisa: treasuryPaisa, capped: false };
  }

  const capTotal = maxWeeklySalaryPaisa * BigInt(eligibleMembers);
  if (treasuryPaisa > capTotal) {
    return {
      amounts: Array.from({ length: eligibleMembers }, () => maxWeeklySalaryPaisa),
      totalPaidPaisa: capTotal,
      remainingPaisa: treasuryPaisa - capTotal,
      capped: true,
    };
  }

  const amounts = allocateProportionally(
    treasuryPaisa,
    Array.from({ length: eligibleMembers }, () => 1n as Paisa),
  );
  return {
    amounts,
    totalPaidPaisa: treasuryPaisa,
    remainingPaisa: 0n,
    capped: false,
  };
}

/**
 * A rank promotion replaces the previous entitlement. A lower or equal rank
 * never replaces an already active higher rank.
 */
export function shouldReplaceEntitlement(
  currentRankSortOrder: number | null,
  newRankSortOrder: number,
): boolean {
  return currentRankSortOrder === null || newRankSortOrder > currentRankSortOrder;
}

const BDT_OFFSET_MS = 6 * 60 * 60 * 1000;
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/** Sunday 00:00 Asia/Dhaka expressed as UTC, at or before `date`. */
export function latestSalaryBoundary(date: Date): Date {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    throw new Error("A valid date is required");
  }
  const bdt = new Date(date.getTime() + BDT_OFFSET_MS);
  const daysSinceSunday = bdt.getUTCDay();
  const bdtMidnight = Date.UTC(
    bdt.getUTCFullYear(),
    bdt.getUTCMonth(),
    bdt.getUTCDate() - daysSinceSunday,
  );
  return new Date(bdtMidnight - BDT_OFFSET_MS);
}

/**
 * The week being paid at the next Sunday 00:00 BDT boundary. The boundary at
 * `date` itself closes the previous Sunday-to-Sunday period.
 */
export function salaryPeriodFor(date: Date): { start: Date; end: Date } {
  const end = latestSalaryBoundary(date);
  return { start: new Date(end.getTime() - WEEK_MS), end };
}

/** The next Sunday 00:00 BDT boundary after `date`. */
export function nextSalaryBoundary(date: Date): Date {
  return new Date(latestSalaryBoundary(date).getTime() + WEEK_MS);
}

export type SalaryReceivedTotals = {
  /** The most recent successful weekly payment. */
  readonly lastWeekPaisa: bigint;
  /** All successful payments inside the current Asia/Dhaka calendar month. */
  readonly thisMonthPaisa: bigint;
};

/**
 * Dashboard-only summary of already-successful payments. It never changes
 * entitlements, wallet balances, or distribution totals.
 */
export function salaryReceivedTotals(
  payments: readonly { readonly amountPaisa: bigint; readonly createdAt: Date }[],
  now: Date = new Date(),
): SalaryReceivedTotals {
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) {
    throw new Error("A valid date is required");
  }

  const bdtNow = new Date(now.getTime() + BDT_OFFSET_MS);
  const monthStartMs =
    Date.UTC(bdtNow.getUTCFullYear(), bdtNow.getUTCMonth(), 1) - BDT_OFFSET_MS;
  let lastWeekPaisa = 0n;
  let latestPaymentMs = Number.NEGATIVE_INFINITY;
  let thisMonthPaisa = 0n;

  for (const payment of payments) {
    const paidAtMs = payment.createdAt.getTime();
    if (Number.isNaN(paidAtMs)) continue;

    if (paidAtMs > latestPaymentMs) {
      latestPaymentMs = paidAtMs;
      lastWeekPaisa = payment.amountPaisa;
    }
    if (paidAtMs >= monthStartMs && paidAtMs <= now.getTime()) {
      thisMonthPaisa += payment.amountPaisa;
    }
  }

  return { lastWeekPaisa, thisMonthPaisa };
}

/** UTC cron expression for Sunday 00:00 Bangladesh time (Saturday 18:00 UTC). */
export const SALARY_CRON_SCHEDULE_UTC = "0 18 * * 6";
