import { describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "../../generated/prisma/client";
import {
  buildSignupSeries,
  loadAdminDashboardStats,
  monthWindow,
} from "./admin-dashboard-stats";

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

describe("buildSignupSeries", () => {
  it("buckets signups into UTC days and ignores dates outside the 30-day window", () => {
    const series = buildSignupSeries(
      [
        new Date("2027-01-02T23:59:59.000Z"),
        new Date("2027-01-02T00:00:01.000Z"),
        new Date("2026-12-04T12:00:00.000Z"),
        new Date("2026-12-03T23:59:59.000Z"),
        new Date("2027-01-03T00:00:00.000Z"),
      ],
      new Date("2027-01-02T18:00:00.000Z"),
    );

    expect(series).toHaveLength(30);
    expect(series[0]).toEqual({ date: "2026-12-04", count: 1 });
    expect(series[29]).toEqual({ date: "2027-01-02", count: 2 });
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
    .mockResolvedValueOnce(42)
    .mockResolvedValueOnce(4)
    .mockResolvedValueOnce(2)
    .mockResolvedValueOnce(10)
    .mockResolvedValueOnce(1)
    .mockResolvedValueOnce(3);
  const memberFindMany = asyncStub([
    { createdAt: new Date("2026-01-14T09:00:00.000Z") },
    { createdAt: new Date("2026-01-15T01:00:00.000Z") },
    { createdAt: new Date("2026-01-15T18:00:00.000Z") },
  ]);
  const withdrawalCount = asyncStub(6);
  const walletTopUpCount = asyncStub(7);
  const investmentCount = asyncStub(0).mockResolvedValueOnce(5).mockResolvedValueOnce(8);
  const investmentAggregate = asyncStub({ _sum: { amountPaisa: 0n } })
    .mockResolvedValueOnce({ _sum: { amountPaisa: 123_456n } })
    .mockResolvedValueOnce({ _sum: { amountPaisa: 98_765n } });
  const withdrawalAggregate = asyncStub({ _sum: { netPaisa: 54_321n } });
  const walletTopUpAggregate = asyncStub({ _sum: { amountPaisa: 222_222n } });
  const treasuryAggregate = asyncStub({ _sum: { balancePaisa: 9_876n } });

  const client = {
    member: { count: memberCount, findMany: memberFindMany },
    withdrawal: { count: withdrawalCount, aggregate: withdrawalAggregate },
    walletTopUp: { count: walletTopUpCount, aggregate: walletTopUpAggregate },
    investment: { count: investmentCount, aggregate: investmentAggregate },
    salaryTreasury: { aggregate: treasuryAggregate },
  } as unknown as PrismaClient;

  return {
    client,
    memberCount,
    memberFindMany,
    withdrawalCount,
    walletTopUpCount,
    investmentCount,
    investmentAggregate,
    withdrawalAggregate,
    walletTopUpAggregate,
    treasuryAggregate,
  };
}

describe("admin dashboard aggregates", () => {
  it("returns BigInt money totals and member-only counts", async () => {
    const {
      client,
      memberCount,
      memberFindMany,
      withdrawalCount,
      walletTopUpCount,
      investmentCount,
      investmentAggregate,
      withdrawalAggregate,
      walletTopUpAggregate,
      treasuryAggregate,
    } = makeClient();
    const now = new Date("2026-01-15T12:00:00.000Z");

    const stats = await loadAdminDashboardStats(client, now);

    expect(stats).toEqual({
      totalMembers: 42,
      newMembersThisMonth: 4,
      newMembersLastMonth: 2,
      activeMembers: 10,
      inactiveMembers: 1,
      suspendedMembers: 3,
      pendingInvestments: 5,
      pendingWithdrawals: 6,
      pendingTopUps: 7,
      activeInvestments: 8,
      totalInvestedPaisa: 123_456n,
      lastMonthInvestedPaisa: 98_765n,
      totalWithdrawnPaisa: 54_321n,
      totalTopUpPaisa: 222_222n,
      salaryTreasuryPaisa: 9_876n,
      signups: expect.any(Array),
    });
    expect(stats.signups).toHaveLength(30);
    expect(stats.signups[28]).toEqual({ date: "2026-01-14", count: 1 });
    expect(stats.signups[29]).toEqual({ date: "2026-01-15", count: 2 });

    expect(memberCount).toHaveBeenNthCalledWith(1, {
      where: { role: "MEMBER" },
    });
    expect(memberCount).toHaveBeenNthCalledWith(2, {
      where: {
        role: "MEMBER",
        createdAt: {
          gte: new Date("2026-01-01T00:00:00.000Z"),
          lt: new Date("2026-02-01T00:00:00.000Z"),
        },
      },
    });
    expect(memberCount).toHaveBeenNthCalledWith(3, {
      where: {
        role: "MEMBER",
        createdAt: {
          gte: new Date("2025-12-01T00:00:00.000Z"),
          lt: new Date("2026-01-01T00:00:00.000Z"),
        },
      },
    });
    for (const [index, status] of ["ACTIVE", "INACTIVE", "SUSPENDED"].entries()) {
      expect(memberCount).toHaveBeenNthCalledWith(index + 4, {
        where: { role: "MEMBER", status },
      });
    }

    expect(memberFindMany).toHaveBeenCalledWith({
      where: {
        role: "MEMBER",
        createdAt: {
          gte: new Date("2025-12-17T00:00:00.000Z"),
          lt: new Date("2026-01-16T00:00:00.000Z"),
        },
      },
      select: { createdAt: true },
      orderBy: { createdAt: "asc" },
    });
    expect(investmentCount).toHaveBeenNthCalledWith(1, {
      where: {
        member: { role: "MEMBER" },
        paymentProofs: { some: { status: "PENDING" } },
      },
    });
    expect(withdrawalCount).toHaveBeenCalledWith({
      where: { status: "PENDING", member: { role: "MEMBER" } },
    });
    expect(walletTopUpCount).toHaveBeenCalledWith({
      where: { status: "PENDING", member: { role: "MEMBER" } },
    });
    expect(investmentCount).toHaveBeenNthCalledWith(2, {
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
    expect(walletTopUpAggregate).toHaveBeenCalledWith({
      where: { status: "APPROVED", member: { role: "MEMBER" } },
      _sum: { amountPaisa: true },
    });
    expect(treasuryAggregate).toHaveBeenCalledWith({ _sum: { balancePaisa: true } });
  });
});
