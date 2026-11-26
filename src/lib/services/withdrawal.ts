import { applyBps, type Paisa } from "../money";
import { ServiceError, invalidInput } from "./errors";

export interface WithdrawalFeeConfig {
  readonly feeBps: number;
  readonly minWithdrawalPaisa: Paisa;
}

export interface WithdrawalFeeCalculation {
  readonly amountPaisa: Paisa;
  readonly feePaisa: Paisa;
  readonly netPaisa: Paisa;
  /** Minimum applies to the requested gross amount, not to the net payout. */
  readonly meetsMinimum: boolean;
}

function assertFeeConfig(config: WithdrawalFeeConfig): void {
  if (!Number.isInteger(config.feeBps) || config.feeBps < 0 || config.feeBps > 10_000) {
    throw invalidInput(`Invalid withdrawal fee bps: ${config.feeBps}`);
  }
  if (config.minWithdrawalPaisa < 0n) {
    throw invalidInput("Minimum withdrawal cannot be negative");
  }
}

export function calculateWithdrawalFee(
  amountPaisa: Paisa,
  config: WithdrawalFeeConfig,
): WithdrawalFeeCalculation {
  assertFeeConfig(config);
  if (amountPaisa <= 0n) throw invalidInput("Withdrawal amount must be positive");

  const feePaisa = applyBps(amountPaisa, config.feeBps);
  return {
    amountPaisa,
    feePaisa,
    netPaisa: amountPaisa - feePaisa,
    meetsMinimum: amountPaisa >= config.minWithdrawalPaisa,
  };
}

/** Withdrawals may only debit the Available balance, never Profit or Affiliate. */
export function validateWithdrawalRequest(
  amountPaisa: Paisa,
  availablePaisa: Paisa,
  config: WithdrawalFeeConfig,
): WithdrawalFeeCalculation {
  const calculation = calculateWithdrawalFee(amountPaisa, config);
  if (!calculation.meetsMinimum) {
    throw new ServiceError("BELOW_MINIMUM", "Withdrawal amount is below the configured minimum");
  }
  if (availablePaisa < amountPaisa) {
    throw new ServiceError(
      "INSUFFICIENT_BALANCE",
      "Insufficient Available balance for this withdrawal",
    );
  }
  return calculation;
}
