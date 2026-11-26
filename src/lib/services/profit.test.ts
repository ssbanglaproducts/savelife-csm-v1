import { describe, expect, it } from "vitest";
import { sumPaisa, spToPaisa } from "../money";
import {
  assertDistributionReconciles,
  calculateMonthlyProfitDistribution,
  computeProfitPerThousandPaisa,
  profitForEligiblePaisa,
  PAISA_PER_THOUSAND_SP,
} from "./profit";

describe("profit per 1,000 SP", () => {
  it("reports 100 SP per 1,000 SP for a 10% distribution", () => {
    expect(
      computeProfitPerThousandPaisa(spToPaisa("66500"), spToPaisa("665000")),
    ).toBe(spToPaisa("100"));
  });

  it("floors the displayed rate", () => {
    expect(computeProfitPerThousandPaisa(1n, 3n)).toBe(PAISA_PER_THOUSAND_SP / 3n);
    expect(profitForEligiblePaisa(3n, PAISA_PER_THOUSAND_SP / 3n)).toBe(0n);
  });

  it("rejects non-positive eligible totals and negative profit", () => {
    expect(() => computeProfitPerThousandPaisa(100n, 0n)).toThrow();
    expect(() => computeProfitPerThousandPaisa(-1n, 100n)).toThrow();
  });
});

describe("monthly distribution allocation", () => {
  it("matches the documented 10% example exactly", () => {
    const calculation = calculateMonthlyProfitDistribution(spToPaisa("66500"), [
      { investmentId: "i1", memberId: "m1", eligiblePaisa: spToPaisa("5000") },
      { investmentId: "i2", memberId: "m2", eligiblePaisa: spToPaisa("10000") },
      { investmentId: "i3", memberId: "m3", eligiblePaisa: spToPaisa("50000") },
      { investmentId: "i4", memberId: "m4", eligiblePaisa: spToPaisa("100000") },
      { investmentId: "i5", memberId: "m5", eligiblePaisa: spToPaisa("500000") },
    ]);

    expect(calculation.profitPerThousandPaisa).toBe(spToPaisa("100"));
    expect(calculation.lines.map((line) => line.allocatedPaisa)).toEqual([
      spToPaisa("500"),
      spToPaisa("1000"),
      spToPaisa("5000"),
      spToPaisa("10000"),
      spToPaisa("50000"),
    ]);
    expect(calculation.lines.every((line) => line.roundingAdjustmentPaisa === 0n)).toBe(true);
    assertDistributionReconciles(calculation);
  });

  it("reconciles largest remainders exactly for three equal weights", () => {
    const calculation = calculateMonthlyProfitDistribution(100n, [
      { investmentId: "i1", memberId: "m1", eligiblePaisa: 1n },
      { investmentId: "i2", memberId: "m2", eligiblePaisa: 1n },
      { investmentId: "i3", memberId: "m3", eligiblePaisa: 1n },
    ]);

    expect(calculation.lines.map((line) => line.allocatedPaisa)).toEqual([34n, 33n, 33n]);
    expect(sumPaisa(calculation.lines.map((line) => line.allocatedPaisa))).toBe(100n);
    assertDistributionReconciles(calculation);
  });

  it("assigns the leftover paisa to the largest remainder deterministically", () => {
    const calculation = calculateMonthlyProfitDistribution(10_001n, [
      { investmentId: "i1", memberId: "m1", eligiblePaisa: 3n },
      { investmentId: "i2", memberId: "m2", eligiblePaisa: 7n },
    ]);

    expect(calculation.lines.map((line) => line.allocatedPaisa)).toEqual([3000n, 7001n]);
    expect(calculation.lines.map((line) => line.roundingAdjustmentPaisa)).toEqual([0n, 1n]);
    expect(sumPaisa(calculation.lines.map((line) => line.allocatedPaisa))).toBe(10_001n);
    expect(sumPaisa(calculation.lines.map((line) => line.roundingAdjustmentPaisa))).toBe(1n);
  });

  it("keeps reconciliation when the floored rate would lose a paisa", () => {
    const calculation = calculateMonthlyProfitDistribution(1n, [
      { investmentId: "i1", memberId: "m1", eligiblePaisa: 3n },
    ]);

    expect(calculation.lines[0]?.allocatedPaisa).toBe(1n);
    expect(calculation.lines[0]?.roundingAdjustmentPaisa).toBe(1n);
    assertDistributionReconciles(calculation);
  });

  it("survives zero-weight members without allocating to them", () => {
    const calculation = calculateMonthlyProfitDistribution(10n, [
      { investmentId: "i1", memberId: "m1", eligiblePaisa: 0n },
      { investmentId: "i2", memberId: "m2", eligiblePaisa: 9n },
    ]);
    expect(calculation.lines[0]?.allocatedPaisa).toBe(0n);
    expect(calculation.lines[1]?.allocatedPaisa).toBe(10n);
    assertDistributionReconciles(calculation);
  });

  it("allows a zero-profit month", () => {
    const calculation = calculateMonthlyProfitDistribution(0n, [
      { investmentId: "i1", memberId: "m1", eligiblePaisa: 100n },
    ]);
    expect(calculation.profitPerThousandPaisa).toBe(0n);
    expect(calculation.lines[0]?.allocatedPaisa).toBe(0n);
  });

  it("rejects invalid eligibility inputs", () => {
    expect(() => calculateMonthlyProfitDistribution(100n, [])).toThrow();
    expect(() =>
      calculateMonthlyProfitDistribution(100n, [
        { investmentId: "i1", memberId: "m1", eligiblePaisa: -1n },
      ]),
    ).toThrow();
    expect(() =>
      calculateMonthlyProfitDistribution(100n, [
        { investmentId: "i1", memberId: "m1", eligiblePaisa: 0n },
      ]),
    ).toThrow();
    expect(() =>
      calculateMonthlyProfitDistribution(100n, [
        { investmentId: "i1", memberId: "m1", eligiblePaisa: 50n },
        { investmentId: "i1", memberId: "m1", eligiblePaisa: 50n },
      ]),
    ).toThrow();
  });

  it("detects a broken reconciliation", () => {
    const calculation = calculateMonthlyProfitDistribution(10n, [
      { investmentId: "i1", memberId: "m1", eligiblePaisa: 1n },
    ]);
    const broken = {
      ...calculation,
      lines: [{ ...calculation.lines[0]!, allocatedPaisa: 9n }],
    };
    expect(() => assertDistributionReconciles(broken)).toThrow();
  });
});
