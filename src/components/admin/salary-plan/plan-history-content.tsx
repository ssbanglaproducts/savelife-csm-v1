import { getAdminAccess, hasAdminPermission } from "@/lib/admin-access";
import { ArrowLeft, History } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import {
  AdminPageIntro,
  AdminTable,
  StatusBadge,
  formatDate,
} from "@/components/admin/admin-ui";
import { buttonVariants } from "@/components/ui/button";
import { Link, redirect } from "@/i18n/navigation";
import { formatSP, spToPaisa } from "@/lib/money";
import {
  salaryChangeRankLabel,
  salaryChangeSettingLabel,
  salaryChangeValue,
} from "@/lib/salary-plan-change-view";
import { prisma } from "@/lib/prisma";
import {
  serializeSalaryPlanVersion,
  type SalaryPlanVersionDto,
} from "@/lib/services/salary-plan";
import { cn } from "@/lib/utils";

/** Main plan history content, shared by the tabbed page and the legacy route. */
export async function PlanHistoryBody() {
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

  const versions = await prisma.salaryPlanVersion.findMany({
    orderBy: { version: "desc" },
    include: {
      definitions: { orderBy: { sortOrder: "asc" } },
      createdBy: { select: { memberId: true, fullName: true } },
    },
  });
  const plans: readonly SalaryPlanVersionDto[] = versions.map(serializeSalaryPlanVersion);

  return (
    <div className="space-y-8">
      {plans.length === 0 ? (
        <p className="glass rounded-2xl px-5 py-10 text-center text-sm text-muted-foreground">
          {ta("salaryPlanNoHistory")}
        </p>
      ) : (
        <div className="space-y-3">
          {plans.map((plan) => (
            <section key={plan.id} className="glass rounded-2xl p-4 sm:p-5">
              <div className="flex flex-wrap items-center gap-3">
                <h2 className="font-display text-lg font-bold">v{plan.version}</h2>
                <StatusBadge
                  tone={plan.isActive ? "success" : "neutral"}
                  label={plan.isActive ? ta("salaryPlanActive") : ta("salaryPlanArchived")}
                />
                <span className="text-xs text-muted-foreground">
                  {ta("salaryPlanEffectiveDate")}:{" "}
                  {plan.effectiveFrom ? formatDate(new Date(plan.effectiveFrom), locale) : "—"}
                </span>
              </div>

              <dl className="mt-4 grid gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
                <PlanFact
                  label={ta("salaryPlanLastUpdated")}
                  value={
                    plan.activatedAt || plan.createdAt
                      ? formatDate(new Date(plan.activatedAt ?? plan.createdAt ?? ""), locale)
                      : "—"
                  }
                />
                <PlanFact
                  label={ta("salaryPlanUpdatedBy")}
                  value={
                    plan.createdBy ? `${plan.createdBy.name} (${plan.createdBy.memberId})` : "—"
                  }
                />
                <PlanFact
                  label={ta("salaryPlanTotal")}
                  value={`${(plan.totalAllocationBps / 100).toString()}%`}
                />
                <PlanFact
                  label={ta("salaryEnabledRanks")}
                  value={`${plan.enabledRanks.length} / 9`}
                />
              </dl>

              {plan.note ? (
                <p className="mt-3 text-xs text-muted-foreground">{plan.note}</p>
              ) : null}

              <details className="mt-4 border-t border-border pt-3" open={plan.isActive}>
                <summary className="cursor-pointer text-sm font-semibold">
                  {ta("salaryPlanDetails")}
                </summary>
                <div className="mt-3 overflow-x-auto">
                  <AdminTable
                    caption={`${ta("salaryPlanTitle")} v${plan.version}`}
                    headers={[
                      ta("salaryPlanRank"),
                      ta("salaryPlanAllocation"),
                      ta("salaryPlanWeeklyCap"),
                      ta("salaryDuration"),
                      tc("status"),
                    ]}
                  >
                    {plan.ranks.map((row) => (
                      <tr key={row.rankKey} className="align-top">
                        <td className="whitespace-nowrap px-4 py-3 font-semibold">
                          {locale === "bn" ? row.nameBn || row.name : row.name} ({row.rankKey})
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 tabular-nums">
                          {row.allocationPercent}%
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 tabular-nums">
                          {formatSP(spToPaisa(row.maxWeeklySalary))}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3">
                          {row.maxWeeks === null
                            ? ta("unlimitedDuration")
                            : ta("limitedWeeks", { weeks: row.maxWeeks })}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3">
                          <StatusBadge
                            tone={row.enabled ? "success" : "neutral"}
                            label={
                              row.enabled ? ta("salaryPlanEnabled") : ta("salaryPlanDisabled")
                            }
                          />
                        </td>
                      </tr>
                    ))}
                  </AdminTable>
                </div>
              </details>

              {plan.approvedChanges.length > 0 ? (
                <details className="mt-3 border-t border-border pt-3" open={plan.isActive}>
                  <summary className="cursor-pointer text-sm font-semibold">
                    {ta("salaryPlanApprovedChanges")}
                  </summary>
                  <div className="mt-3 overflow-x-auto">
                    <AdminTable
                      caption={`${ta("salaryPlanApprovedChanges")} v${plan.version}`}
                      headers={[
                        ta("salaryPlanRank"),
                        ta("salaryPlanSetting"),
                        ta("salaryPlanPrevious"),
                        ta("salaryPlanNew"),
                      ]}
                    >
                      {plan.approvedChanges.map((change) => (
                        <tr key={change.id} className="align-top">
                          <td className="whitespace-nowrap px-4 py-3 font-semibold">
                            {salaryChangeRankLabel(change, ta)}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3">
                            {salaryChangeSettingLabel(change, ta)}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 tabular-nums">
                            {salaryChangeValue(change.previous, change.settingKey, locale, ta)}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 font-semibold tabular-nums">
                            {salaryChangeValue(change.next, change.settingKey, locale, ta)}
                          </td>
                        </tr>
                      ))}
                    </AdminTable>
                  </div>
                </details>
              ) : null}
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

/** Full standalone page for the legacy /admin/rank-salary/plan-history route. */
export async function PlanHistoryContent() {
  const [tn, ta] = await Promise.all([
    getTranslations("nav"),
    getTranslations("adminPanel"),
  ]);

  return (
    <div className="space-y-8 animate-rise">
      <AdminPageIntro
        eyebrow={tn("admin")}
        title={ta("salaryPlanHistoryTitle")}
        intro={ta("salaryPlanHistoryIntro")}
        icon={<History className="size-4" aria-hidden="true" />}
        actions={
          <Link
            href="/admin/salary"
            className={cn(buttonVariants({ variant: "outline", size: "sm" }), "h-9")}
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            {ta("salaryPlanBackToOverview")}
          </Link>
        }
      />
      <PlanHistoryBody />
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
