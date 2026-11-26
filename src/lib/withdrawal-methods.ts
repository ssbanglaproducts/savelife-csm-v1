import { z } from "zod";

export const withdrawalMethodValues = ["BKASH", "NAGAD", "BANK", "OTHER"] as const;

export const withdrawalMethodSchema = z.enum(withdrawalMethodValues);

export type WithdrawalMethodKey = (typeof withdrawalMethodValues)[number];

export const accountNameSchema = z.string().trim().min(2).max(120);
export const accountNumberSchema = z.string().trim().min(4).max(120);
// Mobile payouts send empty strings for these optional fields, so accept ""
// as "not provided" while still validating non-empty bank details.
const optionalBankField = z
  .union([z.string().trim().min(2).max(120), z.literal("")])
  .optional();
export const bankNameSchema = optionalBankField;
export const branchSchema = optionalBankField;

export const withdrawalAccountFields = {
  accountName: accountNameSchema,
  accountNumber: accountNumberSchema,
  bankName: bankNameSchema.optional(),
  branch: branchSchema.optional(),
};

export const withdrawalAccountSchema = z.object(withdrawalAccountFields);

export type WithdrawalAccountDetails = {
  accountName: string;
  accountNumber: string;
  bankName?: string;
  branch?: string;
};

export const savedWithdrawalMethodSchema = z.object({
  label: z.string().trim().min(1).max(60),
  method: withdrawalMethodSchema,
  accountDetails: withdrawalAccountSchema,
});

export type SavedWithdrawalMethodView = {
  id: string;
  label: string;
  method: WithdrawalMethodKey;
  accountDetails: WithdrawalAccountDetails;
  isDefault: boolean;
};

/** Bank payouts require the two extra bank fields; mobile payouts do not. */
export function normalizeAccountDetails(
  method: WithdrawalMethodKey,
  details: z.infer<typeof withdrawalAccountSchema>,
): WithdrawalAccountDetails | null {
  const accountName = details.accountName.trim();
  const accountNumber = details.accountNumber.trim();

  if (method === "BANK") {
    const bankName = details.bankName?.trim();
    const branch = details.branch?.trim();
    if (!bankName || !branch) return null;
    return { accountName, accountNumber, bankName, branch };
  }

  return { accountName, accountNumber };
}

export function parseAccountDetails(value: unknown): WithdrawalAccountDetails {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { accountName: "", accountNumber: "" };
  }

  const row = value as Record<string, unknown>;
  const text = (key: string) => (typeof row[key] === "string" ? row[key].trim() : "");
  const accountName = text("accountName");
  const accountNumber = text("accountNumber");
  const bankName = text("bankName");
  const branch = text("branch");

  return {
    accountName,
    accountNumber,
    ...(bankName ? { bankName } : {}),
    ...(branch ? { branch } : {}),
  };
}

export function parseSavedWithdrawalMethod(row: {
  id: string;
  label: string;
  method: string;
  accountDetails: unknown;
  isDefault: boolean;
}): SavedWithdrawalMethodView {
  const method = withdrawalMethodValues.includes(row.method as WithdrawalMethodKey)
    ? (row.method as WithdrawalMethodKey)
    : "OTHER";

  return {
    id: row.id,
    label: row.label,
    method,
    accountDetails: parseAccountDetails(row.accountDetails),
    isDefault: row.isDefault,
  };
}
