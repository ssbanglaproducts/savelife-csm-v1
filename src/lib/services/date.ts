import { invalidInput } from "./errors";

const MONTH_PATTERN = /^(\d{4})-(0[1-9]|1[0-2])$/;

export function isValidDate(value: Date): boolean {
  return value instanceof Date && !Number.isNaN(value.getTime());
}

function daysInUtcMonth(year: number, monthIndex: number): number {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
}

/**
 * Adds whole calendar months in UTC, clamping the day to the target month.
 * Example: 2026-01-31 + 1 month = 2026-02-28.
 */
export function addUtcMonths(date: Date, months: number): Date {
  if (!isValidDate(date)) throw invalidInput("A valid date is required");
  if (!Number.isInteger(months)) throw invalidInput("Months must be an integer");

  const year = date.getUTCFullYear();
  const monthIndex = date.getUTCMonth();
  const targetMonth = monthIndex + months;
  const targetYear = year + Math.floor(targetMonth / 12);
  const normalizedMonth = ((targetMonth % 12) + 12) % 12;
  const day = Math.min(date.getUTCDate(), daysInUtcMonth(targetYear, normalizedMonth));

  return new Date(
    Date.UTC(
      targetYear,
      normalizedMonth,
      day,
      date.getUTCHours(),
      date.getUTCMinutes(),
      date.getUTCSeconds(),
      date.getUTCMilliseconds(),
    ),
  );
}

/** Distribution month key used by ProfitDistribution.month (YYYY-MM, UTC). */
export function formatDistributionMonth(date: Date): string {
  if (!isValidDate(date)) throw invalidInput("A valid date is required");
  const year = date.getUTCFullYear().toString().padStart(4, "0");
  const month = (date.getUTCMonth() + 1).toString().padStart(2, "0");
  return `${year}-${month}`;
}

export function parseDistributionMonth(month: string): { year: number; monthIndex: number } {
  const match = MONTH_PATTERN.exec(month);
  if (!match) throw invalidInput(`Invalid distribution month: ${month}`);
  return { year: Number(match[1]), monthIndex: Number(match[2]) - 1 };
}
