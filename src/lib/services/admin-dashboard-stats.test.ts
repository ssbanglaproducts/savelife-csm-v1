import { describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "../../generated/prisma/client";
import { loadAdminDashboardStats, monthWindow } from "./admin-dashboard-stats";

describe("admin dashboard month windows", () => {
  it("uses previous calendar month in UTC across a year boundary", () => {
    const now = new Date("2026-01-15T23:59:59.000Z");

    expect(monthWindow(now)).toEqual({
      start: new Date("2026-01-01T00:00:00.000Z"),
      end: new Date("2026-02-01T00:00:00.000Z"),
    });
    expect(monthWindow(now, -1)).toEqual({
      start: new Date("2025-12-01T00:00:00.000Z"),
      end: new Date("2026-01-01T00:00:00.000Z"),
    });
  });
});

function asyncStub<T>(value: T) {
  return vi.fn(async (args: unknown) => {
    void args;
    return value;
  });
}

function makeClient() {
  const memberCount = asyncStub(0)
    .mockResolvedValueOnce(4)
    .mockResolvedValueOnce(2)
    .mockResolvedValueOnce(10)
    .mockResolvedValueOnce(1)
    .mockResolvedValueOnce(3);
  const paymentProofCount = asyncStub(5);
  const withdrawalCount = asyncStub(6);
  const walletTopUpCount = asyncStub(7);
  const investmentCount = asyncStub(8);
  const investmentAggregate = asyncStub({ _sum: { amountPaisa: 0n } })
    .mockResolvedValueOnce({ _sum: { amountPaisa: 123_456n } })
    .mockResolvedValueOnce({ _sum: { amountPaisa: 98_765n } });
  const withdrawalAggregate = asyncStub({ _sum: { netPaisa: 54_321n } });
  const treasuryAggregate = asyncStub({ _sum: { balancePaisa: 9_876n } });

  const client = {
    member: { count: memberCount },
    paymentProof: { count: paymentProofCount },
    withdrawal: { count: withdrawalCount, aggregate: withdrawalAggregate },
    walletTopUp: { count: walletTopUpCount },
    investment: { count: investmentCount, aggregate: investmentAggregate },
    salaryTreasury: { aggregate: treasuryAggregate },
  } as unknown as PrismaClient;

  return {
    client,
    memberCount,
    paymentProofCount,
    withdrawalCount,
    walletTopUpCount,
    investmentCount,
    investmentAggregate,
    withdrawalAggregate,
    treasuryAggregate,
  };
}

describe("admin dashboard aggregates", () => {
  it("returns BigInt money totals and member-only counts", async () => {
    const {
      client,
      memberCount,
      paymentProofCount,
      withdrawalCount,
      walletTopUpCount,
      investmentCount,
      investmentAggregate,
      withdrawalAggregate,
      treasuryAggregate,
    } = makeClient();
    const now = new Date("2026-01-15T12:00:00.000Z");

    const stats = await loadAdminDashboardStats(client, now);

    expect(stats).toEqual({
      newMembersThisMonth: 4,
      newMembersLastMonth: 2,
      activeMembers: 10,
      inactiveMembers: 1,
      suspendedMembers: 3,
      pendingProofs: 5,
      pendingWithdrawals: 6,
      pendingTopUps: 7,
      activeInvestments: 8,
      totalInvestedPaisa: 123_456n,
      lastMonthInvestedPaisa: 98_765n,
      totalWithdrawnPaisa: 54_321n,
      salaryTreasuryPaisa: 9_876n,
    });

    expect(memberCount).toHaveBeenNthCalledWith(1, {
      where: {
        role: "MEMBER",
        createdAt: {
          gte: new Date("2026-01-01T00:00:00.000Z"),
          lt: new Date("2026-02-01T00:00:00.000Z"),
        },
      },
    });
    expect(memberCount).toHaveBeenNthCalledWith(2, {
      where: {
        role: "MEMBER",
        createdAt: {
          gte: new Date("2025-12-01T00:00:00.000Z"),
          lt: new Date("2026-01-01T00:00:00.000Z"),
        },
      },
    });
    for (const [index, status] of ["ACTIVE", "INACTIVE", "SUSPENDED"].entries()) {
      expect(memberCount).toHaveBeenNthCalledWith(index + 3, {
        where: { role: "MEMBER", status },
      });
    }

    expect(paymentProofCount).toHaveBeenCalledWith({
      where: { status: "PENDING", member: { role: "MEMBER" } },
    });
    expect(withdrawalCount).toHaveBeenCalledWith({
      where: { status: "PENDING", member: { role: "MEMBER" } },
    });
    expect(walletTopUpCount).toHaveBeenCalledWith({
      where: { status: "PENDING", member: { role: "MEMBER" } },
    });
    expect(investmentCount).toHaveBeenCalledWith({
      where: { status: "ACTIVE", member: { role: "MEMBER" } },
    });

    expect(investmentAggregate).toHaveBeenNthCalledWith(1, {
      where: { status: "ACTIVE", member: { role: "MEMBER" } },
      _sum: { amountPaisa: true },
    });
    expect(investmentAggregate).toHaveBeenNthCalledWith(2, {
      where: {
        status: "ACTIVE",
        member: { role: "MEMBER" },
        createdAt: {
          gte: new Date("2025-12-01T00:00:00.000Z"),
          lt: new Date("2026-01-01T00:00:00.000Z"),
        },
      },
      _sum: { amountPaisa: true },
    });
    expect(withdrawalAggregate).toHaveBeenCalledWith({
      where: { status: "PAID", member: { role: "MEMBER" } },
      _sum: { netPaisa: true },
    });
    expect(treasuryAggregate).toHaveBeenCalledWith({ _sum: { balancePaisa: true } });
  });
});
