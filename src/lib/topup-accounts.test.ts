import { describe, expect, it } from "vitest";
import {
  formatTopUpAccount,
  legacyAccountsFromEntries,
  parseTopUpAccountSettings,
} from "./topup-accounts";

describe("top-up account settings", () => {
  it("derives options from legacy string values", () => {
    expect(
      parseTopUpAccountSettings({ BKASH: "01700000000", NAGAD: "", BANK: "Bank · Gulshan · 12345" }),
    ).toEqual({
      BKASH: "01700000000",
      NAGAD: "",
      BANK: "Bank · Gulshan · 12345",
      entries: [
        {
          id: "legacy-BKASH",
          method: "BKASH",
          kind: "PERSONAL",
          label: "",
          accountName: "",
          accountNumber: "01700000000",
          bankName: "",
          branch: "",
          routing: "",
          ifsc: "",
          swift: "",
        },
        {
          id: "legacy-BANK",
          method: "BANK",
          kind: null,
          label: "",
          accountName: "",
          accountNumber: "Bank · Gulshan · 12345",
          bankName: "",
          branch: "",
          routing: "",
          ifsc: "",
          swift: "",
        },
      ],
    });
  });

  it("preserves the new entry shape and ignores invalid options", () => {
    const entry = {
      id: "account_1",
      method: "NAGAD",
      kind: "AGENT",
      label: "Agent desk",
      accountName: "Store",
      accountNumber: "01900000000",
      bankName: "",
      branch: "",
      routing: "",
      ifsc: "",
      swift: "",
    };
    const parsed = parseTopUpAccountSettings({ entries: [entry, { id: "bad" }] });
    expect(parsed.entries).toEqual([entry]);
    expect(parsed.NAGAD).toBe("");
  });

  it("builds legacy mirrors from bank entries and formats details", () => {
    const bank = {
      id: "bank_1",
      method: "BANK" as const,
      kind: null,
      label: "Main",
      accountName: "Savelife Ltd",
      accountNumber: "1234567890",
      bankName: "Example Bank",
      branch: "Gulshan",
      routing: "",
      ifsc: "EXAM0000123",
      swift: "EXAMBDXX",
    };
    expect(formatTopUpAccount(bank)).toBe("Example Bank · Gulshan · A/C 1234567890");
    expect(legacyAccountsFromEntries([bank]).BANK).toBe("Example Bank · Gulshan · A/C 1234567890");
  });
});
