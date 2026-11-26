import { describe, expect, it } from "vitest";
import { spToPaisa } from "../money";
import {
  activeInvestmentTypeFlags,
  summarizeInstallmentReturn,
  summarizeProfitProgress,
  summarizeRecentActivity,
} from "./member-dashboard";

describe("member dashboard progress", () => {
  it("counts only paid installments as capital returned", () => {
    const result = summarizeInstallmentReturn([
      {
        amountPaisa: spToPaisa("100000"),
        installments: [
          { amountPaisa: spToPaisa("10000"), status: "PAID" },
          { amountPaisa: spToPaisa("10000"), status: "PENDING" },
        ],
      },
      {
        amountPaisa: spToPaisa("50000"),
        installments: [{ amountPaisa: spToPaisa("5000"), status: "PAID" }],
      },
    ]);

    expect(result.expected).toBe(spToPaisa("25000"));
    expect(result.returned).toBe(spToPaisa("15000"));
  });

  it("falls back to the principal when a schedule is missing", () => {
    const result = summarizeInstallmentReturn([
      { amountPaisa: spToPaisa("20000"), installments: [] },
    ]);

    expect(result.expected).toBe(spToPaisa("20000"));
    expect(result.returned).toBe(0n);
  });

  it("does not treat scheduled profit as received profit", () => {
    const result = summarizeProfitProgress([
      { allocatedPaisa: spToPaisa("1000"), distribution: { status: "POSTED" } },
      { allocatedPaisa: spToPaisa("500"), distribution: { status: "DRAFT" } },
    ]);

    expect(result.scheduled).toBe(spToPaisa("1500"));
    expect(result.received).toBe(spToPaisa("1000"));
  });
});

describe("active investment type flags", () => {
  it("shows only the card for the active investment type", () => {
    expect(
      activeInvestmentTypeFlags([
        { type: "INSTALLMENT", status: "ACTIVE" },
        { type: "PROFIT_ONLY", status: "MATURED" },
      ]),
    ).toEqual({ hasActiveInstallment: true, hasActiveProfitOnly: false });

    expect(
      activeInvestmentTypeFlags([
        { type: "INSTALLMENT", status: "CLOSED" },
        { type: "PROFIT_ONLY", status: "ACTIVE" },
      ]),
    ).toEqual({ hasActiveInstallment: false, hasActiveProfitOnly: true });
  });

  it("shows both cards when both types are active", () => {
    expect(
      activeInvestmentTypeFlags([
        { type: "INSTALLMENT", status: "ACTIVE" },
        { type: "PROFIT_ONLY", status: "ACTIVE" },
      ]),
    ).toEqual({ hasActiveInstallment: true, hasActiveProfitOnly: true });
  });

  it("hides both cards when no investment type is active", () => {
    expect(
      activeInvestmentTypeFlags([
        { type: "INSTALLMENT", status: "PENDING" },
        { type: "PROFIT_ONLY", status: "REJECTED" },
      ]),
    ).toEqual({ hasActiveInstallment: false, hasActiveProfitOnly: false });
  });
});

describe("recent activity", () => {
  it("shows each reward wallet transfer separately and hides its available credit", () => {
    const now = new Date("2026-11-25T14:40:00.000Z");
    const slightlyLater = new Date("2026-11-25T14:40:01.000Z");
    const earlier = new Date("2026-11-25T14:39:00.000Z");

    const result = summarizeRecentActivity(
      [
        {
          id: "credit-salary",
          type: "REWARD_COLLECTION",
          direction: "CREDIT",
          category: "AVAILABLE",
          amountPaisa: spToPaisa("2500"),
          createdAt: slightlyLater,
        },
        {
          id: "debit-salary",
          type: "REWARD_COLLECTION",
          direction: "DEBIT",
          category: "SALARY",
          amountPaisa: spToPaisa("2500"),
          createdAt: now,
        },
        {
          id: "credit-rank",
          type: "REWARD_COLLECTION",
          direction: "CREDIT",
          category: "AVAILABLE",
          amountPaisa: spToPaisa("1000"),
          createdAt: now,
        },
        {
          id: "debit-rank",
          type: "REWARD_COLLECTION",
          direction: "DEBIT",
          category: "RANK_REWARD",
          amountPaisa: spToPaisa("1000"),
          createdAt: earlier,
        },
        {
          id: "adjustment",
          type: "ADMIN_ADJUSTMENT",
          direction: "CREDIT",
          category: "AVAILABLE",
          amountPaisa: spToPaisa("2000"),
          createdAt: new Date("2026-11-25T14:38:00.000Z"),
        },
      ],
      "en",
    );

    expect(result).toHaveLength(3);
    expect(result[0]).toMatchObject({
      id: "debit-salary",
      sourceLabelKey: "salary",
      direction: "TRANSFER",
      amount: "2,500 SP",
    });
    expect(result[1]).toMatchObject({
      id: "debit-rank",
      sourceLabelKey: "rankReward",
      direction: "TRANSFER",
      amount: "1,000 SP",
    });
    expect(result[2]).toMatchObject({
      id: "adjustment",
      direction: "IN",
      amount: "2,000 SP",
    });
  });

  it("limits the dashboard list to four entries", () => {
    const result = summarizeRecentActivity(
      Array.from({ length: 5 }, (_, index) => ({
        id: `entry-${index}`,
        type: "ADMIN_ADJUSTMENT",
        direction: "CREDIT" as const,
        category: "AVAILABLE",
        amountPaisa: spToPaisa("100"),
        createdAt: new Date(Date.UTC(2026, 10, 25, 12, 0, index)),
      })),
      "en",
    );

    expect(result).toHaveLength(4);
    expect(result.map((entry) => entry.id)).toEqual([
      "entry-4",
      "entry-3",
      "entry-2",
      "entry-1",
    ]);
  });
});
