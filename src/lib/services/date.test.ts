import { describe, expect, it } from "vitest";
import { addUtcMonths, formatDistributionMonth, isValidDate, parseDistributionMonth } from "./date";

describe("UTC calendar helpers", () => {
  it("adds and subtracts months with end-of-month clamping", () => {
    expect(addUtcMonths(new Date("2026-01-31T12:30:00.000Z"), 1).toISOString()).toBe(
      "2026-02-28T12:30:00.000Z",
    );
    expect(addUtcMonths(new Date("2026-03-31T00:00:00.000Z"), -1).toISOString()).toBe(
      "2026-02-28T00:00:00.000Z",
    );
    expect(addUtcMonths(new Date("2026-12-15T00:00:00.000Z"), 2).toISOString()).toBe(
      "2027-02-15T00:00:00.000Z",
    );
  });

  it("validates dates", () => {
    expect(isValidDate(new Date("2026-01-01T00:00:00.000Z"))).toBe(true);
    expect(isValidDate(new Date("invalid"))).toBe(false);
    expect(() => addUtcMonths(new Date("invalid"), 1)).toThrow();
    expect(() => addUtcMonths(new Date(), 1.5)).toThrow();
  });

  it("formats and parses distribution months", () => {
    expect(formatDistributionMonth(new Date("2026-02-28T23:00:00.000Z"))).toBe("2026-02");
    expect(parseDistributionMonth("2026-02")).toEqual({ year: 2026, monthIndex: 1 });
    expect(() => parseDistributionMonth("2026-13")).toThrow();
    expect(() => parseDistributionMonth("2026-2")).toThrow();
  });
});
