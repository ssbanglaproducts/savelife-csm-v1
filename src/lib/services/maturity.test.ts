import { describe, expect, it } from "vitest";
import {
  calculateProfitOnlyMaturityDate,
  isProfitOnlyMatured,
  resolveProfitOnlyMaturityDate,
} from "./maturity";

describe("Profit Only maturity", () => {
  it("adds the lock-in months to the start date", () => {
    expect(
      calculateProfitOnlyMaturityDate(
        new Date("2026-01-31T00:00:00.000Z"),
        12,
      ).toISOString(),
    ).toBe("2027-01-31T00:00:00.000Z");
  });

  it("clamps leap-day and short-month dates", () => {
    expect(
      calculateProfitOnlyMaturityDate(
        new Date("2024-01-31T00:00:00.000Z"),
        1,
      ).toISOString(),
    ).toBe("2024-02-29T00:00:00.000Z");
    expect(
      calculateProfitOnlyMaturityDate(
        new Date("2026-03-31T00:00:00.000Z"),
        1,
      ).toISOString(),
    ).toBe("2026-04-30T00:00:00.000Z");
  });

  it("rejects invalid lock-in values", () => {
    expect(() =>
      calculateProfitOnlyMaturityDate(new Date("2026-01-01T00:00:00.000Z"), 0),
    ).toThrow();
    expect(() =>
      calculateProfitOnlyMaturityDate(new Date("2026-01-01T00:00:00.000Z"), 1.5),
    ).toThrow();
  });

  it("treats the maturity instant as matured", () => {
    const maturity = new Date("2027-01-31T00:00:00.000Z");
    expect(isProfitOnlyMatured(maturity, maturity)).toBe(true);
    expect(isProfitOnlyMatured(maturity, new Date("2027-01-30T23:59:59.999Z"))).toBe(false);
  });

  it("prefers the contractual snapshot over a computed fallback", () => {
    const snapshot = new Date("2026-06-15T00:00:00.000Z");
    expect(
      resolveProfitOnlyMaturityDate({
        lockInEndsAt: snapshot,
        startDate: new Date("2026-01-01T00:00:00.000Z"),
        lockInMonths: 12,
      }),
    ).toBe(snapshot);
  });

  it("falls back to start date plus lock-in months", () => {
    expect(
      resolveProfitOnlyMaturityDate({
        lockInEndsAt: null,
        startDate: new Date("2026-01-31T00:00:00.000Z"),
        lockInMonths: 12,
      })?.toISOString(),
    ).toBe("2027-01-31T00:00:00.000Z");
  });

  it("returns null when there is not enough data", () => {
    expect(
      resolveProfitOnlyMaturityDate({
        lockInEndsAt: null,
        startDate: null,
        lockInMonths: null,
        fallbackStartDate: new Date("2026-01-01T00:00:00.000Z"),
      }),
    ).toBeNull();
  });
});
