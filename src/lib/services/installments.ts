import { allocateProportionally, type Paisa } from "../money";
import { addUtcMonths, isValidDate } from "./date";
import { invalidInput } from "./errors";

export interface InstallmentScheduleInput {
  readonly amountPaisa: Paisa;
  readonly months: number;
  readonly startDate: Date;
}

export interface InstallmentScheduleEntry {
  readonly periodNo: number;
  readonly dueDate: Date;
  readonly amountPaisa: Paisa;
}

export interface InstallmentSchedule {
  readonly principalPaisa: Paisa;
  readonly months: number;
  readonly totalPayablePaisa: Paisa;
  /** The contractual snapshot (floor); individual periods may differ by 1 paisa. */
  readonly monthlyInstallmentPaisa: Paisa;
  readonly entries: readonly InstallmentScheduleEntry[];
}

/**
 * Splits the invested capital into equal monthly capital repayments. Profit is
 * announced and distributed separately, so the installment itself never
 * includes a fixed multiple of the principal. Largest-remainder rounding keeps
 * the sum of periods exactly equal to the invested capital and always assigns
 * the extra paisa to the earliest periods.
 */
export function generateInstallmentSchedule(
  input: InstallmentScheduleInput,
): InstallmentSchedule {
  if (input.amountPaisa <= 0n) throw invalidInput("Investment amount must be positive");
  if (!Number.isInteger(input.months) || input.months <= 0) {
    throw invalidInput("Installment months must be a positive integer");
  }
  if (!isValidDate(input.startDate)) throw invalidInput("A valid start date is required");

  const weights = Array.from({ length: input.months }, () => 1n);
  const allocations = allocateProportionally(input.amountPaisa, weights);

  return {
    principalPaisa: input.amountPaisa,
    months: input.months,
    totalPayablePaisa: input.amountPaisa,
    monthlyInstallmentPaisa: input.amountPaisa / BigInt(input.months),
    entries: allocations.map((amountPaisa, index) => ({
      periodNo: index + 1,
      dueDate: addUtcMonths(input.startDate, index + 1),
      amountPaisa,
    })),
  };
}
