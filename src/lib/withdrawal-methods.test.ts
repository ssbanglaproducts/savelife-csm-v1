import { describe, expect, it } from "vitest";
import {
  normalizeAccountDetails,
  parseAccountDetails,
  savedWithdrawalMethodSchema,
} from "./withdrawal-methods";

describe("withdrawal account details", () => {
  it("keeps mobile payouts to the account name and number", () => {
    expect(
      normalizeAccountDetails("BKASH", {
        accountName: "  Md Shariful  ",
        accountNumber: "  01700000000 ",
        bankName: "Ignored bank",
        branch: "Ignored branch",
      }),
    ).toEqual({ accountName: "Md Shariful", accountNumber: "01700000000" });
  });

  it("requires bank name and branch for bank payouts", () => {
    expect(
      normalizeAccountDetails("BANK", {
        accountName: "Md Shariful",
        accountNumber: "1234567890",
      }),
    ).toBeNull();

    expect(
      normalizeAccountDetails("BANK", {
        accountName: "Md Shariful",
        accountNumber: "1234567890",
        bankName: "  Savelife Bank ",
        branch: "  Gulshan ",
      }),
    ).toEqual({
      accountName: "Md Shariful",
      accountNumber: "1234567890",
      bankName: "Savelife Bank",
      branch: "Gulshan",
    });
  });

  it("accepts empty optional bank fields for mobile payouts", () => {
    expect(
      savedWithdrawalMethodSchema.safeParse({
        label: "QA bKash",
        method: "BKASH",
        accountDetails: {
          accountName: "QA Mobile Account",
          accountNumber: "01700000000",
          bankName: "",
          branch: "",
        },
      }).success,
    ).toBe(true);
  });

  it("parses saved JSON details without leaking missing bank fields", () => {
    expect(parseAccountDetails({ accountName: "A", accountNumber: "1", bankName: "B" })).toEqual({
      accountName: "A",
      accountNumber: "1",
      bankName: "B",
    });
    expect(parseAccountDetails(null)).toEqual({ accountName: "", accountNumber: "" });
  });
});
