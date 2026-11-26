import { describe, expect, it } from "vitest";
import {
  allocateProportionally,
  applyBps,
  formatSP,
  formatTaka,
  paisaToSP,
  paisaToSPInput,
  sumPaisa,
  spToPaisa,
} from "./money";

describe("paisa conversion", () => {
  it("converts SP to paisa without floating point error", () => {
    expect(spToPaisa("100000")).toBe(10_000_000n);
    expect(spToPaisa("14285.71")).toBe(1_428_571n);
    expect(spToPaisa(0.5)).toBe(50n);
  });

  it("rejects more than two decimal places", () => {
    expect(() => spToPaisa("10.999")).toThrow();
  });

  it("formats paisa back to SP with grouping and no trailing .00", () => {
    expect(paisaToSP(10_000_000n)).toBe("100,000");
    expect(paisaToSP(1250n)).toBe("12.50");
    expect(formatSP(50000n)).toBe("500 SP");
    expect(formatSP(1250n)).toBe("12.50 SP");
    expect(formatSP(-1250n)).toBe("-12.50 SP");
    expect(formatSP(10_000_000n)).toBe("100,000 SP");
  });

  it("formats catalog prices with the taka symbol for both locales", () => {
    expect(formatTaka(50000n, "en")).toBe("৳500");
    expect(formatTaka(1250n, "en")).toBe("৳12.50");
    expect(formatTaka(50000n, "bn")).toBe("৳500");
  });

  it("produces ungrouped SP input that the withdrawal API accepts", () => {
    expect(paisaToSPInput(10_000_000n)).toBe("100000");
    expect(paisaToSPInput(1_428_571n)).toBe("14285.71");
    expect(spToPaisa(paisaToSPInput(10_000_001n))).toBe(10_000_001n);
  });
});

describe("basis points", () => {
  it("applies basis-point rates", () => {
    const investment = spToPaisa("100000");
    expect(applyBps(investment, 300)).toBe(spToPaisa("3000"));
    expect(applyBps(investment, 100)).toBe(spToPaisa("1000"));
    expect(applyBps(investment, 50)).toBe(spToPaisa("500"));
    expect(applyBps(investment, 450)).toBe(spToPaisa("4500"));
    expect(applyBps(investment, 20000)).toBe(spToPaisa("200000"));
  });
});

describe("proportional profit distribution", () => {
  it("matches the documented per-1,000 SP allocations at a 10% rate", () => {
    // The five example members total 665,000 SP, so 10% of that is 66,500 SP.
    // (The document's 10,000,000 SP total includes members not shown in the table.)
    const weights = [
      spToPaisa("5000"),
      spToPaisa("10000"),
      spToPaisa("50000"),
      spToPaisa("100000"),
      spToPaisa("500000"),
    ];
    const profit = spToPaisa("66500");

    const shares = allocateProportionally(profit, weights);

    expect(shares).toEqual([
      spToPaisa("500"),
      spToPaisa("1000"),
      spToPaisa("5000"),
      spToPaisa("10000"),
      spToPaisa("50000"),
    ]);
    expect(sumPaisa(shares)).toBe(profit);
  });

  it("reconciles exactly when the amount does not divide evenly", () => {
    const profit = 100n;
    const shares = allocateProportionally(profit, [1n, 1n, 1n]);
    expect(shares).toEqual([34n, 33n, 33n]);
    expect(sumPaisa(shares)).toBe(100n);
  });

  it("is deterministic for equal weights", () => {
    const first = allocateProportionally(7n, [1n, 1n, 1n]);
    const second = allocateProportionally(7n, [1n, 1n, 1n]);
    expect(first).toEqual(second);
  });
});
