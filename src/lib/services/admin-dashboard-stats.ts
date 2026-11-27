import type { PrismaClient } from "../../generated/prisma/client";

/**
 * Read-only aggregates for the admin dashboard. Every member-derived count is
 * scoped to role MEMBER so admin and staff accounts never leak into member
 * metrics. Money stays in BigInt paisa until the page formats it for display.
 */

const DAY_MS = 86_400_000;

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

export type SignupPoint = {
  readonly date: string;
  readonly count: number;
  /** Present on the all-time monthly series so a hover can show growth to date. */
  readonly cumulative?: number;
};

export type MoneyTrendPoint = {
  readonly date: string;
  /** Serialized bigint paisa; money stays exact until the client formats it. */
  readonly amountPaisa: string;
};

type DatedMoneyRow = {
  readonly createdAt: Date;
  readonly amountPaisa: bigint | null;
};

/** Thirty UTC calendar days ending today, oldest first. */
export function buildSignupSeries(createdAt: readonly Date[], now: Date): SignupPoint[] {
  const todayStart = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const firstDayStart = todayStart - 29 * DAY_MS;
  const counts = new Map<string, number>();

  for (const value of createdAt) {
    const key = value.toISOString().slice(0, 10);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return Array.from({ length: 30 }, (_, index) => {
    const date = new Date(firstDayStart + index * DAY_MS).toISOString().slice(0, 10);
    return { date, count: counts.get(date) ?? 0 };
  });
}

/** UTC monthly buckets from the first member through the current month. */
export function buildAllTimeSignupSeries(createdAt: readonly Date[], now: Date): SignupPoint[] {
  const monthKey = (date: Date) =>
    `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
  const countByMonth = new Map<string, number>();
  for (const value of createdAt) {
    const key = monthKey(value);
    countByMonth.set(key, (countByMonth.get(key) ?? 0) + 1);
  }

  const firstKey = createdAt.length
    ? createdAt.map(monthKey).reduce((first, key) => (key < first ? key : first))
    : monthKey(now);
  const lastKey = monthKey(now);
  const [firstYear, firstMonth] = firstKey.split("-").map(Number) as [number, number];
  const [lastYear, lastMonth] = lastKey.split("-").map(Number) as [number, number];

  const points: SignupPoint[] = [];
  let cumulative = 0;
  let year = firstYear;
  let month = firstMonth;
  while (year < lastYear || (year === lastYear && month <= lastMonth)) {
    const key = `${year}-${String(month).padStart(2, "0")}`;
    const count = countByMonth.get(key) ?? 0;
    cumulative += count;
    points.push({ date: `${key}-01`, count, cumulative });
    month += 1;
    if (month > 12) {
      year += 1;
      month = 1;
    }
  }
  return points;
}

/** Thirty UTC calendar days with exact paisa totals, oldest first. */
export function buildMoneySeries(
  rows: readonly DatedMoneyRow[],
  now: Date,
): MoneyTrendPoint[] {
  const todayStart = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const firstDayStart = todayStart - 29 * DAY_MS;
  const totals = new Map<string, bigint>();
  for (const row of rows) {
    const key = row.createdAt.toISOString().slice(0, 10);
    totals.set(key, (totals.get(key) ?? 0n) + (row.amountPaisa ?? 0n));
  }

  return Array.from({ length: 30 }, (_, index) => {
    const date = new Date(firstDayStart + index * DAY_MS).toISOString().slice(0, 10);
    return { date, amountPaisa: (totals.get(date) ?? 0n).toString() };
  });
}

export interface AdminDashboardStats {
  readonly totalMembers: number;
  readonly newMembersThisMonth: number;
  readonly newMembersLastMonth: number;
  readonly activeMembers: number;
  readonly inactiveMembers: number;
  readonly suspendedMembers: number;
  readonly pendingInvestments: number;
  readonly pendingWithdrawals: number;
  readonly pendingTopUps: number;
  readonly activeInvestments: number;
  readonly totalInvestedPaisa: bigint;
  readonly lastMonthInvestedPaisa: bigint;
  readonly totalWithdrawnPaisa: bigint;
  readonly totalTopUpPaisa: bigint;
  readonly salaryTreasuryPaisa: bigint;
  readonly signups: readonly SignupPoint[];
  readonly signupHistory: readonly SignupPoint[];
  readonly topUpTrend: readonly MoneyTrendPoint[];
  readonly investedTrend: readonly MoneyTrendPoint[];
  readonly withdrawnTrend: readonly MoneyTrendPoint[];
}

export async function loadAdminDashboardStats(
  client: PrismaClient,
  now: Date = new Date(),
): Promise<AdminDashboardStats> {
  const currentMonth = monthWindow(now);
  const previousMonth = monthWindow(now, -1);
  const todayStart = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const signupStart = new Date(todayStart - 29 * DAY_MS);
  const signupEnd = new Date(todayStart + DAY_MS);

  const [
    totalMembers,
    newMembersThisMonth,
    newMembersLastMonth,
    activeMembers,
    inactiveMembers,
    suspendedMembers,
    pendingInvestments,
    pendingWithdrawals,
    pendingTopUps,
    activeInvestments,
    investedAggregate,
    lastMonthInvestedAggregate,
    withdrawnAggregate,
    topUpAggregate,
    treasuryAggregate,
    signupRows,
    allTimeSignupRows,
    topUpTrendRows,
    investedTrendRows,
    withdrawalTrendRows,
  ] = await Promise.all([
    client.member.count({ where: { role: "MEMBER" } }),
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
    client.investment.count({
      where: {
        member: { role: "MEMBER" },
        paymentProofs: { some: { status: "PENDING" } },
      },
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
    client.walletTopUp.aggregate({
      where: { status: "APPROVED", member: { role: "MEMBER" } },
      _sum: { amountPaisa: true },
    }),
    client.salaryTreasury.aggregate({ _sum: { balancePaisa: true } }),
    client.member.findMany({
      where: {
        role: "MEMBER",
        createdAt: { gte: signupStart, lt: signupEnd },
      },
      select: { createdAt: true },
      orderBy: { createdAt: "asc" },
    }),
    client.member.findMany({
      where: { role: "MEMBER" },
      select: { createdAt: true },
      orderBy: { createdAt: "asc" },
    }),
    client.walletTopUp.findMany({
      where: {
        status: "APPROVED",
        member: { role: "MEMBER" },
        createdAt: { gte: signupStart, lt: signupEnd },
      },
      select: { createdAt: true, amountPaisa: true },
      orderBy: { createdAt: "asc" },
    }),
    client.investment.findMany({
      where: {
        status: "ACTIVE",
        member: { role: "MEMBER" },
        createdAt: { gte: signupStart, lt: signupEnd },
      },
      select: { createdAt: true, amountPaisa: true },
      orderBy: { createdAt: "asc" },
    }),
    client.withdrawal.findMany({
      where: {
        status: "PAID",
        member: { role: "MEMBER" },
        requestedAt: { gte: signupStart, lt: signupEnd },
      },
      select: { requestedAt: true, netPaisa: true },
      orderBy: { requestedAt: "asc" },
    }),
  ]);

  return {
    totalMembers,
    newMembersThisMonth,
    newMembersLastMonth,
    activeMembers,
    inactiveMembers,
    suspendedMembers,
    pendingInvestments,
    pendingWithdrawals,
    pendingTopUps,
    activeInvestments,
    totalInvestedPaisa: investedAggregate._sum.amountPaisa ?? 0n,
    lastMonthInvestedPaisa: lastMonthInvestedAggregate._sum.amountPaisa ?? 0n,
    totalWithdrawnPaisa: withdrawnAggregate._sum.netPaisa ?? 0n,
    totalTopUpPaisa: topUpAggregate._sum.amountPaisa ?? 0n,
    salaryTreasuryPaisa: treasuryAggregate._sum.balancePaisa ?? 0n,
    signups: buildSignupSeries(
      signupRows.map((row) => row.createdAt),
      now,
    ),
    signupHistory: buildAllTimeSignupSeries(
      allTimeSignupRows.map((row) => row.createdAt),
      now,
    ),
    topUpTrend: buildMoneySeries(topUpTrendRows, now),
    investedTrend: buildMoneySeries(investedTrendRows, now),
    withdrawnTrend: buildMoneySeries(
      withdrawalTrendRows.map((row) => ({
        createdAt: row.requestedAt,
        amountPaisa: row.netPaisa,
      })),
      now,
    ),
  };
}
