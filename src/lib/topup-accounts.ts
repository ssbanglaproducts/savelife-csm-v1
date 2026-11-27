import type { PrismaClient } from "../generated/prisma/client";

export const TOP_UP_ACCOUNTS_SETTING_KEY = "wallet.topUpAccounts";

export const TOP_UP_METHODS = ["BKASH", "NAGAD", "BANK"] as const;
export type TopUpMethod = (typeof TOP_UP_METHODS)[number];

export const TOP_UP_ACCOUNT_KINDS = ["PERSONAL", "AGENT"] as const;
export type TopUpAccountKind = (typeof TOP_UP_ACCOUNT_KINDS)[number];

export type TopUpAccounts = Record<TopUpMethod, string>;

export type TopUpAccountEntry = {
  id: string;
  method: TopUpMethod;
  kind: TopUpAccountKind | null;
  label: string;
  accountName: string;
  accountNumber: string;
  bankName: string;
  branch: string;
  routing: string;
  ifsc: string;
  swift: string;
};

export type TopUpAccountSettings = TopUpAccounts & {
  entries: TopUpAccountEntry[];
};

export const EMPTY_TOP_UP_ACCOUNTS: TopUpAccounts = {
  BKASH: "",
  NAGAD: "",
  BANK: "",
};

const EMPTY_ENTRY: Omit<TopUpAccountEntry, "id" | "method"> = {
  kind: null,
  label: "",
  accountName: "",
  accountNumber: "",
  bankName: "",
  branch: "",
  routing: "",
  ifsc: "",
  swift: "",
};

function boundedString(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export function parseTopUpAccounts(value: unknown): TopUpAccounts {
  const record =
    typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
  const read = (key: TopUpMethod) => boundedString(record[key], 200);

  return {
    BKASH: read("BKASH"),
    NAGAD: read("NAGAD"),
    BANK: read("BANK"),
  };
}

function parseEntry(value: unknown): TopUpAccountEntry | null {
  if (typeof value !== "object" || value === null) return null;
  const record = value as Record<string, unknown>;
  if (typeof record.id !== "string" || !/^[A-Za-z0-9_-]{1,80}$/.test(record.id)) return null;
  if (!TOP_UP_METHODS.includes(record.method as TopUpMethod)) return null;

  const kind = TOP_UP_ACCOUNT_KINDS.includes(record.kind as TopUpAccountKind)
    ? (record.kind as TopUpAccountKind)
    : null;

  return {
    id: record.id,
    method: record.method as TopUpMethod,
    kind,
    label: boundedString(record.label, 80),
    accountName: boundedString(record.accountName, 120),
    accountNumber: boundedString(record.accountNumber, 200),
    bankName: boundedString(record.bankName, 120),
    branch: boundedString(record.branch, 120),
    routing: boundedString(record.routing, 120),
    ifsc: boundedString(record.ifsc, 120),
    swift: boundedString(record.swift, 120),
  };
}

function legacyEntries(accounts: TopUpAccounts): TopUpAccountEntry[] {
  return TOP_UP_METHODS.flatMap((method) => {
    const accountNumber = accounts[method];
    if (!accountNumber) return [];
    return [
      {
        ...EMPTY_ENTRY,
        id: `legacy-${method}`,
        method,
        kind: method === "BANK" ? null : "PERSONAL",
        accountNumber,
      },
    ];
  });
}

/** Parse the full settings value while keeping the legacy string shape intact. */
export function parseTopUpAccountSettings(value: unknown): TopUpAccountSettings {
  const accounts = parseTopUpAccounts(value);
  const record =
    typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
  const rawEntries = Array.isArray(record.entries) ? record.entries.slice(0, 30) : null;
  const entries = rawEntries
    ? rawEntries.flatMap((entry) => {
        const parsed = parseEntry(entry);
        return parsed ? [parsed] : [];
      })
    : legacyEntries(accounts);

  return { ...accounts, entries };
}

/** Build the legacy string mirrors consumed by existing member pages. */
export function legacyAccountsFromEntries(
  entries: readonly TopUpAccountEntry[],
): TopUpAccounts {
  const accounts: TopUpAccounts = { ...EMPTY_TOP_UP_ACCOUNTS };
  for (const method of TOP_UP_METHODS) {
    const first = entries.find((entry) => entry.method === method);
    if (first) accounts[method] = formatTopUpAccount(first);
  }
  return accounts;
}

/** Human-readable receiving details for an account option. */
export function formatTopUpAccount(entry: TopUpAccountEntry): string {
  if (entry.method === "BANK") {
    return [entry.bankName, entry.branch, entry.accountNumber && `A/C ${entry.accountNumber}`]
      .filter(Boolean)
      .join(" · ");
  }
  return entry.accountNumber;
}

/** Additional detail lines shown beneath the primary account value. */
export function topUpAccountDetails(entry: TopUpAccountEntry): string[] {
  if (entry.method === "BANK") {
    return [
      entry.accountName,
      entry.routing && `Routing: ${entry.routing}`,
      entry.ifsc && `IFSC: ${entry.ifsc}`,
      entry.swift && `SWIFT: ${entry.swift}`,
    ].filter(Boolean);
  }
  return [entry.accountName].filter(Boolean);
}

/** Platform receiving details are editable by admin instead of living in UI copy. */
export async function loadTopUpAccounts(client: PrismaClient): Promise<TopUpAccounts> {
  const setting = await client.systemSetting.findUnique({
    where: { key: TOP_UP_ACCOUNTS_SETTING_KEY },
    select: { value: true },
  });
  return setting ? parseTopUpAccounts(setting.value) : EMPTY_TOP_UP_ACCOUNTS;
}

export async function loadTopUpAccountSettings(
  client: PrismaClient,
): Promise<TopUpAccountSettings> {
  const setting = await client.systemSetting.findUnique({
    where: { key: TOP_UP_ACCOUNTS_SETTING_KEY },
    select: { value: true },
  });
  return setting ? parseTopUpAccountSettings(setting.value) : { ...EMPTY_TOP_UP_ACCOUNTS, entries: [] };
}
