"use client";

import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import {
  ArrowLeft,
  CalendarDays,
  ChevronRight,
  Gift,
  Info,
  Landmark,
  ReceiptText,
  UserCheck,
  Users,
  UserX,
} from "lucide-react";
import { Link } from "@/i18n/navigation";
import { buttonVariants } from "@/components/ui/button";
import { PageHeader } from "@/components/member/page-header";
import { formatSP } from "@/lib/money";
import type { TeamOverviewDto } from "@/lib/services/team";
import { InvestmentActivityChart, MiniBars, TrendCard } from "./team-charts";
import { TeamDirectory } from "./team-directory";
import { TeamProfilePanel } from "./team-profile-panel";
import { TeamSection } from "./team-ui";

export function TeamDashboard({ data, locale }: { data: TeamOverviewDto; locale: string }) {
  const t = useTranslations("memberPanel");
  const tabsId = useId();
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const [activeTab, setActiveTab] = useState<"members" | "performance">("members");
  const tabs = [
    {
      id: "members" as const,
      label: t("teamTabMembers"),
      icon: <Users className="size-4" aria-hidden="true" />,
    },
    {
      id: "performance" as const,
      label: t("teamTabPerformance"),
      icon: <ReceiptText className="size-4" aria-hidden="true" />,
    },
  ];
  const isOwnTeam = data.scope.id === data.breadcrumbs[0]?.id;
  const trail = isOwnTeam ? [] : data.breadcrumbs.slice(1);
  const hasActivity =
    data.stats.totalMembers > 0 ||
    BigInt(data.stats.totalInvestmentPaisa) > 0n ||
    BigInt(data.stats.totalReturnsPaisa) > 0n ||
    BigInt(data.stats.totalAffiliateRewardsPaisa) > 0n;

  function handleTabKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    const currentIndex = tabs.findIndex((tab) => tab.id === activeTab);
    let nextIndex = currentIndex;

    if (event.key === "ArrowRight") nextIndex = (currentIndex + 1) % tabs.length;
    else if (event.key === "ArrowLeft") nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
    else if (event.key === "Home") nextIndex = 0;
    else if (event.key === "End") nextIndex = tabs.length - 1;
    else return;

    event.preventDefault();
    setActiveTab(tabs[nextIndex].id);
    tabRefs.current[nextIndex]?.focus();
  }

  return (
    <div className="space-y-8 animate-rise">
      <PageHeader
        eyebrow={t("teamScopeLabel")}
        title={t("teamTitle")}
        intro={t("teamIntro")}
        icon={<Users className="size-3.5" aria-hidden="true" />}
      />

      <nav aria-label={t("teamScopeLabel")} className="flex min-w-0 flex-wrap items-center gap-1.5 text-xs">
        <Link
          href="/member/team"
          className="rounded-md font-semibold text-muted-foreground hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {t("teamTitle")}
        </Link>
        {trail.map((person, index) => (
          <span key={person.id} className="flex min-w-0 items-center gap-1.5">
            <ChevronRight className="size-3 shrink-0 text-muted-foreground" aria-hidden="true" />
            {index === trail.length - 1 ? (
              <span className="truncate font-semibold" aria-current="page">
                {person.fullName}
              </span>
            ) : (
              <Link
                href={`/member/team?member=${encodeURIComponent(person.memberId)}`}
                className="truncate font-semibold text-muted-foreground hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {person.fullName}
              </Link>
            )}
          </span>
        ))}
      </nav>

      <div className="glass flex flex-wrap items-center justify-between gap-4 rounded-2xl p-4 sm:p-5">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
            {t("teamScopeLabel")}
          </p>
          <p className="mt-1 truncate font-display text-lg font-bold">
            {data.scope.fullName}{" "}
            <span className="font-mono text-xs font-medium text-muted-foreground" translate="no">
              {data.scope.memberId}
            </span>
          </p>
        </div>
        {!isOwnTeam ? (
          <Link href="/member/team" className={buttonVariants({ variant: "outline", size: "sm" })}>
            <ArrowLeft className="size-3.5" aria-hidden="true" />
            {t("teamBackToMyTeam")}
          </Link>
        ) : null}
      </div>

      <div role="tablist" aria-label={t("teamTitle")} className="glass flex gap-2 rounded-2xl p-2">
        {tabs.map((tab, index) => {
          const selected = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              ref={(node) => {
                tabRefs.current[index] = node;
              }}
              type="button"
              role="tab"
              id={`${tabsId}-${tab.id}-tab`}
              aria-controls={`${tabsId}-${tab.id}-panel`}
              aria-selected={selected}
              tabIndex={selected ? 0 : -1}
              onClick={() => setActiveTab(tab.id)}
              onKeyDown={handleTabKeyDown}
              className={`flex min-w-0 flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:flex-none ${
                selected
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          );
        })}
      </div>

      {activeTab === "members" ? (
        <div
          role="tabpanel"
          id={`${tabsId}-members-panel`}
          aria-labelledby={`${tabsId}-members-tab`}
          tabIndex={0}
          className="min-w-0"
        >
          <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
            <TeamDirectory rows={data.directory} scopeMemberId={data.scope.memberId} />
            <TeamProfilePanel details={data.details} locale={locale} />
          </div>
        </div>
      ) : (
        <div
          role="tabpanel"
          id={`${tabsId}-performance-panel`}
          aria-labelledby={`${tabsId}-performance-tab`}
          tabIndex={0}
          className="min-w-0 space-y-8"
        >
          <TeamSection title={t("teamPerformanceTitle")} intro={t("teamPerformanceIntro")}>
            <div className="mb-4 flex items-center justify-between gap-3">
              <GroupLabel>{t("teamMembershipOverview")}</GroupLabel>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <TeamStatCard
                label={t("teamTotalMembers")}
                value={String(data.stats.totalMembers)}
                icon={<Users className="size-4" />}
              />
              <TeamStatCard
                label={t("teamActiveMembers")}
                value={String(data.stats.activeMembers)}
                icon={<UserCheck className="size-4" />}
              />
              <TeamStatCard
                label={t("teamInactiveMembers")}
                value={String(data.stats.inactiveMembers)}
                icon={<UserX className="size-4" />}
              />
              <TeamStatCard
                label={t("teamNewThisMonth")}
                value={String(data.stats.newMembersThisMonth)}
                icon={<CalendarDays className="size-4" />}
              />
            </div>

            <div className="mb-4 mt-8 flex items-center justify-between gap-3">
              <GroupLabel>{t("teamFinancialOverview")}</GroupLabel>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <TeamStatCard
                label={t("teamTotalInvestment")}
                value={formatSP(BigInt(data.stats.totalInvestmentPaisa))}
                hint={t("teamInvestmentHint")}
                icon={<Landmark className="size-4" />}
                tone="finance"
              />
              <TeamStatCard
                label={t("teamTotalReturns")}
                value={formatSP(BigInt(data.stats.totalReturnsPaisa))}
                hint={t("teamReturnsHint")}
                icon={<ReceiptText className="size-4" />}
                tone="finance"
              />
              <TeamStatCard
                label={t("teamAffiliateRewards")}
                value={formatSP(BigInt(data.stats.totalAffiliateRewardsPaisa))}
                hint={t("teamRewardsHint")}
                icon={<Gift className="size-4" />}
                tone="finance"
              />
            </div>

            <p className="mt-4 flex gap-2 rounded-2xl border border-border bg-muted/40 px-4 py-3 text-xs leading-relaxed text-muted-foreground">
              <Info className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
              {t("teamFinancialNote")}
            </p>
          </TeamSection>

          <TeamSection>
            <div className="grid gap-4">
              <section className="glass min-w-0 rounded-3xl p-5 sm:p-6" aria-label={t("teamPerformanceTitle")}>
                {hasActivity ? (
                  <InvestmentActivityChart
                    series={data.series}
                    locale={locale}
                    title={t("teamMonthlyInvestment")}
                    hint={t("teamMonthlyInvestmentHint")}
                  />
                ) : (
                  <p className="py-12 text-center text-sm text-muted-foreground">
                    {t("teamNoPerformanceData")}
                  </p>
                )}
              </section>

              <div className="grid gap-4 md:grid-cols-2">
                <TrendCard
                  title={t("teamInvestmentGrowth")}
                  value={formatSP(BigInt(data.stats.totalInvestmentPaisa))}
                  points={data.series.map((month) => Number(BigInt(month.cumulativeInvestmentPaisa)))}
                />
                <TrendCard
                  title={t("teamMemberGrowth")}
                  value={String(data.stats.totalMembers)}
                  points={data.series.map((month) => month.cumulativeMembers)}
                  tone="teal"
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <MiniSummary
                  title={t("teamReturnsSummary")}
                  value={formatSP(BigInt(data.stats.totalReturnsPaisa))}
                  series={data.series}
                  field="returnsPaisa"
                />
                <MiniSummary
                  title={t("teamRewardsSummary")}
                  value={formatSP(BigInt(data.stats.totalAffiliateRewardsPaisa))}
                  series={data.series}
                  field="affiliateRewardsPaisa"
                />
              </div>
            </div>
          </TeamSection>
        </div>
      )}
    </div>
  );
}

function GroupLabel({ children }: { children: ReactNode }) {
  return (
    <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
      {children}
    </p>
  );
}

function TeamStatCard({
  label,
  value,
  hint,
  icon,
  tone = "membership",
}: {
  label: string;
  value: string;
  hint?: string;
  icon: ReactNode;
  tone?: "membership" | "finance";
}) {
  const finance = tone === "finance";
  return (
    <article className="glass glass-hover min-w-0 rounded-2xl p-5">
      <div className="flex min-w-0 items-start justify-between gap-3">
        <p className="text-sm text-muted-foreground">{label}</p>
        <span
          className={`flex size-9 shrink-0 items-center justify-center rounded-xl ring-1 ${
            finance
              ? "bg-emerald-400/15 text-emerald-500 ring-emerald-400/25"
              : "bg-primary/15 text-primary ring-primary/20"
          }`}
          aria-hidden="true"
        >
          {icon}
        </span>
      </div>
      <p className="mt-4 truncate font-display text-2xl font-bold tracking-tight tabular-nums">
        {value}
      </p>
      {hint ? <p className="mt-1 truncate text-xs text-muted-foreground">{hint}</p> : null}
    </article>
  );
}

function MiniSummary({
  title,
  value,
  series,
  field,
}: {
  title: string;
  value: string;
  series: TeamOverviewDto["series"];
  field: "returnsPaisa" | "affiliateRewardsPaisa";
}) {
  return (
    <article className="glass min-w-0 rounded-2xl p-5">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
      <p className="mt-3 font-display text-xl font-bold tabular-nums">{value}</p>
      <div className="mt-4">
        <MiniBars series={series} field={field} />
      </div>
    </article>
  );
}
