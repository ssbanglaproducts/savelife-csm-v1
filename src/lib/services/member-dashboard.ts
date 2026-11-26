import { formatMemberDate } from "@/components/member/format-date";
import {
  ledgerTypeLabelKey,
  walletCategoryLabelKey,
} from "@/components/member/status-labels";
import { formatSP, type Paisa } from "../money";
import { prisma } from "../prisma";
import { getMemberRankSummaries, type MemberRankSummary } from "./member-rank-summary";
import { getTeamOverview, TEAM_INVESTMENT_STATUSES } from "./team";

export type DashboardChartPoint = {
  readonly label: string;
  readonly value: number;
  readonly amount: string;
};

export type DashboardProgress = {
  readonly returned: string;
  readonly total: string;
  readonly percent: number;
};

export type DashboardSummarySlice = DashboardChartPoint & {
  readonly typeKey: string;
  readonly share: number;
};

export type DashboardRemaining = {
  readonly labelKey: string;
  readonly value: number;
  readonly amount: string;
};

export type DashboardRecentEntry = {
  readonly id: string;
  readonly typeKey: string;
  readonly dateTime: string;
  readonly amount: string;
  readonly direction: "IN" | "OUT" | "TRANSFER";
  readonly sourceLabelKey?: string;
};

export type DashboardMemberGrowth = {
  readonly totalMembers: number;
  readonly activeMembers: number;
  readonly inactiveMembers: number;
  readonly newMembersThisMonth: number;
  readonly dailyJoins: readonly { readonly label: string; readonly value: number }[];
};

export type MemberDashboardData = {
  readonly member: {
    readonly name: string;
    readonly memberId: string;
    readonly status: string;
    readonly image: string | null;
  };
  readonly rank: MemberRankSummary | null;
  readonly overview: {
    readonly teamMembers: string;
    readonly directReferrals: string;
    readonly teamInvestment: string;
    readonly totalInvested: string;
    readonly profitEarned: string;
    readonly affiliateRewards: string;
    readonly availableBalance: string;
    readonly activeInvestments: string;
    readonly installmentReturn: DashboardProgress;
    readonly profitOnly: DashboardProgress;
    readonly hasActiveInstallment: boolean;
    readonly hasActiveProfitOnly: boolean;
  };
  readonly recentActivity: readonly DashboardRecentEntry[];
  readonly teamGrowth: DashboardMemberGrowth;
  readonly analytics: {
    readonly activityWeek: readonly DashboardChartPoint[];
    readonly activityMonth: readonly DashboardChartPoint[];
    readonly summary: readonly DashboardSummarySlice[];
    readonly scheduledReturns: readonly DashboardChartPoint[];
    readonly scheduledTotal: string;
    readonly remainingReturns: readonly DashboardRemaining[];
    readonly upcomingReturns: readonly DashboardChartPoint[];
  };
};

type InstallmentRow = {
  readonly amountPaisa: Paisa;
  readonly installments: readonly {
    readonly amountPaisa: Paisa;
    readonly status: string;
  }[];
};

type ProfitLineRow = {
  readonly allocatedPaisa: Paisa;
  readonly distribution: { readonly status: string };
};

function sum(values: readonly bigint[]): bigint {
  return values.reduce((total, value) => total + value, 0n);
}

/** Chart geometry only; every visible amount uses the exact BigInt value. */
function chartValue(paisa: bigint): number {
  const value = Number(paisa) / 100;
  return Number.isFinite(value) ? value : 0;
}

function percentOf(part: bigint, total: bigint): number {
  if (total <= 0n) return 0;
  const basisPoints = (part * 10_000n) / total;
  return Math.min(100, Math.max(0, Number(basisPoints) / 100));
}

function monthKey(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function dayKey(date: Date): string {
  return `${monthKey(date)}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

function recentMonthKeys(now: Date, count: number): string[] {
  return Array.from({ length: count }, (_, index) =>
    monthKey(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (count - 1 - index), 1))),
  );
}

function recentDayKeys(now: Date, count: number): string[] {
  return Array.from({ length: count }, (_, index) =>
    dayKey(
      new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - (count - 1 - index))),
    ),
  );
}

function localeTag(locale: string): string {
  return locale === "bn" ? "bn-BD" : "en-BD";
}

function monthLabel(key: string, locale: string): string {
  const [year, month] = key.split("-").map(Number);
  return new Intl.DateTimeFormat(localeTag(locale), {
    month: "short",
    year: "2-digit",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year ?? 1970, (month ?? 1) - 1, 1)));
}

function dayLabel(key: string, locale: string): string {
  const [year, month, day] = key.split("-").map(Number);
  return new Intl.DateTimeFormat(localeTag(locale), {
    weekday: "short",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year ?? 1970, (month ?? 1) - 1, day ?? 1)));
}

export function summarizeInstallmentReturn(investments: readonly InstallmentRow[]): {
  returned: bigint;
  expected: bigint;
} {
  let returned = 0n;
  let expected = 0n;

  for (const investment of investments) {
    const scheduled = sum(investment.installments.map((installment) => installment.amountPaisa));
    expected += scheduled > 0n ? scheduled : investment.amountPaisa;
    returned += sum(
      investment.installments
        .filter((installment) => installment.status === "PAID")
        .map((installment) => installment.amountPaisa),
    );
  }

  return { returned: returned > expected ? expected : returned, expected };
}

export function summarizeProfitProgress(lines: readonly ProfitLineRow[]): {
  received: bigint;
  scheduled: bigint;
} {
  const scheduled = sum(lines.map((line) => line.allocatedPaisa));
  const received = sum(
    lines
      .filter((line) => line.distribution.status === "POSTED")
      .map((line) => line.allocatedPaisa),
  );

  return { received: received > scheduled ? scheduled : received, scheduled };
}

/** Only members with an active investment of a type see that progress card. */
export function activeInvestmentTypeFlags(
  investments: readonly { readonly type: string; readonly status: string }[],
): { hasActiveInstallment: boolean; hasActiveProfitOnly: boolean } {
  return {
    hasActiveInstallment: investments.some(
      (investment) => investment.type === "INSTALLMENT" && investment.status === "ACTIVE",
    ),
    hasActiveProfitOnly: investments.some(
      (investment) => investment.type === "PROFIT_ONLY" && investment.status === "ACTIVE",
    ),
  };
}

function buildActivity(
  investments: readonly { amountPaisa: Paisa; createdAt: Date }[],
  now: Date,
  locale: string,
  period: "week" | "month",
): DashboardChartPoint[] {
  const keys = period === "week" ? recentDayKeys(now, 7) : recentMonthKeys(now, 12);
  const buckets = new Map<string, bigint>(keys.map((key) => [key, 0n]));

  for (const investment of investments) {
    const key = period === "week" ? dayKey(investment.createdAt) : monthKey(investment.createdAt);
    const current = buckets.get(key);
    if (current !== undefined) buckets.set(key, current + investment.amountPaisa);
  }

  return keys.map((key) => {
    const value = buckets.get(key) ?? 0n;
    return {
      label: period === "week" ? dayLabel(key, locale) : monthLabel(key, locale),
      value: chartValue(value),
      amount: formatSP(value),
    };
  });
}

type RecentLedgerRow = {
  readonly id: string;
  readonly type: string;
  readonly direction: "CREDIT" | "DEBIT";
  readonly category: string;
  readonly amountPaisa: bigint;
  readonly createdAt: Date;
};

/**
 * Reward collection posts a debit from each reward wallet plus a matching
 * credit to Available. Show one transfer row per source wallet and hide the
 * destination credit so the same money is never counted twice.
 */
export function summarizeRecentActivity(
  rows: readonly RecentLedgerRow[],
  locale: string,
  limit = 4,
): DashboardRecentEntry[] {
  const entries: Array<DashboardRecentEntry & { readonly sortAt: Date }> = [];

  for (const row of rows) {
    if (row.type === "REWARD_COLLECTION") {
      if (row.direction !== "DEBIT") continue;
      entries.push({
        id: row.id,
        typeKey: ledgerTypeLabelKey(row.type),
        sourceLabelKey: walletCategoryLabelKey(row.category),
        dateTime: formatMemberDate(row.createdAt, locale, true),
        amount: formatSP(row.amountPaisa),
        direction: "TRANSFER",
        sortAt: row.createdAt,
      });
      continue;
    }

    entries.push({
      id: row.id,
      typeKey: ledgerTypeLabelKey(row.type),
      dateTime: formatMemberDate(row.createdAt, locale, true),
      amount: formatSP(row.amountPaisa),
      direction: row.direction === "CREDIT" ? "IN" : "OUT",
      sortAt: row.createdAt,
    });
  }

  return entries
    .sort((a, b) => b.sortAt.getTime() - a.sortAt.getTime())
    .slice(0, limit)
    .map((entry) => ({
      id: entry.id,
      typeKey: entry.typeKey,
      sourceLabelKey: entry.sourceLabelKey,
      dateTime: entry.dateTime,
      amount: entry.amount,
      direction: entry.direction,
    }));
}

/** Builds every value needed by the member dashboard without crossing BigInts to the client. */
export async function getMemberDashboardData(
  memberId: string,
  locale: string,
): Promise<MemberDashboardData | null> {
  const now = new Date();
  const [member, rankByMember, wallet, team, directReferrals, investedAggregate, activeInvestments, recentEntries, installmentInvestments, profitLines, ownInvestments] =
    await Promise.all([
      prisma.member.findUnique({
        where: { id: memberId },
        select: { fullName: true, memberId: true, status: true, profileImage: true },
      }),
      getMemberRankSummaries(prisma, [memberId]),
      prisma.wallet.findUnique({
        where: { memberId },
        select: {
          availablePaisa: true,
          investmentPaisa: true,
          profitPaisa: true,
          affiliatePaisa: true,
        },
      }),
      getTeamOverview(prisma, memberId),
      prisma.member.count({ where: { sponsorId: memberId } }),
      prisma.investment.aggregate({
        where: { memberId, status: { in: [...TEAM_INVESTMENT_STATUSES] } },
        _sum: { amountPaisa: true },
      }),
      prisma.investment.count({ where: { memberId, status: "ACTIVE" } }),
      prisma.ledgerEntry.findMany({
        where: { memberId },
        orderBy: { createdAt: "desc" },
        take: 60,
        select: {
          id: true,
          type: true,
          direction: true,
          category: true,
          amountPaisa: true,
          createdAt: true,
        },
      }),
      prisma.investment.findMany({
        where: { memberId, type: "INSTALLMENT", status: { in: [...TEAM_INVESTMENT_STATUSES] } },
        select: {
          amountPaisa: true,
          installments: { select: { amountPaisa: true, status: true } },
        },
      }),
      prisma.profitDistributionLine.findMany({
        where: {
          memberId,
          investment: { type: "PROFIT_ONLY" },
          distribution: { status: { not: "REVERSED" } },
        },
        select: {
          allocatedPaisa: true,
          distribution: { select: { status: true } },
        },
      }),
      prisma.investment.findMany({
        where: { memberId, status: { not: "REJECTED" } },
        select: {
          type: true,
          status: true,
          amountPaisa: true,
          remainingPrincipalPaisa: true,
          createdAt: true,
          installments: {
            select: { dueDate: true, amountPaisa: true, status: true },
          },
        },
      }),
    ]);

  if (!member) return null;

  const installments = summarizeInstallmentReturn(installmentInvestments);
  const profit = summarizeProfitProgress(profitLines);
  const { hasActiveInstallment, hasActiveProfitOnly } = activeInvestmentTypeFlags(ownInvestments);
  const totalInvested = investedAggregate._sum.amountPaisa ?? 0n;
  const teamStats = team?.stats;
  const teamGrowth: DashboardMemberGrowth = {
    totalMembers: teamStats?.totalMembers ?? 0,
    activeMembers: teamStats?.activeMembers ?? 0,
    inactiveMembers: teamStats?.inactiveMembers ?? 0,
    newMembersThisMonth: teamStats?.newMembersThisMonth ?? 0,
    dailyJoins: (team?.dailyMembers ?? []).map((day) => ({
      label: String(day.day),
      value: day.joins,
    })),
  };

  const installmentTotal = sum(
    ownInvestments.filter((investment) => investment.type === "INSTALLMENT").map((investment) => investment.amountPaisa),
  );
  const profitOnlyTotal = sum(
    ownInvestments.filter((investment) => investment.type === "PROFIT_ONLY").map((investment) => investment.amountPaisa),
  );
  const summaryTotal = installmentTotal + profitOnlyTotal;
  const capitalRemaining = sum(ownInvestments.map((investment) => investment.remainingPrincipalPaisa));
  const profitRemaining = profit.scheduled > profit.received ? profit.scheduled - profit.received : 0n;

  const pendingInstallments = ownInvestments
    .flatMap((investment) =>
      investment.installments
        .filter((installment) => installment.status === "PENDING")
        .map((installment) => ({ ...installment, investmentType: investment.type })),
    )
    .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());

  const scheduledMonthKeys = recentMonthKeys(now, 6);
  const scheduledBuckets = new Map<string, bigint>(
    scheduledMonthKeys.map((key) => [key, 0n]),
  );
  let scheduledTotalPaisa = 0n;
  for (const installment of pendingInstallments) {
    const key = monthKey(installment.dueDate);
    const current = scheduledBuckets.get(key);
    if (current !== undefined) scheduledBuckets.set(key, current + installment.amountPaisa);
    scheduledTotalPaisa += installment.amountPaisa;
  }

  return {
    member: {
      name: member.fullName,
      memberId: member.memberId,
      status: member.status,
      image: member.profileImage,
    },
    rank: rankByMember.get(memberId) ?? null,
    overview: {
      teamMembers: String(teamStats?.totalMembers ?? 0),
      directReferrals: String(directReferrals),
      teamInvestment: formatSP(teamStats?.totalInvestmentPaisa ?? 0n),
      totalInvested: formatSP(totalInvested),
      profitEarned: formatSP(wallet?.profitPaisa ?? 0n),
      affiliateRewards: formatSP(wallet?.affiliatePaisa ?? 0n),
      availableBalance: formatSP(wallet?.availablePaisa ?? 0n),
      activeInvestments: String(activeInvestments),
      installmentReturn: {
        returned: formatSP(installments.returned),
        total: formatSP(installments.expected),
        percent: percentOf(installments.returned, installments.expected),
      },
      profitOnly: {
        returned: formatSP(profit.received),
        total: formatSP(profit.scheduled),
        percent: percentOf(profit.received, profit.scheduled),
      },
      hasActiveInstallment,
      hasActiveProfitOnly,
    },
    recentActivity: summarizeRecentActivity(recentEntries, locale),
    teamGrowth,
    analytics: {
      activityWeek: buildActivity(ownInvestments, now, locale, "week"),
      activityMonth: buildActivity(ownInvestments, now, locale, "month"),
      summary: [
        {
          typeKey: "installment",
          label: "",
          value: chartValue(installmentTotal),
          amount: formatSP(installmentTotal),
          share: summaryTotal > 0n ? Number((installmentTotal * 100n) / summaryTotal) : 0,
        },
        {
          typeKey: "profitOnly",
          label: "",
          value: chartValue(profitOnlyTotal),
          amount: formatSP(profitOnlyTotal),
          share: summaryTotal > 0n ? Number((profitOnlyTotal * 100n) / summaryTotal) : 0,
        },
      ],
      scheduledReturns: scheduledMonthKeys.map((key) => {
        const value = scheduledBuckets.get(key) ?? 0n;
        return {
          label: monthLabel(key, locale),
          value: chartValue(value),
          amount: formatSP(value),
        };
      }),
      scheduledTotal: formatSP(scheduledTotalPaisa),
      remainingReturns: [
        {
          labelKey: "remainingCapital",
          value: chartValue(capitalRemaining),
          amount: formatSP(capitalRemaining),
        },
        {
          labelKey: "remainingProfit",
          value: chartValue(profitRemaining),
          amount: formatSP(profitRemaining),
        },
      ],
      upcomingReturns: pendingInstallments.slice(0, 4).map((installment) => ({
        label: formatMemberDate(installment.dueDate, locale),
        value: chartValue(installment.amountPaisa),
        amount: formatSP(installment.amountPaisa),
      })),
    },
  };
}
