import type { PrismaClient } from "../../generated/prisma/client";

/**
 * Read-only aggregates for the admin dashboard. Every member-derived count is
 * scoped to role MEMBER so admin and staff accounts never leak into member
 * metrics. Money stays in BigInt paisa until the page formats it for display.
 */

export type MonthWindow = {
  readonly start: Date;
  readonly end: Date;
};

export function monthWindow(now: Date, offsetMonths = 0): MonthWindow {
  const year = now.getUTCFullYear();
  const monthIndex = now.getUTCMonth() + offsetMonths;
  return {
    start: new Date(Date.UTC(year, monthIndex, 1)),
    end: new Date(Date.UTC(year, monthIndex + 1, 1)),
  };
}

export interface AdminDashboardStats {
  readonly newMembersThisMonth: number;
  readonly newMembersLastMonth: number;
  readonly activeMembers: number;
  readonly inactiveMembers: number;
  readonly suspendedMembers: number;
  readonly pendingProofs: number;
  readonly pendingWithdrawals: number;
  readonly pendingTopUps: number;
  readonly activeInvestments: number;
  readonly totalInvestedPaisa: bigint;
  readonly lastMonthInvestedPaisa: bigint;
  readonly totalWithdrawnPaisa: bigint;
  readonly salaryTreasuryPaisa: bigint;
}

export async function loadAdminDashboardStats(
  client: PrismaClient,
  now: Date = new Date(),
): Promise<AdminDashboardStats> {
  const currentMonth = monthWindow(now);
  const previousMonth = monthWindow(now, -1);

  const [
    newMembersThisMonth,
    newMembersLastMonth,
    activeMembers,
    inactiveMembers,
    suspendedMembers,
    pendingProofs,
    pendingWithdrawals,
    pendingTopUps,
    activeInvestments,
    investedAggregate,
    lastMonthInvestedAggregate,
    withdrawnAggregate,
    treasuryAggregate,
  ] = await Promise.all([
    client.member.count({
      where: {
        role: "MEMBER",
        createdAt: { gte: currentMonth.start, lt: currentMonth.end },
      },
    }),
    client.member.count({
      where: {
        role: "MEMBER",
        createdAt: { gte: previousMonth.start, lt: previousMonth.end },
      },
    }),
    client.member.count({ where: { role: "MEMBER", status: "ACTIVE" } }),
    client.member.count({ where: { role: "MEMBER", status: "INACTIVE" } }),
    client.member.count({ where: { role: "MEMBER", status: "SUSPENDED" } }),
    client.paymentProof.count({
      where: { status: "PENDING", member: { role: "MEMBER" } },
    }),
    client.withdrawal.count({
      where: { status: "PENDING", member: { role: "MEMBER" } },
    }),
    client.walletTopUp.count({
      where: { status: "PENDING", member: { role: "MEMBER" } },
    }),
    client.investment.count({
      where: { status: "ACTIVE", member: { role: "MEMBER" } },
    }),
    client.investment.aggregate({
      where: { status: "ACTIVE", member: { role: "MEMBER" } },
      _sum: { amountPaisa: true },
    }),
    client.investment.aggregate({
      where: {
        status: "ACTIVE",
        member: { role: "MEMBER" },
        createdAt: { gte: previousMonth.start, lt: previousMonth.end },
      },
      _sum: { amountPaisa: true },
    }),
    client.withdrawal.aggregate({
      where: { status: "PAID", member: { role: "MEMBER" } },
      _sum: { netPaisa: true },
    }),
    client.salaryTreasury.aggregate({ _sum: { balancePaisa: true } }),
  ]);

  return {
    newMembersThisMonth,
    newMembersLastMonth,
    activeMembers,
    inactiveMembers,
    suspendedMembers,
    pendingProofs,
    pendingWithdrawals,
    pendingTopUps,
    activeInvestments,
    totalInvestedPaisa: investedAggregate._sum.amountPaisa ?? 0n,
    lastMonthInvestedPaisa: lastMonthInvestedAggregate._sum.amountPaisa ?? 0n,
    totalWithdrawnPaisa: withdrawnAggregate._sum.netPaisa ?? 0n,
    salaryTreasuryPaisa: treasuryAggregate._sum.balancePaisa ?? 0n,
  };
}
