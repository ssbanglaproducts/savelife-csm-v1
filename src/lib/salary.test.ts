import { describe, expect, it } from "vitest";
import { spToPaisa } from "./money";
import {
  DEFAULT_SALARY_PLAN,
  enabledSalaryRankKeys,
  isSalaryRankEnabled,
  latestSalaryBoundary,
  planSalaryAllocations,
  planSalaryPayments,
  SALARY_RANK_CONFIG,
  SALARY_RANK_KEYS,
  salaryPeriodFor,
  salaryReceivedTotals,
  salaryWeeksProgress,
  shouldReplaceEntitlement,
  TOTAL_SALARY_ALLOCATION_BPS,
} from "./salary";

describe("salary configuration", () => {
  it("defines nine salary treasuries with 9.5% total, R1 disabled by default", () => {
    expect(SALARY_RANK_KEYS).toHaveLength(9);
    expect(TOTAL_SALARY_ALLOCATION_BPS).toBe(950);
    expect((SALARY_RANK_KEYS as readonly string[]).includes("R1")).toBe(true);
    expect(enabledSalaryRankKeys()).toEqual([
      "R2",
      "R3",
      "R4",
      "R5",
      "R6",
      "R7",
      "R8",
      "R9",
    ]);
    expect(isSalaryRankEnabled(SALARY_RANK_CONFIG.R1)).toBe(false);
    expect(SALARY_RANK_CONFIG.R1.maxWeeks).toBeNull();
  });

  it("disables a rank when either allocation or weekly cap is zero", () => {
    const withoutAllocation = {
      ...SALARY_RANK_CONFIG.R2,
      allocationBps: 0,
    };
    const withoutCap = {
      ...SALARY_RANK_CONFIG.R2,
      maxWeeklySalaryPaisa: 0n as typeof SALARY_RANK_CONFIG.R2.maxWeeklySalaryPaisa,
    };
    expect(isSalaryRankEnabled(withoutAllocation)).toBe(false);
    expect(isSalaryRankEnabled(withoutCap)).toBe(false);
    expect(
      enabledSalaryRankKeys({
        ...DEFAULT_SALARY_PLAN,
        configs: {
          ...SALARY_RANK_CONFIG,
          R1: {
            ...SALARY_RANK_CONFIG.R1,
            isEnabled: true,
            allocationBps: 100,
            maxWeeklySalaryPaisa: spToPaisa("1000"),
          },
        },
      }),
    ).toContain("R1");
  });

  it("locks the weekly caps and durations", () => {
    expect(SALARY_RANK_CONFIG.R2.maxWeeklySalaryPaisa).toBe(spToPaisa("10000"));
    expect(SALARY_RANK_CONFIG.R2.maxWeeks).toBe(12);
    expect(SALARY_RANK_CONFIG.R3.maxWeeklySalaryPaisa).toBe(spToPaisa("25000"));
    expect(SALARY_RANK_CONFIG.R3.maxWeeks).toBe(16);
    expect(SALARY_RANK_CONFIG.R4.maxWeeklySalaryPaisa).toBe(spToPaisa("35000"));
    expect(SALARY_RANK_CONFIG.R4.maxWeeks).toBe(24);
    expect(SALARY_RANK_CONFIG.R5.maxWeeklySalaryPaisa).toBe(spToPaisa("100000"));
    expect(SALARY_RANK_CONFIG.R5.maxWeeks).toBe(36);
    expect(SALARY_RANK_CONFIG.R6.maxWeeklySalaryPaisa).toBe(spToPaisa("200000"));
    expect(SALARY_RANK_CONFIG.R6.maxWeeks).toBe(48);
    for (const key of ["R7", "R8", "R9"] as const) {
      expect(SALARY_RANK_CONFIG[key].maxWeeks).toBeNull();
    }
  });

  it("allocates the documented example for a 100,000 SP investment", () => {
    const allocations = planSalaryAllocations(spToPaisa("100000"));
    expect(allocations).toEqual({
      R1: 0n,
      R2: spToPaisa("2000"),
      R3: spToPaisa("1500"),
      R4: spToPaisa("1250"),
      R5: spToPaisa("1250"),
      R6: spToPaisa("1000"),
      R7: spToPaisa("1000"),
      R8: spToPaisa("1000"),
      R9: spToPaisa("500"),
    });
    expect(Object.values(allocations).reduce((sum, value) => sum + value, 0n)).toBe(
      spToPaisa("9500"),
    );
  });

  it("uses active plan values instead of static defaults when provided", () => {
    const plan = {
      ...DEFAULT_SALARY_PLAN,
      version: 2,
      configs: {
        ...SALARY_RANK_CONFIG,
        R1: {
          ...SALARY_RANK_CONFIG.R1,
          isEnabled: true,
          allocationBps: 50,
          maxWeeklySalaryPaisa: spToPaisa("5000"),
        },
        R2: { ...SALARY_RANK_CONFIG.R2, allocationBps: 0 },
      },
    };
    const allocations = planSalaryAllocations(spToPaisa("100000"), plan);
    expect(allocations.R1).toBe(spToPaisa("500"));
    expect(allocations.R2).toBe(0n);
    expect(enabledSalaryRankKeys(plan)).toContain("R1");
    expect(enabledSalaryRankKeys(plan)).not.toContain("R2");
  });
});

describe("salary weeks progress", () => {
  it("fills the bar from paid weeks and reports the remainder", () => {
    expect(salaryWeeksProgress(3, 12)).toEqual({ percent: 25, remaining: 9 });
    expect(salaryWeeksProgress(12, 12)).toEqual({ percent: 100, remaining: 0 });
  });

  it("caps overpayments and keeps the display safe", () => {
    expect(salaryWeeksProgress(15, 12)).toEqual({ percent: 100, remaining: 0 });
    expect(salaryWeeksProgress(-2, 12)).toEqual({ percent: 0, remaining: 12 });
  });

  it("marks ongoing entitlements as full with no remaining count", () => {
    expect(salaryWeeksProgress(0, null)).toEqual({ percent: 100, remaining: null });
  });
});

describe("salary received totals", () => {
  const now = new Date("2026-11-26T12:00:00.000Z");

  it("reports the latest payment and the Bangladesh-month total", () => {
    const totals = salaryReceivedTotals(
      [
        { amountPaisa: 100n, createdAt: new Date("2026-11-25T14:00:00.000Z") },
        { amountPaisa: 250n, createdAt: new Date("2026-11-20T14:00:00.000Z") },
        { amountPaisa: 400n, createdAt: new Date("2026-10-20T14:00:00.000Z") },
      ],
      now,
    );
    expect(totals).toEqual({ lastWeekPaisa: 100n, thisMonthPaisa: 350n });
  });

  it("uses calendar month boundaries in Asia/Dhaka", () => {
    const totals = salaryReceivedTotals(
      [
        { amountPaisa: 100n, createdAt: new Date("2026-10-31T17:59:00.000Z") },
        { amountPaisa: 200n, createdAt: new Date("2026-10-31T18:00:00.000Z") },
      ],
      now,
    );
    expect(totals.thisMonthPaisa).toBe(200n);
  });

  it("handles unsorted and empty payment history safely", () => {
    expect(salaryReceivedTotals([], now)).toEqual({ lastWeekPaisa: 0n, thisMonthPaisa: 0n });
    expect(
      salaryReceivedTotals(
        [
          { amountPaisa: 50n, createdAt: new Date("2026-11-20T00:00:00.000Z") },
          { amountPaisa: 90n, createdAt: new Date("2026-11-24T00:00:00.000Z") },
        ],
        now,
      ).lastWeekPaisa,
    ).toBe(90n);
  });
});

describe("weekly salary calculation", () => {
  it("caps payment at the maximum when the treasury has more than required", () => {
    const plan = planSalaryPayments(spToPaisa("300000"), 20, spToPaisa("10000"));
    expect(plan.amounts).toHaveLength(20);
    expect(plan.amounts[0]).toBe(spToPaisa("10000"));
    expect(plan.totalPaidPaisa).toBe(spToPaisa("200000"));
    expect(plan.remainingPaisa).toBe(spToPaisa("100000"));
    expect(plan.capped).toBe(true);
  });

  it("distributes the full balance equally when it is below the cap", () => {
    const plan = planSalaryPayments(spToPaisa("100000"), 20, spToPaisa("10000"));
    expect(plan.amounts).toHaveLength(20);
    expect(plan.amounts.every((amount) => amount === spToPaisa("5000"))).toBe(true);
    expect(plan.totalPaidPaisa).toBe(spToPaisa("100000"));
    expect(plan.remainingPaisa).toBe(0n);
    expect(plan.capped).toBe(false);
  });

  it("keeps the whole balance when there are no eligible members", () => {
    const plan = planSalaryPayments(spToPaisa("50000"), 0, spToPaisa("10000"));
    expect(plan.amounts).toEqual([]);
    expect(plan.totalPaidPaisa).toBe(0n);
    expect(plan.remainingPaisa).toBe(spToPaisa("50000"));
  });

  it("never pays more than the available treasury", () => {
    const plan = planSalaryPayments(123n, 10, spToPaisa("10000"));
    expect(plan.totalPaidPaisa).toBe(123n);
    expect(plan.remainingPaisa).toBe(0n);
    expect(plan.amounts.reduce((sum, value) => sum + value, 0n)).toBe(123n);
  });
});

describe("promotion replacement", () => {
  it("only lets a higher rank replace the active entitlement", () => {
    expect(shouldReplaceEntitlement(null, 2)).toBe(true);
    expect(shouldReplaceEntitlement(2, 3)).toBe(true);
    expect(shouldReplaceEntitlement(3, 2)).toBe(false);
    expect(shouldReplaceEntitlement(3, 3)).toBe(false);
  });
});

describe("Bangladesh weekly boundary", () => {
  it("uses Sunday 00:00 BDT as Saturday 18:00 UTC", () => {
    // 2026-11-29 00:00 Asia/Dhaka == 2026-11-28 18:00 UTC.
    expect(latestSalaryBoundary(new Date("2026-11-28T18:00:00.000Z")).toISOString()).toBe(
      "2026-11-28T18:00:00.000Z",
    );
  });

  it("closes the previous Sunday-to-Sunday week at the boundary", () => {
    const period = salaryPeriodFor(new Date("2026-11-28T18:00:00.000Z"));
    expect(period.end.toISOString()).toBe("2026-11-28T18:00:00.000Z");
    expect(period.start.toISOString()).toBe("2026-11-21T18:00:00.000Z");
  });

  it("uses the same in-progress week boundary throughout Saturday", () => {
    const boundary = salaryPeriodFor(new Date("2026-11-28T06:00:00.000Z")).end;
    expect(boundary.toISOString()).toBe("2026-11-21T18:00:00.000Z");
  });
});
