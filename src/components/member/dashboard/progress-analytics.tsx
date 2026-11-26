import type { ReactNode } from "react";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { formatMemberDate } from "@/components/member/format-date";
import { InfinityText } from "@/components/ui/infinity-text";
import { RankBadge } from "@/components/ui/rank-badge";
import { formatSP } from "@/lib/money";
import { rankAccent, rankProgressGradient, type RankAccent } from "@/lib/rank-accent";
import { localizedRankName } from "@/lib/rank-label";
import {
  nextSalaryBoundary,
  salaryReceivedTotals,
  salaryWeeksProgress,
  type SalaryRankConfig,
} from "@/lib/salary";
import type { DashboardMemberGrowth } from "@/lib/services/member-dashboard";
import type { MemberRankDto } from "@/lib/services/rank-rewards";
import { cn } from "@/lib/utils";
import { DashboardCarousel } from "./dashboard-carousel";

type SalaryEntitlement = {
  readonly rankKey: string;
  readonly weeksPaid: number;
};

type SalaryPayment = {
  readonly amountPaisa: bigint;
  readonly createdAt: Date;
};

type Props = {
  readonly locale: string;
  readonly rankData: MemberRankDto;
  readonly teamGrowth: DashboardMemberGrowth;
  readonly salaryConfig: SalaryRankConfig | null;
  readonly salaryEntitlement: SalaryEntitlement | null;
  readonly salaryPayments: readonly SalaryPayment[];
  readonly salaryWalletPaisa: bigint;
};

function clampPercent(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, value));
}

function ratioPercent(part: bigint, total: bigint) {
  if (total <= 0n) return 0;
  return clampPercent(Number((part * 10_000n) / total) / 100);
}

function formatShortDate(value: Date, locale: string) {
  return new Intl.DateTimeFormat(locale === "bn" ? "bn-BD" : "en-BD", {
    day: "numeric",
    month: "short",
  }).format(value);
}

function CompactCard({
  title,
  rankKey,
  children,
  className,
  backgroundImage,
}: {
  title: string;
  rankKey?: string | null;
  children: ReactNode;
  className?: string;
  backgroundImage?: string;
}) {
  const accent = rankAccent(rankKey);
  const gradient =
    backgroundImage ?? (rankKey ? accent.backgroundImage || undefined : undefined);

  return (
    <article
      style={gradient ? { backgroundImage: gradient } : undefined}
      className={cn(
        "glass h-full w-full rounded-2xl border border-border/60 p-3.5 sm:p-4",
        rankKey && accent.border,
        className,
      )}
    >
      <h3 className="text-[13px] font-semibold leading-tight">{title}</h3>
      <div className="mt-3">{children}</div>
    </article>
  );
}

function CompactMeter({
  percent,
  label,
  accent,
  valueLabel,
  gradient,
}: {
  percent: number;
  label: string;
  accent: RankAccent;
  valueLabel?: string;
  gradient?: string | null;
}) {
  const width = clampPercent(percent);

  return (
    <div className="mt-3">
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-[10px] text-muted-foreground">{label}</span>
        <span className={cn("shrink-0 text-[11px] font-bold tabular-nums", accent.eyebrow)}>
          <InfinityText value={valueLabel ?? `${Math.round(width)}%`} />
        </span>
      </div>
      <div
        className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted/80"
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(width)}
        aria-valuetext={valueLabel ? `${label}: ${valueLabel}` : undefined}
      >
        <div
          className={cn(
            "h-full rounded-full transition-[width] duration-500",
            gradient ?? accent.progress,
          )}
          style={{ width: `${width}%` }}
        />
      </div>
    </div>
  );
}

function MemberGrowthCard({
  growth,
  title,
  activeLabel,
  inactiveLabel,
  newLabel,
  chartLabel,
  emptyLabel,
}: {
  growth: DashboardMemberGrowth;
  title: string;
  activeLabel: string;
  inactiveLabel: string;
  newLabel: string;
  chartLabel: string;
  emptyLabel: string;
}) {
  const joins = growth.dailyJoins;
  const max = joins.reduce((largest, point) => Math.max(largest, point.value), 0);
  const lastLabel = joins.at(-1)?.label ?? "";

  return (
    <CompactCard title={title}>
      <div className="grid grid-cols-3 gap-2">
        <div className="min-w-0 rounded-lg border border-border/50 bg-background/40 px-2 py-1.5">
          <p className="truncate text-[9px] font-semibold text-muted-foreground">{activeLabel}</p>
          <p className="mt-0.5 text-sm font-bold tabular-nums text-emerald-700 dark:text-emerald-300">
            {growth.activeMembers}
          </p>
        </div>
        <div className="min-w-0 rounded-lg border border-border/50 bg-background/40 px-2 py-1.5">
          <p className="truncate text-[9px] font-semibold text-muted-foreground">{inactiveLabel}</p>
          <p className="mt-0.5 text-sm font-bold tabular-nums text-muted-foreground">
            {growth.inactiveMembers}
          </p>
        </div>
        <div className="min-w-0 rounded-lg border border-border/50 bg-background/40 px-2 py-1.5">
          <p className="truncate text-[9px] font-semibold text-muted-foreground">{newLabel}</p>
          <p className="mt-0.5 text-sm font-bold tabular-nums text-sky-700 dark:text-sky-300">
            {growth.newMembersThisMonth}
          </p>
        </div>
      </div>

      <div className="mt-3">
        <div className="flex items-center justify-between gap-2 text-[9px] text-muted-foreground">
          <span className="truncate">{chartLabel}</span>
          <span className="shrink-0 font-semibold tabular-nums">
            {growth.newMembersThisMonth}
          </span>
        </div>
        <div
          className="mt-2 flex h-12 items-end gap-[2px]"
          role="img"
          aria-label={`${chartLabel}: ${joins
            .filter((point) => point.value > 0)
            .map((point) => `${point.label}: ${point.value}`)
            .join(", ") || emptyLabel}`}
        >
          {joins.map((point) => (
            <span
              key={point.label}
              title={`${point.label}: ${point.value}`}
              className="min-w-0 flex-1 rounded-t-sm bg-emerald-500/80 dark:bg-emerald-400/80"
              style={{ height: point.value > 0 ? `${Math.max(8, (point.value / Math.max(1, max)) * 100)}%` : "2px" }}
            />
          ))}
        </div>
        <div className="mt-1 flex justify-between text-[9px] text-muted-foreground">
          <span>1</span>
          <span>{lastLabel}</span>
        </div>
        {growth.newMembersThisMonth === 0 ? (
          <p className="mt-1 text-center text-[9px] text-muted-foreground">{emptyLabel}</p>
        ) : null}
      </div>
    </CompactCard>
  );
}

function QualificationRow({
  label,
  currentPaisa,
  targetPaisa,
  accent,
}: {
  label: string;
  currentPaisa: bigint;
  targetPaisa: bigint;
  accent: RankAccent;
}) {
  const width = ratioPercent(currentPaisa, targetPaisa);
  const met = targetPaisa > 0n && currentPaisa >= targetPaisa;

  return (
    <li>
      <div className="flex items-baseline justify-between gap-2">
        <span className="truncate text-[11px] font-semibold">{label}</span>
        <span className="shrink-0 text-[10px] font-bold tabular-nums">{Math.round(width)}%</span>
      </div>
      <div
        className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted/80"
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(width)}
      >
        <div
          className={cn("h-full rounded-full", met ? accent.progress : "bg-muted-foreground/40")}
          style={{ width: `${width}%` }}
        />
      </div>
      <p className="mt-1 break-words text-[9px] leading-tight text-muted-foreground tabular-nums">
        {formatSP(currentPaisa)} / {formatSP(targetPaisa)}
      </p>
    </li>
  );
}

function PaymentBars({
  payments,
  locale,
  emptyLabel,
}: {
  payments: readonly SalaryPayment[];
  locale: string;
  emptyLabel: string;
}) {
  if (payments.length === 0) {
    return <p className="py-5 text-center text-xs text-muted-foreground">{emptyLabel}</p>;
  }

  const max = payments.reduce((largest, payment) => {
    return payment.amountPaisa > largest ? payment.amountPaisa : largest;
  }, 0n);

  return (
    <div>
      <div
        className="flex h-11 items-end gap-1.5"
        role="img"
        aria-label={payments
          .map((payment) => `${formatShortDate(payment.createdAt, locale)}: ${formatSP(payment.amountPaisa)}`)
          .join(", ")}
      >
        {payments.map((payment) => {
          const percent = ratioPercent(payment.amountPaisa, max);
          return (
            <span
              key={payment.createdAt.toISOString()}
              title={`${formatShortDate(payment.createdAt, locale)} · ${formatSP(payment.amountPaisa)}`}
              className="min-w-0 flex-1 rounded-t-sm bg-sky-500/80 dark:bg-sky-400/80"
              style={{ height: percent > 0 ? `${Math.max(8, percent)}%` : "2px" }}
            />
          );
        })}
      </div>
      <div className="mt-1.5 flex justify-between text-[9px] text-muted-foreground">
        <span>{formatShortDate(payments[0]!.createdAt, locale)}</span>
        <span>{formatShortDate(payments[payments.length - 1]!.createdAt, locale)}</span>
      </div>
    </div>
  );
}

export async function ProgressAnalytics({
  locale,
  rankData,
  teamGrowth,
  salaryConfig,
  salaryEntitlement,
  salaryPayments,
  salaryWalletPaisa,
}: Props) {
  const t = await getTranslations("memberPanel");

  const displayRankKey = rankData.currentRank?.rankKey ?? null;
  const salaryAccent = rankAccent(displayRankKey);
  const salaryProgress = salaryConfig
    ? salaryWeeksProgress(salaryEntitlement?.weeksPaid ?? 0, salaryConfig.maxWeeks)
    : { percent: 0, remaining: null };
  const salaryRankLabel = rankData.currentRank
    ? localizedRankName(rankData.currentRank, locale)
    : t("noRankYet");
  const salaryWeeksLabel = !salaryConfig
    ? t("salaryNoEntitlement")
    : salaryConfig.maxWeeks === null
      ? t("salaryOngoing")
      : `${salaryEntitlement?.weeksPaid ?? 0} / ${salaryConfig.maxWeeks}`;

  const payments = [...salaryPayments].sort(
    (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
  );
  const recentPayments = payments.slice(0, 8).reverse();
  const paymentTotals = salaryReceivedTotals(payments);
  const nextPayout = formatMemberDate(nextSalaryBoundary(new Date()), locale);

  const currentRank = rankData.currentRank;
  const nextRank = rankData.nextRank;
  const rankKeyForAccent = nextRank?.rankKey ?? currentRank?.rankKey ?? null;
  const rankAccentValue = rankAccent(rankKeyForAccent);

  const directCurrent = BigInt(
    rankData.progress.bestDirectInvestment?.amountPaisa ?? "0",
  );
  const directTarget = BigInt(nextRank?.directTargetPaisa ?? "0");
  const achievedCount = rankData.ranks.filter((rank) => rank.status === "ACHIEVED").length;
  const latestAchievement = rankData.history[0];
  const reward = nextRank?.reward;
  const rewardLabel =
    locale === "bn" && reward?.labelBn ? reward.labelBn : reward?.label;
  const rewardText = !reward
    ? t("nextRankNone")
    : reward.type === "SP" && reward.amountPaisa
      ? `${t("spReward")}: ${formatSP(BigInt(reward.amountPaisa))}`
      : `${t("physicalReward")}: ${rewardLabel ?? "—"}`;

  return (
    <DashboardCarousel title={t("salaryRankProgress")} desktopColumns="progress">
      <CompactCard title={t("salaryProgressTitle")} rankKey={displayRankKey}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className={cn("truncate text-xs font-semibold", salaryAccent.title)}>
              {salaryRankLabel}
            </p>
            <p className="mt-1.5 text-[10px] text-muted-foreground">{t("salaryBalance")}</p>
            <p className="mt-0.5 text-lg font-bold tabular-nums">{formatSP(salaryWalletPaisa)}</p>
          </div>
          <span className="shrink-0 rounded-lg bg-muted/60 px-2 py-1 text-[10px] font-bold tabular-nums">
            {salaryWeeksLabel}
          </span>
        </div>
        <CompactMeter
          percent={salaryProgress.percent}
          label={t("salaryWeeksPaid")}
          accent={salaryAccent}
          valueLabel={salaryConfig?.maxWeeks === null ? "∞" : undefined}
          gradient={rankProgressGradient(displayRankKey)}
        />
        <Link
          href="/member/salary"
          className="mt-3 inline-block rounded text-[10px] font-bold text-sky-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:text-sky-300"
        >
          {t("viewSalaryDetails")}
        </Link>
      </CompactCard>

      <CompactCard
        title={t("salaryPayments")}
        className="border-sky-500/20 dark:border-sky-300/20"
        backgroundImage="linear-gradient(110deg, rgba(14,165,233,0.13) 0%, rgba(14,165,233,0.04) 52%, transparent 80%)"
      >
        <div className="grid grid-cols-2 gap-2">
          <div className="min-w-0 rounded-lg border border-border/50 bg-background/40 px-2 py-1.5">
            <p className="truncate text-[9px] font-semibold text-muted-foreground">
              {t("salaryLastWeek")}
            </p>
            <p className="mt-0.5 truncate text-xs font-bold tabular-nums text-sky-700 dark:text-sky-300">
              {formatSP(paymentTotals.lastWeekPaisa)}
            </p>
          </div>
          <div className="min-w-0 rounded-lg border border-border/50 bg-background/40 px-2 py-1.5">
            <p className="truncate text-[9px] font-semibold text-muted-foreground">
              {t("salaryThisMonth")}
            </p>
            <p className="mt-0.5 truncate text-xs font-bold tabular-nums text-sky-700 dark:text-sky-300">
              {formatSP(paymentTotals.thisMonthPaisa)}
            </p>
          </div>
        </div>
        <div className="mt-3">
          <PaymentBars
            payments={recentPayments}
            locale={locale}
            emptyLabel={t("salaryNoPayments")}
          />
        </div>
        <p className="mt-2 truncate text-[9px] text-muted-foreground">
          {t("nextPayout")}: <span className="font-semibold">{nextPayout}</span>
        </p>
      </CompactCard>

      <MemberGrowthCard
        growth={teamGrowth}
        title={t("teamNewThisMonth")}
        activeLabel={t("teamActiveMembers")}
        inactiveLabel={t("teamInactiveMembers")}
        newLabel={t("teamNewThisMonth")}
        chartLabel={t("teamDailyJoins")}
        emptyLabel={t("noNewMembersThisMonth")}
      />

      <CompactCard title={t("qualificationPath")} rankKey={nextRank?.rankKey}>
        {nextRank ? (
          <ul className="space-y-2.5">
            <QualificationRow
              label={t("bestDirectInvestment")}
              currentPaisa={directCurrent}
              targetPaisa={directTarget}
              accent={rankAccentValue}
            />
            {nextRank.teamTargetsPaisa.map((targetPaisa, index) => (
              <QualificationRow
                key={index}
                label={t(`team${index + 1}`)}
                currentPaisa={BigInt(nextRank.teamTotalsPaisa[index] ?? "0")}
                targetPaisa={BigInt(targetPaisa)}
                accent={rankAccentValue}
              />
            ))}
          </ul>
        ) : (
          <p className="py-5 text-center text-xs text-muted-foreground">
            {t("allRanksAchieved")}
          </p>
        )}
      </CompactCard>

      <CompactCard title={t("rankRewardsCard")} rankKey={rankKeyForAccent}>
        <div className="flex items-center gap-2">
          {nextRank ? (
            <RankBadge src={nextRank.badgeImageUrl} rankKey={nextRank.rankKey} size={38} />
          ) : currentRank ? (
            <RankBadge
              src={currentRank.badgeImageUrl}
              rankKey={currentRank.rankKey}
              size={38}
            />
          ) : null}
          <div className="min-w-0">
            <p className="text-[10px] text-muted-foreground">
              {nextRank ? t("nextRank") : t("currentRank")}
            </p>
            <p className={cn("truncate text-xs font-semibold", rankAccentValue.title)}>
              {nextRank
                ? localizedRankName(nextRank, locale)
                : currentRank
                  ? localizedRankName(currentRank, locale)
                  : t("noRankYet")}
            </p>
            <p className="mt-0.5 break-words text-[10px] text-muted-foreground">{rewardText}</p>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-x-2 gap-y-1 border-t border-border/60 pt-2 text-[10px] text-muted-foreground">
          <span className="tabular-nums">
            {achievedCount} / {rankData.ranks.length} {t("ranksAchieved")}
          </span>
          {latestAchievement ? (
            <span>{formatMemberDate(new Date(latestAchievement.achievedAt), locale)}</span>
          ) : null}
        </div>
        <Link
          href="/member/rank-rewards"
          className="mt-3 inline-block rounded text-[10px] font-bold hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {t("viewRankRewards")}
        </Link>
      </CompactCard>
    </DashboardCarousel>
  );
}
