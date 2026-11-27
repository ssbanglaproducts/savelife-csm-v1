import { getAdminAccess, hasAdminPermission } from "@/lib/admin-access";
import { CalendarDays } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import {
  AdminPageIntro,
  AdminSection,
  AdminTable,
  StatusBadge,
  formatDate,
} from "@/components/admin/admin-ui";
import { buttonVariants } from "@/components/ui/button";
import { RankBadge } from "@/components/ui/rank-badge";
import { StatCard } from "@/components/ui/stat-card";
import { Link, redirect } from "@/i18n/navigation";
import { formatSP, spToPaisa } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import { formatActorLabel } from "@/lib/services/actor-label";
import { ensureDefaultRankPlan } from "@/lib/services/rank-rewards";
import {
  getActiveSalaryPlan,
  serializeSalaryPlan,
  type SalaryPlanRankDto,
} from "@/lib/services/salary-plan";
import { cn } from "@/lib/utils";
import { SalaryPlanSuccessNotice } from "./salary-plan-success-notice";

const planPageLink = cn(buttonVariants({ variant: "outline", size: "sm" }), "h-9");

/** Main salary overview content, shared by the tabbed page and the legacy route. */
export async function SalaryOverviewBody() {
  const [session, locale, ta, tc] = await Promise.all([
    getAdminAccess(),
    getLocale(),
    getTranslations("adminPanel"),
    getTranslations("common"),
  ]);
  if (!session || !hasAdminPermission(session, "salary.view")) {
    redirect({ href: "/admin-login", locale });
    return null;
  }

  await ensureDefaultRankPlan(prisma);
  const [plan, activeVersion, rankDefinitions, rewards] = await Promise.all([
    getActiveSalaryPlan(prisma),
    prisma.salaryPlanVersion.findFirst({
      where: { isActive: true },
      orderBy: { version: "desc" },
      include: { createdBy: { select: { memberId: true, fullName: true, email: true } } },
    }),
    prisma.rankDefinition.findMany({
      where: { planVersion: { isActive: true } },
      select: { rankKey: true, name: true, nameBn: true, badgeImageUrl: true },
    }),
    prisma.rankAchievement.aggregate({
      where: {
        rewardType: "SP",
        rewardStatus: "ACHIEVED",
        member: { role: "MEMBER" },
      },
      _sum: { rewardSpPaisa: true },
    }),
  ]);

  const rankByKey = new Map(rankDefinitions.map((row) => [row.rankKey, row]));
  const serialized = serializeSalaryPlan(plan, {
    effectiveFrom: activeVersion?.effectiveFrom,
    activatedAt: activeVersion?.activatedAt,
    createdAt: activeVersion?.createdAt,
    createdBy: activeVersion?.createdBy,
    note: activeVersion?.note,
    approvedChanges: activeVersion?.approvedChanges,
  });
  const ranks: readonly SalaryPlanRankDto[] = serialized.ranks.map((row) => {
    const rank = rankByKey.get(row.rankKey);
    return {
      ...row,
      name: rank?.name ?? row.defaultName,
      nameBn: rank?.nameBn ?? row.defaultNameBn,
      badgeImageUrl: rank?.badgeImageUrl ?? null,
    };
  });

  const enabledKeys = new Set(
    ranks.filter((row) => row.enabled).map((row) => row.rankKey),
  );
  const treasuries = await prisma.salaryTreasury.findMany({
    where: { rankKey: { in: [...enabledKeys] } },
    select: { rankKey: true, balancePaisa: true },
  });
  const weeklyBudgetPaisa = treasuries.reduce(
    (total, row) => total + row.balancePaisa,
    0n,
  );
  const lastUpdated = activeVersion?.activatedAt ?? activeVersion?.createdAt ?? null;

  return (
    <div className="space-y-8">
      <SalaryPlanSuccessNotice />

      <p className="text-sm text-muted-foreground">
        {ta("salaryOverviewTotalRewards")}:{" "}
        <span className="font-semibold tabular-nums text-foreground">
          {formatSP(rewards._sum.rewardSpPaisa ?? 0n)}
        </span>
      </p>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label={ta("salaryPlanTotal")}
          value={`${(serialized.totalAllocationBps / 100).toString()}%`}
          hint={ta("salaryPlanTotalHint")}
        />
        <StatCard
          label={ta("salaryWeeklyBudget")}
          value={formatSP(weeklyBudgetPaisa)}
          hint={ta("salaryWeeklyBudgetHint")}
        />
        <StatCard
          label={ta("salaryEnabledRanks")}
          value={`${enabledKeys.size} / 9`}
          hint={ta("salaryEnabledRanksHint")}
        />
        <StatCard
          label={ta("salaryPlanCardVersion")}
          value={`v${activeVersion?.version ?? "—"}`}
          hint={ta("salaryPlanVersionHint")}
        />
      </div>

      <AdminSection id="salary-overview-table" title={ta("salaryPlanTitle")}>
        <AdminTable
          caption={ta("salaryPlanTitle")}
          headers={[
            ta("salaryPlanRank"),
            ta("salaryPlanAllocationColumn"),
            ta("salaryPlanWeeklyCap"),
            ta("salaryDuration"),
            tc("status"),
          ]}
        >
          {ranks.map((row) => {
            const name = locale === "bn" ? row.nameBn || row.name : row.name;
            return (
              <tr key={row.rankKey} className="align-top">
                <td className="whitespace-nowrap px-4 py-3">
                  <div className="flex items-center gap-2">
                    <RankBadge src={row.badgeImageUrl} rankKey={row.rankKey} size={36} />
                    <div className="min-w-0">
                      <p className="font-semibold">{name}</p>
                      <p className="text-[11px] text-muted-foreground">{row.rankKey}</p>
                    </div>
                  </div>
                </td>
                <td className="whitespace-nowrap px-4 py-3 tabular-nums">
                  {row.allocationPercent}%
                </td>
                <td className="whitespace-nowrap px-4 py-3 font-semibold tabular-nums">
                  {formatSP(spToPaisa(row.maxWeeklySalary))}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-sm">
                  {row.maxWeeks === null
                    ? ta("unlimitedDuration")
                    : ta("limitedWeeks", { weeks: row.maxWeeks })}
                </td>
                <td className="whitespace-nowrap px-4 py-3">
                  <StatusBadge
                    tone={row.enabled ? "success" : "neutral"}
                    label={row.enabled ? ta("salaryPlanEnabled") : ta("salaryPlanDisabled")}
                  />
                </td>
              </tr>
            );
          })}
        </AdminTable>
      </AdminSection>

      <section className="glass rounded-2xl p-5" aria-labelledby="salary-plan-information">
        <h2 id="salary-plan-information" className="font-display text-lg font-bold">
          {ta("salaryPlanInformation")}
        </h2>
        <dl className="mt-4 grid gap-x-8 gap-y-3 text-sm sm:grid-cols-2">
          <PlanFact
            label={ta("salaryPlanEffectiveDate")}
            value={
              activeVersion?.effectiveFrom
                ? formatDate(activeVersion.effectiveFrom, locale)
                : "—"
            }
          />
          <PlanFact
            label={ta("salaryPlanLastUpdated")}
            value={lastUpdated ? formatDate(lastUpdated, locale) : "—"}
          />
          <PlanFact
            label={ta("salaryPlanUpdatedBy")}
            value={formatActorLabel(activeVersion?.createdBy)}
          />
          <PlanFact
            label={ta("salaryPlanCardVersion")}
            value={`v${activeVersion?.version ?? "—"}`}
          />
        </dl>
      </section>
    </div>
  );
}

/** Full standalone page for the legacy /admin/rank-salary/overview route. */
export async function SalaryOverviewContent() {
  const [tn, ta] = await Promise.all([
    getTranslations("nav"),
    getTranslations("adminPanel"),
  ]);

  return (
    <div className="space-y-8 animate-rise">
      <AdminPageIntro
        eyebrow={tn("admin")}
        title={ta("salaryOverviewTitle")}
        intro={ta("salaryIntro")}
        icon={<CalendarDays className="size-3.5" aria-hidden="true" />}
        actions={
          <>
            <Link href="/admin/rank-salary/edit-salary-plan" className={planPageLink}>
              {ta("salaryPlanEdit")}
            </Link>
            <Link href="/admin/salary?tab=history" className={planPageLink}>
              {ta("salaryPlanHistory")}
            </Link>
          </>
        }
      />
      <SalaryOverviewBody />
    </div>
  );
}

function PlanFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 justify-between gap-4 border-b border-border/60 pb-2">
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd className="min-w-0 truncate text-right font-semibold">{value}</dd>
    </div>
  );
}
