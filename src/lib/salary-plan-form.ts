import type {
  SalaryPlanChangeDto,
  SalaryPlanDto,
  SalaryPlanRankDto,
} from "./services/salary-plan";

export type SalaryPlanValidationIssue =
  | "allocationFormat"
  | "allocationExceeded"
  | "enabledNeedsAllocation"
  | "enabledNeedsCap"
  | "capFormat"
  | "weeksFormat"
  | "effectiveDate";

export type SalaryPlanValidation = {
  totalBps: number;
  remainingBps: number;
  issues: readonly SalaryPlanValidationIssue[];
  valid: boolean;
};

const PERCENT_PATTERN = /^\d{1,3}(\.\d{1,2})?$/;
const AMOUNT_PATTERN = /^\d+(\.\d{1,2})?$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const BDT_DATE_FORMAT = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Dhaka",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export function percentToBps(value: string): number | null {
  const normalized = value.trim();
  if (!PERCENT_PATTERN.test(normalized)) return null;
  const [whole = "0", fraction = ""] = normalized.split(".");
  return Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
}

export function isValidEffectiveDate(value: string): boolean {
  const normalized = value.trim();
  if (!DATE_PATTERN.test(normalized)) return false;
  const parsed = new Date(`${normalized}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === normalized;
}

/** Converts any stored/effective date string to its Bangladesh calendar day. */
export function salaryPlanDate(value: string | null | undefined): string {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value.slice(0, 10);
  return BDT_DATE_FORMAT.format(parsed);
}

/** Server and client share the same rules before a plan version can be committed. */
export function validateSalaryPlanDraft(
  rows: readonly SalaryPlanRankDto[],
  effectiveFrom: string,
): SalaryPlanValidation {
  const issues = new Set<SalaryPlanValidationIssue>();
  let totalBps = 0;

  if (!isValidEffectiveDate(effectiveFrom)) issues.add("effectiveDate");

  for (const row of rows) {
    const allocationBps = percentToBps(row.allocationPercent);
    if (allocationBps === null) {
      issues.add("allocationFormat");
    } else {
      totalBps += allocationBps;
      if (row.isEnabled && allocationBps === 0) issues.add("enabledNeedsAllocation");
    }

    const cap = row.maxWeeklySalary.trim();
    if (!AMOUNT_PATTERN.test(cap)) {
      issues.add("capFormat");
    } else if (row.isEnabled && Number.parseFloat(cap) <= 0) {
      issues.add("enabledNeedsCap");
    }

    if (row.maxWeeks !== null && !/^\d+$/.test(row.maxWeeks.trim())) {
      issues.add("weeksFormat");
    } else if (row.maxWeeks !== null && Number.parseInt(row.maxWeeks, 10) < 1) {
      issues.add("weeksFormat");
    }
  }

  if (totalBps > 10000) issues.add("allocationExceeded");

  return {
    totalBps,
    remainingBps: Math.max(0, 10000 - totalBps),
    issues: [...issues],
    valid: issues.size === 0,
  };
}

function durationValue(value: string | null): string {
  return value === null || value.trim() === "" || value.trim() === "0" ? "ongoing" : value.trim();
}

function dateValue(value: string | null): string {
  return salaryPlanDate(value);
}

/**
 * Emits only real differences between two plan snapshots. Used in the review
 * dialog and stored server-side with the committed version.
 */
export function buildSalaryPlanDiff(
  current: SalaryPlanDto,
  proposed: SalaryPlanDto,
): readonly SalaryPlanChangeDto[] {
  const changes: SalaryPlanChangeDto[] = [];
  const currentByKey = new Map(current.ranks.map((row) => [row.rankKey, row]));
  const proposedByKey = new Map(proposed.ranks.map((row) => [row.rankKey, row]));

  for (const after of proposed.ranks) {
    const before = currentByKey.get(after.rankKey);
    if (!before) continue;
    const rankLabel = after.name || after.defaultName || after.rankKey;

    if (before.isEnabled !== after.isEnabled) {
      changes.push({
        id: `${after.rankKey}:isEnabled`,
        scope: "rank",
        rankKey: after.rankKey,
        rankLabel,
        settingKey: "isEnabled",
        previous: String(before.isEnabled),
        next: String(after.isEnabled),
      });
    }
    if (before.allocationPercent.trim() !== after.allocationPercent.trim()) {
      changes.push({
        id: `${after.rankKey}:allocation`,
        scope: "rank",
        rankKey: after.rankKey,
        rankLabel,
        settingKey: "allocation",
        previous: before.allocationPercent.trim(),
        next: after.allocationPercent.trim(),
      });
    }
    if (before.maxWeeklySalary.trim() !== after.maxWeeklySalary.trim()) {
      changes.push({
        id: `${after.rankKey}:weeklyCap`,
        scope: "rank",
        rankKey: after.rankKey,
        rankLabel,
        settingKey: "weeklyCap",
        previous: before.maxWeeklySalary.trim(),
        next: after.maxWeeklySalary.trim(),
      });
    }
    if (durationValue(before.maxWeeks) !== durationValue(after.maxWeeks)) {
      changes.push({
        id: `${after.rankKey}:duration`,
        scope: "rank",
        rankKey: after.rankKey,
        rankLabel,
        settingKey: "duration",
        previous: durationValue(before.maxWeeks),
        next: durationValue(after.maxWeeks),
      });
    }
  }

  for (const before of current.ranks) {
    if (!proposedByKey.has(before.rankKey)) {
      const rankLabel = before.name || before.defaultName || before.rankKey;
      changes.push({
        id: `${before.rankKey}:missing`,
        scope: "rank",
        rankKey: before.rankKey,
        rankLabel,
        settingKey: "isEnabled",
        previous: String(before.isEnabled),
        next: "false",
      });
    }
  }

  if (dateValue(current.effectiveFrom) !== dateValue(proposed.effectiveFrom)) {
    changes.push({
      id: "plan:effectiveFrom",
      scope: "plan",
      rankKey: "PLAN",
      rankLabel: "",
      settingKey: "effectiveFrom",
      previous: dateValue(current.effectiveFrom),
      next: dateValue(proposed.effectiveFrom),
    });
  }

  return changes;
}
