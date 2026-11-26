import type { PrismaClient } from "../generated/prisma/client";

export const TOP_UP_ACCOUNTS_SETTING_KEY = "wallet.topUpAccounts";

export const TOP_UP_METHODS = ["BKASH", "NAGAD", "BANK"] as const;
export type TopUpMethod = (typeof TOP_UP_METHODS)[number];
export type TopUpAccounts = Record<TopUpMethod, string>;

export const EMPTY_TOP_UP_ACCOUNTS: TopUpAccounts = {
  BKASH: "",
  NAGAD: "",
  BANK: "",
};

export function parseTopUpAccounts(value: unknown): TopUpAccounts {
  const record =
    typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
  const read = (key: TopUpMethod) => {
    const value = record[key];
    return typeof value === "string" ? value.trim().slice(0, 200) : "";
  };

  return {
    BKASH: read("BKASH"),
    NAGAD: read("NAGAD"),
    BANK: read("BANK"),
  };
}

/** Platform receiving details are editable by admin instead of living in UI copy. */
export async function loadTopUpAccounts(client: PrismaClient): Promise<TopUpAccounts> {
  const setting = await client.systemSetting.findUnique({
    where: { key: TOP_UP_ACCOUNTS_SETTING_KEY },
    select: { value: true },
  });
  return setting ? parseTopUpAccounts(setting.value) : EMPTY_TOP_UP_ACCOUNTS;
}
