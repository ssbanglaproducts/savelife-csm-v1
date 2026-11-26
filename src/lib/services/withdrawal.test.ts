import { describe, expect, it } from "vitest";
import { spToPaisa } from "../money";
import { ServiceError } from "./errors";
import {
  calculateWithdrawalFee,
  validateWithdrawalRequest,
  type WithdrawalFeeConfig,
} from "./withdrawal";

function errorCode(run: () => unknown): string {
  try {
    run();
  } catch (error) {
    if (error instanceof ServiceError) return error.code;
    throw error;
  }
  throw new Error("Expected a ServiceError");
}

const config: WithdrawalFeeConfig = {
  feeBps: 1000,
  minWithdrawalPaisa: spToPaisa("500"),
};

describe("withdrawal fee", () => {
  it("deducts the configured bps from the requested gross amount", () => {
    const result = calculateWithdrawalFee(spToPaisa("1000"), config);
    expect(result.feePaisa).toBe(spToPaisa("100"));
    expect(result.netPaisa).toBe(spToPaisa("900"));
    expect(result.meetsMinimum).toBe(true);
  });

  it("applies the minimum to the gross amount", () => {
    expect(calculateWithdrawalFee(spToPaisa("499"), config).meetsMinimum).toBe(false);
    expect(calculateWithdrawalFee(spToPaisa("500"), config).meetsMinimum).toBe(true);
  });

  it("supports a zero fee and a non-default minimum", () => {
    const result = calculateWithdrawalFee(spToPaisa("200"), {
      feeBps: 0,
      minWithdrawalPaisa: 100n,
    });
    expect(result.feePaisa).toBe(0n);
    expect(result.netPaisa).toBe(spToPaisa("200"));
  });

  it("rejects invalid amounts and configurations", () => {
    expect(() => calculateWithdrawalFee(0n, config)).toThrow();
    expect(() => calculateWithdrawalFee(100n, { ...config, feeBps: 10_001 })).toThrow();
    expect(() =>
      calculateWithdrawalFee(100n, { ...config, minWithdrawalPaisa: -1n }),
    ).toThrow();
  });
});

describe("withdrawal validation", () => {
  it("only allows a debit within the Available balance", () => {
    expect(validateWithdrawalRequest(spToPaisa("1000"), spToPaisa("1000"), config).netPaisa).toBe(
      spToPaisa("900"),
    );
    expect(() =>
      validateWithdrawalRequest(spToPaisa("1000"), spToPaisa("999"), config),
    ).toThrow();
    expect(
      errorCode(() => validateWithdrawalRequest(spToPaisa("1000"), spToPaisa("999"), config)),
    ).toBe("INSUFFICIENT_BALANCE");
  });

  it("rejects amounts below the minimum", () => {
    expect(
      errorCode(() => validateWithdrawalRequest(spToPaisa("499"), spToPaisa("10000"), config)),
    ).toBe("BELOW_MINIMUM");
  });
});
