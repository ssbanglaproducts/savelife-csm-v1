import { getAdminAccess, hasAdminPermission } from "@/lib/admin-access";
import { getLocale, getTranslations } from "next-intl/server";
import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";
import {
  AdminSection,
  EmptyState,
  adminStatusKey,
  statusTone,
} from "@/components/admin/admin-ui";
import {
  SalaryTreasuryHistory,
  type SalaryTreasuryHistoryRunView,
} from "@/components/admin/salary-treasury-history";
import { InfinityText } from "@/components/ui/infinity-text";
import { RankBadge } from "@/components/ui/rank-badge";
import { buttonVariants } from "@/components/ui/button";
import { Link, redirect } from "@/i18n/navigation";
import { requireMemberId } from "@/lib/member-id";
import { formatSP } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import { formatSalaryDate } from "@/lib/salary-display";
import { resolveRankBadgeImageUrl } from "@/lib/rank-art";
import { isSalaryRankKey } from "@/lib/salary";
import {
  salaryTreasuryAccent,
  salaryTreasuryCardStyle,
} from "@/lib/salary-treasury-accent";
import { getActiveSalaryPlan, serializeSalaryPlan } from "@/lib/services/salary-plan";
import { buildSalaryTreasuryRun } from "@/lib/services/salary-treasury-run";
import { cn } from "@/lib/utils";

export async function AdminTreasuryDetailContent({ rankKey }: { rankKey: string }) {
  const [session, locale, tn, ta] = await Promise.all([
    getAdminAccess(),
    getLocale(),
    getTranslations("nav"),
    getTranslations("adminPanel"),
  ]);
  if (!session || !hasAdminPermission(session, "ranks.view")) redirect({ href: "/admin-login", locale });

  if (!isSalaryRankKey(rankKey)) notFound();

  const salaryPlan = await getActiveSalaryPlan(prisma);
  const plan = serializeSalaryPlan(salaryPlan);
  const config = salaryPlan.configs[rankKey];
  const rank = plan.ranks.find((row) => row.rankKey === rankKey);
  if (!rank) notFound();

  const [treasury, badge, entitlements, distributions] = await Promise.all([
    prisma.salaryTreasury.findUnique({
      where: { rankKey },
      select: {
        balancePaisa: true,
        totalAllocatedPaisa: true,
        totalPaidPaisa: true,
      },
    }),
    prisma.rankDefinition.findFirst({
      where: { planVersion: { isActive: true }, rankKey },
      select: { badgeImageUrl: true },
    }),
    prisma.salaryEntitlement.findMany({
      where: { rankKey, member: { role: "MEMBER" } },
      select: {
        id: true,
        memberId: true,
        weeksPaid: true,
        member: {
          select: { memberId: true, fullName: true, status: true },
        },
      },
    }),
    prisma.salaryDistribution.findMany({
      orderBy: { weekEndAt: "desc" },
      select: {
        id: true,
        weekEndAt: true,
        status: true,
        postedAt: true,
        payments: {
          where: { rankKey, member: { role: "MEMBER" } },
          select: {
            id: true,
            amountPaisa: true,
            weekNumber: true,
            status: true,
            member: {
              select: { id: true, memberId: true, fullName: true },
            },
          },
        },
      },
    }),
  ]);

  const balancePaisa = treasury?.balancePaisa ?? 0n;
  const run = buildSalaryTreasuryRun({
    config,
    balancePaisa,
    entitlements: [...entitlements]
      .sort((a, b) => a.member.fullName.localeCompare(b.member.fullName))
      .map((row) => ({
        ...row,
        member: { ...row.member, memberId: requireMemberId(row.member) },
      })),
  });
  const accent = salaryTreasuryAccent(rankKey);
  const badgeSrc = resolveRankBadgeImageUrl(badge?.badgeImageUrl ?? null, rankKey);
  const name = locale === "bn" ? rank.defaultNameBn : rank.defaultName;

  const history: readonly SalaryTreasuryHistoryRunView[] = distributions.map((distribution) => ({
    id: distribution.id,
    weekLabel: formatSalaryDate(distribution.weekEndAt, locale, true),
    postedLabel: formatSalaryDate(distribution.postedAt ?? distribution.weekEndAt, locale, true),
    statusLabel: ta(adminStatusKey(distribution.status)),
    statusTone: statusTone(distribution.status),
    payments: [...distribution.payments]
      .sort((a, b) => a.member.fullName.localeCompare(b.member.fullName))
      .map((payment) => ({
        id: payment.id,
        memberRecordId: payment.member.id,
        memberDisplayId: requireMemberId(payment.member),
        memberName: payment.member.fullName,
        amountPaisa: payment.amountPaisa.toString(),
        weekNumberLabel: `${ta("salaryTreasuryWeeksPaid")} ${payment.weekNumber}`,
        status: payment.status === "FAILED" ? "FAILED" : "SUCCESS",
        statusLabel: payment.status === "SUCCESS" ? ta("salaryPaid") : ta("salaryFailed"),
        statusTone: payment.status === "SUCCESS" ? "success" : "danger",
      })),
  }));

  return (
    <div className="space-y-8 animate-rise">
      <Link
        href="/admin/rank-salary/rank-treasuries"
        className={cn(buttonVariants({ variant: "outline" }), "w-fit")}
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        {ta("salaryTreasuryBack")}
      </Link>

      <section
        className="mesh glass relative overflow-hidden rounded-3xl p-6 sm:p-8"
        style={salaryTreasuryCardStyle(rankKey)}
      >
        <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-4">
            <div
              className={cn(
                "flex size-20 shrink-0 items-center justify-center rounded-2xl ring-1 ring-inset",
                accent.badgeClass,
              )}
            >
              <RankBadge src={badgeSrc} rankKey={rankKey} size={64} />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2 text-xs font-bold tracking-[0.12em] text-muted-foreground">
                <span>{rankKey}</span>
                <span aria-hidden="true">·</span>
                <span>{tn("admin")}</span>
              </div>
              <h1 className={cn("mt-1 font-display text-3xl font-bold", accent.nameClass)}>
                {name}
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {formatSP(config.maxWeeklySalaryPaisa)} ·{" "}
                <InfinityText
                  value={
                    config.maxWeeks === null
                      ? "∞"
                      : `${config.maxWeeks} ${ta("salaryPlanWeeks")}`
                  }
                />
              </p>
            </div>
          </div>

          <div className="shrink-0 rounded-2xl border border-border bg-[var(--glass-strong)] px-5 py-4 sm:min-w-64">
            <p className="text-xs font-semibold text-muted-foreground">
              {ta("salaryTreasuryNextRun")}
            </p>
            <p className="mt-1 font-display text-xl font-bold tabular-nums">
              {formatSalaryDate(run.nextBoundaryAt, locale, true)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {ta("salaryTreasuryNextRunHint")}
            </p>
          </div>
        </div>
      </section>

      <AdminSection id="salary-treasury-run" title={ta("salaryTreasuryCurrentRun")}>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="glass rounded-2xl p-4">
            <p className="text-xs font-medium text-muted-foreground">
              {ta("salaryTreasuryAvailable")}
            </p>
            <p className="mt-1 font-display text-2xl font-bold tabular-nums">
              {formatSP(run.balancePaisa)}
            </p>
          </div>
          <div className="glass rounded-2xl p-4">
            <p className="text-xs font-medium text-muted-foreground">
              {ta("salaryTreasuryEligibleMembers")}
            </p>
            <p className="mt-1 font-display text-2xl font-bold tabular-nums">
              {run.eligibleCount}
            </p>
          </div>
          <div className="glass rounded-2xl p-4">
            <p className="text-xs font-medium text-muted-foreground">
              {ta("salaryTreasuryProjectedTotal")}
            </p>
            <p className="mt-1 font-display text-2xl font-bold tabular-nums">
              {formatSP(run.projectedTotalPaisa)}
            </p>
          </div>
          <div className="glass rounded-2xl p-4">
            <p className="text-xs font-medium text-muted-foreground">
              {ta("salaryTreasuryWeekWindow")}
            </p>
            <p className="mt-1 text-sm font-semibold tabular-nums">
              {formatSalaryDate(run.periodStartAt, locale, true)} — {formatSalaryDate(run.periodEndAt, locale, true)}
            </p>
            {run.capped ? (
              <p className="mt-1 text-xs font-semibold text-amber-700 dark:text-amber-300">
                {ta("salaryTreasuryCapped")}
              </p>
            ) : null}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-[var(--glass-strong)] p-4">
          <div>
            <h3 className="text-sm font-semibold">{ta("salaryTreasuryMembers")}</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              {ta("salaryTreasuryEligibleMembers")}: {run.eligibleCount}
            </p>
          </div>
          <Link
            href={`/admin/rank-salary/rank-treasuries/${rankKey}/members`}
            className={cn(buttonVariants({ variant: "outline" }))}
          >
            {ta("salaryTreasuryViewMembers")}
          </Link>
        </div>
      </AdminSection>

      <AdminSection id="salary-treasury-history" title={ta("salaryTreasuryRunHistory")}>
        {history.length === 0 ? (
          <EmptyState message={ta("salaryTreasuryNoHistory")} />
        ) : (
          <SalaryTreasuryHistory
            runs={history}
            labels={{
              search: ta("salaryTreasurySearchHistory"),
              noMatches: ta("salaryTreasuryNoMatches"),
              rankPaid: ta("salaryTreasuryRankPaid"),
              noPayments: ta("salaryTreasuryNoPayments"),
              paidMembers: ta("salaryTreasuryRankRecipients"),
            }}
          />
        )}
      </AdminSection>
    </div>
  );
}
