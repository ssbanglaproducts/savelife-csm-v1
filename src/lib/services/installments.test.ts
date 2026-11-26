import { describe, expect, it } from "vitest";
import { sumPaisa, spToPaisa } from "../money";
import { generateInstallmentSchedule } from "./installments";

describe("installment schedule", () => {
  it("returns only the principal across 14 months with exact reconciliation", () => {
    const schedule = generateInstallmentSchedule({
      amountPaisa: spToPaisa("100000"),
      months: 14,
      startDate: new Date("2026-01-31T00:00:00.000Z"),
    });

    expect(schedule.entries).toHaveLength(14);
    expect(schedule.principalPaisa).toBe(spToPaisa("100000"));
    expect(schedule.totalPayablePaisa).toBe(spToPaisa("100000"));
    expect(schedule.monthlyInstallmentPaisa).toBe(714_285n);
    expect(schedule.entries.slice(0, 10).map((entry) => entry.amountPaisa)).toEqual(
      Array.from({ length: 10 }, () => 714_286n),
    );
    expect(schedule.entries.slice(10).map((entry) => entry.amountPaisa)).toEqual(
      Array.from({ length: 4 }, () => 714_285n),
    );
    expect(sumPaisa(schedule.entries.map((entry) => entry.amountPaisa))).toBe(
      spToPaisa("100000"),
    );
  });

  it("uses equal amounts when the principal divides evenly", () => {
    const schedule = generateInstallmentSchedule({
      amountPaisa: spToPaisa("120000"),
      months: 12,
      startDate: new Date("2026-01-01T00:00:00.000Z"),
    });
    expect(schedule.entries.every((entry) => entry.amountPaisa === spToPaisa("10000"))).toBe(
      true,
    );
  });

  it("numbers periods from one and clamps month-end due dates", () => {
    const schedule = generateInstallmentSchedule({
      amountPaisa: 300n,
      months: 3,
      startDate: new Date("2024-01-31T00:00:00.000Z"),
    });

    expect(schedule.entries.map((entry) => entry.periodNo)).toEqual([1, 2, 3]);
    expect(schedule.entries.map((entry) => entry.dueDate.toISOString())).toEqual([
      "2024-02-29T00:00:00.000Z",
      "2024-03-31T00:00:00.000Z",
      "2024-04-30T00:00:00.000Z",
    ]);
  });

  it("rejects invalid amounts, month counts and dates", () => {
    const base = {
      amountPaisa: 100n,
      startDate: new Date("2026-01-01T00:00:00.000Z"),
    };
    expect(() => generateInstallmentSchedule({ ...base, amountPaisa: 0n, months: 2 })).toThrow();
    expect(() => generateInstallmentSchedule({ ...base, months: 0 })).toThrow();
    expect(() => generateInstallmentSchedule({ ...base, months: 1.5 })).toThrow();
    expect(() =>
      generateInstallmentSchedule({ ...base, months: 2, startDate: new Date("bad") }),
    ).toThrow();
  });
});
