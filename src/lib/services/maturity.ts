import { addUtcMonths, isValidDate } from "./date";
import { invalidInput } from "./errors";

/** Members must give two months' notice before withdrawing Profit Only capital. */
export const PROFIT_ONLY_NOTICE_MONTHS = 2;

/** Date on which a submitted principal notice becomes payable. */
export function calculatePrincipalPayableDate(noticeAt: Date): Date {
  if (!isValidDate(noticeAt)) throw invalidInput("A valid notice date is required");
  return addUtcMonths(noticeAt, PROFIT_ONLY_NOTICE_MONTHS);
}

/** Profit Only principal becomes withdrawable after the locked-in months elapse. */
export function calculateProfitOnlyMaturityDate(
  startDate: Date,
  lockInMonths: number,
): Date {
  if (!Number.isInteger(lockInMonths) || lockInMonths <= 0) {
    throw invalidInput("Lock-in months must be a positive integer");
  }
  return addUtcMonths(startDate, lockInMonths);
}

export function isProfitOnlyMatured(maturityDate: Date, asOf: Date = new Date()): boolean {
  if (!isValidDate(maturityDate) || !isValidDate(asOf)) {
    throw invalidInput("A valid maturity date and as-of date are required");
  }
  return maturityDate.getTime() <= asOf.getTime();
}

/**
 * Prefers the contractual `lockInEndsAt` snapshot; falls back to computing it
 * from the investment's own start date and lock-in months.
 */
export function resolveProfitOnlyMaturityDate(input: {
  readonly lockInEndsAt: Date | null;
  readonly startDate: Date | null;
  readonly lockInMonths: number | null;
  readonly fallbackStartDate?: Date;
}): Date | null {
  if (input.lockInEndsAt && isValidDate(input.lockInEndsAt)) return input.lockInEndsAt;

  const startDate = input.startDate ?? input.fallbackStartDate;
  if (
    startDate &&
    isValidDate(startDate) &&
    input.lockInMonths !== null &&
    Number.isInteger(input.lockInMonths) &&
    input.lockInMonths > 0
  ) {
    return calculateProfitOnlyMaturityDate(startDate, input.lockInMonths);
  }
  return null;
}
