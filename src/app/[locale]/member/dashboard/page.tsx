import { getTranslations, setRequestLocale } from "next-intl/server";
import { auth } from "@/auth";
import { redirect } from "@/i18n/navigation";
import {
  MetricCard,
  ProgressCard,
  RankCard,
  SalaryCard,
} from "@/components/member/dashboard/dashboard-cards";
import { DashboardCarousel } from "@/components/member/dashboard/dashboard-carousel";
import { DashboardHeader } from "@/components/member/dashboard/dashboard-header";
import { ProgressAnalytics } from "@/components/member/dashboard/progress-analytics";
import { RecentActivity } from "@/components/member/dashboard/recent-activity";
import { getMemberDashboardData } from "@/lib/services/member-dashboard";
import { getMemberRankData } from "@/lib/services/rank-rewards";
import { formatSP } from "@/lib/money";
import { localizedRankName } from "@/lib/rank-label";
import { rankProgressPercent } from "@/lib/rank-progress";
import { prisma } from "@/lib/prisma";
import {
  isSalaryRankKey,
  salaryReceivedTotals,
  salaryWeeksProgress,
} from "@/lib/salary";
import { getActiveSalaryPlan } from "@/lib/services/salary-plan";

export const dynamic = "force-dynamic";

export default async function MemberDashboardPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const [session, tm] = await Promise.all([auth(), getTranslations("memberPanel")]);
  if (!session?.user?.id) {
    redirect({ href: "/login", locale });
    return null;
  }

  const [salaryPlan, data, rankData, wallet, salaryWallet, salaryEntitlement, salaryPayments] =
    await Promise.all([
      getActiveSalaryPlan(prisma),
      getMemberDashboardData(session.user.id, locale),
      getMemberRankData(prisma, session.user.id),
      prisma.wallet.findUnique({
        where: { memberId: session.user.id },
        select: { availablePaisa: true },
      }),
      prisma.wallet.findUnique({
        where: { memberId: session.user.id },
        select: { salaryPaisa: true },
      }),
      prisma.salaryEntitlement.findUnique({
        where: { memberId: session.user.id },
        select: { rankKey: true, weeksPaid: true, isActive: true },
      }),
      prisma.salaryPayment.findMany({
        where: { memberId: session.user.id, status: "SUCCESS" },
        select: { amountPaisa: true, createdAt: true },
        orderBy: { createdAt: "desc" },
      }),
    ]);
  if (!data) {
    redirect({ href: "/login", locale });
    return null;
  }

  const { overview } = data;
  const inactive = data.member.status === "INACTIVE";
  const rankLabel = data.rank ? localizedRankName(data.rank, locale) : tm("noRankYet");
  const displayRankKey = data.rank?.rankKey ?? null;
  const salaryConfig =
    displayRankKey && salaryEntitlement?.isActive && isSalaryRankKey(displayRankKey)
      ? salaryPlan.configs[displayRankKey]
      : null;
  const salaryReceived = salaryReceivedTotals(salaryPayments);
  const rankProgressPercentValue = rankProgressPercent({
    nextRank: rankData.nextRank,
    bestDirectPaisa: rankData.progress.bestDirectInvestment?.amountPaisa,
  });
  const rankProgressLabel = rankData.nextRank
    ? tm("averageProgress")
    : tm("allRanksAchieved");
  const salaryProgress = salaryConfig
    ? salaryWeeksProgress(salaryEntitlement?.weeksPaid ?? 0, salaryConfig.maxWeeks)
    : { percent: 0, remaining: null };
  const salaryPaidLabel = `${salaryEntitlement?.weeksPaid ?? 0} ${tm("week")} ${tm("paidShort")}`;
  const salaryRemainingLabel = !salaryConfig
    ? tm("salaryNoEntitlement")
    : salaryConfig.maxWeeks === null
      ? tm("salaryOngoing")
      : `${salaryProgress.remaining ?? 0} ${tm("week")} ${tm("remainingShort")}`;
  const salaryLastWeekLabel = tm("salaryLastWeek");
  const salaryLastWeekAmount = formatSP(salaryReceived.lastWeekPaisa);
  const salaryThisMonthLabel = tm("salaryThisMonth");
  const salaryThisMonthAmount = formatSP(salaryReceived.thisMonthPaisa);

  return (
    <div className="space-y-8 animate-rise">
      <DashboardHeader
        name={data.member.name}
        memberId={data.member.memberId}
        image={data.member.image}
        rankBadge={
          data.rank
            ? { src: data.rank.badgeImageUrl, rankKey: data.rank.rankKey }
            : null
        }
        inactive={inactive}
        availablePaisa={wallet?.availablePaisa.toString() ?? "0"}
        welcomeLabel={tm("welcomeBack")}
        memberIdLabel={tm("memberId")}
      />

      <DashboardCarousel title={tm("memberOverview")}>
        <div className="grid h-full grid-cols-2 gap-3 md:grid-cols-4">
          <MetricCard label={tm("teamTotalMembers")} value={overview.teamMembers} />
          <MetricCard label={tm("directReferrals")} value={overview.directReferrals} />
          <MetricCard label={tm("teamInvestment")} value={overview.teamInvestment} />
          <MetricCard label={tm("totalInvested")} value={overview.totalInvested} />
        </div>

        <div className="grid h-full grid-cols-2 gap-3 md:grid-cols-4">
          <MetricCard label={tm("investmentProfitEarned")} value={overview.profitEarned} />
          <MetricCard label={tm("affiliateRewards")} value={overview.affiliateRewards} />
          <MetricCard
            label={tm("availableBalance")}
            value={overview.availableBalance}
            inactive={inactive}
          />
          <MetricCard
            label={tm("activeInvestments")}
            value={overview.activeInvestments}
            inactive={inactive}
          />
        </div>

        {overview.hasActiveInstallment || overview.hasActiveProfitOnly ? (
          <div className="grid h-full grid-rows-2 gap-3 md:grid-cols-2 md:grid-rows-1">
            {overview.hasActiveInstallment ? (
              <ProgressCard
                title={tm("installmentReturn")}
                returned={overview.installmentReturn.returned}
                total={overview.installmentReturn.total}
                percent={overview.installmentReturn.percent}
                returnedLabel={tm("capitalReturned")}
                totalLabel={tm("totalCapitalExpected")}
              />
            ) : null}
            {overview.hasActiveProfitOnly ? (
              <ProgressCard
                title={tm("profitOnly")}
                returned={overview.profitOnly.returned}
                total={overview.profitOnly.total}
                percent={overview.profitOnly.percent}
                returnedLabel={tm("profitReceived")}
                totalLabel={tm("totalScheduledProfit")}
              />
            ) : null}
          </div>
        ) : null}

        <div className="grid h-full grid-rows-2 gap-3 md:grid-cols-2 md:grid-rows-1">
          <RankCard
            title={tm("currentRank")}
            rank={data.rank}
            rankLabel={rankLabel}
            emptyLabel={tm("noRankYet")}
            actionLabel={tm("viewRankRewards")}
            progressPercent={rankProgressPercentValue}
            progressLabel={rankProgressLabel}
            inactive={inactive}
          />
          <SalaryCard
            title={tm("salary")}
            rankKey={displayRankKey}
            balance={formatSP(salaryWallet?.salaryPaisa ?? 0n)}
            progressPercent={salaryProgress.percent}
            progressLabel={tm("salaryProgress")}
            progressValueLabel={salaryConfig?.maxWeeks === null ? "∞" : undefined}
            progressLeftLabel={salaryPaidLabel}
            progressRightLabel={salaryRemainingLabel}
            lastWeekLabel={salaryLastWeekLabel}
            lastWeekAmount={salaryLastWeekAmount}
            thisMonthLabel={salaryThisMonthLabel}
            thisMonthAmount={salaryThisMonthAmount}
          />
        </div>
      </DashboardCarousel>

      <RecentActivity entries={data.recentActivity} />

      <ProgressAnalytics
        locale={locale}
        rankData={rankData}
        teamGrowth={data.teamGrowth}
        salaryConfig={salaryConfig}
        salaryEntitlement={salaryEntitlement}
        salaryPayments={salaryPayments}
        salaryWalletPaisa={salaryWallet?.salaryPaisa ?? 0n}
      />
    </div>
  );
}
