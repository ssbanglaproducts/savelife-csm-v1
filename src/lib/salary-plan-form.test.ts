import { describe, expect, it } from "vitest";
import { DEFAULT_SALARY_PLAN } from "./salary";
import {
  buildSalaryPlanDiff,
  percentToBps,
  salaryPlanDate,
  validateSalaryPlanDraft,
} from "./salary-plan-form";
import { serializeSalaryPlan, type SalaryPlanDto } from "./services/salary-plan";

const EFFECTIVE_DATE = "2026-12-06";

function currentDto(): SalaryPlanDto {
  return serializeSalaryPlan(DEFAULT_SALARY_PLAN, {
    effectiveFrom: new Date("2026-11-01T00:00:00.000Z"),
  });
}

describe("salary plan draft validation", () => {
  it("accepts the current plan with its 9.5% allocation", () => {
    const result = validateSalaryPlanDraft(currentDto().ranks, EFFECTIVE_DATE);

    expect(result).toMatchObject({
      totalBps: 950,
      remainingBps: 9050,
      valid: true,
    });
    expect(result.issues).toEqual([]);
  });

  it("rejects totals above 100%", () => {
    const ranks = currentDto().ranks.map((row) =>
      row.rankKey === "R2" ? { ...row, allocationPercent: "100" } : row,
    );

    const result = validateSalaryPlanDraft(ranks, EFFECTIVE_DATE);

    expect(result.issues).toContain("allocationExceeded");
    expect(result.valid).toBe(false);
  });

  it("rejects enabled ranks without a positive allocation or cap", () => {
    const ranks = currentDto().ranks.map((row) => {
      if (row.rankKey === "R2") return { ...row, allocationPercent: "0" };
      if (row.rankKey === "R3") return { ...row, maxWeeklySalary: "0" };
      return row;
    });

    const result = validateSalaryPlanDraft(ranks, EFFECTIVE_DATE);

    expect(result.issues).toContain("enabledNeedsAllocation");
    expect(result.issues).toContain("enabledNeedsCap");
  });

  it("validates caps, week counts and the effective date", () => {
    const ranks = currentDto().ranks.map((row) => {
      if (row.rankKey === "R2") return { ...row, maxWeeklySalary: "10.123" };
      if (row.rankKey === "R3") return { ...row, maxWeeks: "0" };
      return row;
    });

    const result = validateSalaryPlanDraft(ranks, "2026-02-30");

    expect(result.issues).toEqual(
      expect.arrayContaining(["capFormat", "weeksFormat", "effectiveDate"]),
    );
  });

  it("converts percentage strings to basis points", () => {
    expect(percentToBps("9.5")).toBe(950);
    expect(percentToBps("0.75")).toBe(75);
    expect(percentToBps("100")).toBe(10000);
    expect(percentToBps("10.123")).toBeNull();
  });
});

describe("salary plan diff", () => {
  it("emits only changed settings", () => {
    const before = currentDto();
    const after: SalaryPlanDto = {
      ...before,
      ranks: before.ranks.map((row) =>
        row.rankKey === "R2" ? { ...row, allocationPercent: "2.5" } : row,
      ),
    };

    const changes = buildSalaryPlanDiff(before, after);

    expect(changes).toHaveLength(1);
    expect(changes[0]).toMatchObject({
      rankKey: "R2",
      settingKey: "allocation",
      previous: "2",
      next: "2.5",
    });
  });

  it("records enable, cap, duration and effective date changes", () => {
    const before = currentDto();
    const after: SalaryPlanDto = {
      ...before,
      effectiveFrom: `${EFFECTIVE_DATE}T00:00:00+06:00`,
      ranks: before.ranks.map((row) => {
        if (row.rankKey === "R1") return { ...row, isEnabled: true };
        if (row.rankKey === "R2") return { ...row, maxWeeklySalary: "12000" };
        if (row.rankKey === "R3") return { ...row, maxWeeks: null };
        return row;
      }),
    };

    const changes = buildSalaryPlanDiff(before, after);

    expect(changes.map((change) => `${change.rankKey}:${change.settingKey}`)).toEqual([
      "R1:isEnabled",
      "R2:weeklyCap",
      "R3:duration",
      "PLAN:effectiveFrom",
    ]);
  });

  it("returns no changes for an identical plan", () => {
    const before = currentDto();
    const after: SalaryPlanDto = {
      ...before,
      ranks: before.ranks.map((row) => ({ ...row })),
    };

    expect(buildSalaryPlanDiff(before, after)).toEqual([]);
  });

  it("does not report a timezone-only effective date change", () => {
    const before = currentDto();
    const after: SalaryPlanDto = {
      ...before,
      effectiveFrom: "2026-10-31T18:00:00.000Z",
      ranks: before.ranks.map((row) => ({ ...row })),
    };

    expect(salaryPlanDate(before.effectiveFrom)).toBe("2026-11-01");
    expect(salaryPlanDate(after.effectiveFrom)).toBe("2026-11-01");
    expect(buildSalaryPlanDiff(before, after)).toEqual([]);
  });
});
