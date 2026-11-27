import type { ReactNode } from "react";
import { getLocale, getTranslations } from "next-intl/server";
import { Banknote, CalendarDays, FileText, History, SquarePen } from "lucide-react";
import { AdminPageIntro } from "@/components/admin/admin-ui";
import { SalaryOverviewBody } from "@/components/admin/salary-plan/salary-overview-content";
import { PlanHistoryBody } from "@/components/admin/salary-plan/plan-history-content";
import {
  SalaryRunSection,
  SalaryDistributionsSection,
} from "@/components/admin/rank-salary/salary-sections";
import { SalaryPaymentRecordsBody } from "@/components/admin/rank-salary/salary-payment-records-content";
import { buttonVariants } from "@/components/ui/button";
import { Link, redirect } from "@/i18n/navigation";
import { getAdminAccess, hasAdminPermission } from "@/lib/admin-access";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

type SalaryTab = "overview" | "weekly" | "records" | "history";
type QueryValue = string | string[] | undefined;

const actionLinkClass = cn(buttonVariants({ variant: "outline", size: "sm" }), "h-9");

function first(value: QueryValue): string | undefined {
  const resolved = Array.isArray(value) ? value[0] : value;
  return resolved?.trim() ? resolved.trim() : undefined;
}

function tabHref(tab: SalaryTab): string {
  return `/admin/salary?tab=${tab}`;
}

export default async function AdminSalaryPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: QueryValue }>;
}) {
  const [query, access, locale, tn, ta] = await Promise.all([
    searchParams,
    getAdminAccess(),
    getLocale(),
    getTranslations("nav"),
    getTranslations("adminPanel"),
  ]);
  if (!access || !hasAdminPermission(access, "salary.view")) {
    redirect({ href: "/admin-login", locale });
  }

  const requested = first(query.tab);
  const tab: SalaryTab =
    requested === "weekly" || requested === "records" || requested === "history"
      ? requested
      : "overview";

  const tabs: Array<{ key: SalaryTab; label: string }> = [
    { key: "overview", label: ta("salaryOverviewTitle") },
    { key: "weekly", label: ta("weeklyDistributionTitle") },
    { key: "records", label: ta("salaryPaymentRecordsTitle") },
    { key: "history", label: ta("salaryPlanHistoryTitle") },
  ];

  const editPlanAction = (
    <Link href="/admin/rank-salary/edit-salary-plan" className={cn(actionLinkClass, "gap-1.5")}>
      <SquarePen className="size-3.5" aria-hidden="true" />
      {ta("salaryPlanEdit")}
    </Link>
  );

  const meta: Record<SalaryTab, { title: string; intro: string; icon: ReactNode; actions?: ReactNode }> = {
    overview: {
      title: ta("salaryOverviewTitle"),
      intro: ta("salaryIntro"),
      icon: <Banknote className="size-4" aria-hidden="true" />,
      actions: editPlanAction,
    },
    weekly: {
      title: ta("weeklyDistributionTitle"),
      intro: ta("salaryIntro"),
      icon: <CalendarDays className="size-4" aria-hidden="true" />,
    },
    records: {
      title: ta("salaryPaymentRecordsTitle"),
      intro: ta("salaryRecordsIntro"),
      icon: <FileText className="size-4" aria-hidden="true" />,
    },
    history: {
      title: ta("salaryPlanHistoryTitle"),
      intro: ta("salaryPlanHistoryIntro"),
      icon: <History className="size-4" aria-hidden="true" />,
    },
  };

  return (
    <div className="space-y-8 animate-rise">
      <AdminPageIntro
        eyebrow={tn("admin")}
        title={meta[tab].title}
        intro={meta[tab].intro}
        icon={meta[tab].icon}
        actions={meta[tab].actions}
      />

      {tab === "overview" ? (
        <div className="flex justify-end sm:hidden">{editPlanAction}</div>
      ) : null}

      <nav
        aria-label={ta("salaryOverviewTitle")}
        className="-mx-1 flex gap-1 overflow-x-auto rounded-2xl border border-border bg-[var(--glass)] p-1 sm:mx-0 sm:overflow-visible"
      >
        {tabs.map(({ key, label }) => {
          const active = tab === key;
          return (
            <Link
              key={key}
              href={tabHref(key)}
              aria-current={active ? "page" : undefined}
              className={cn(
                "inline-flex min-h-10 shrink-0 items-center justify-center whitespace-nowrap rounded-xl px-3 text-xs font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-ring sm:text-sm",
                active
                  ? "border-primary/40 bg-primary/15 text-foreground"
                  : "border-border bg-background/50 text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              {label}
            </Link>
          );
        })}
      </nav>

      {tab === "overview" ? <SalaryOverviewBody /> : null}
      {tab === "weekly" ? (
        <div className="space-y-8">
          <SalaryRunSection />
          <SalaryDistributionsSection />
        </div>
      ) : null}
      {tab === "records" ? <SalaryPaymentRecordsBody /> : null}
      {tab === "history" ? <PlanHistoryBody /> : null}
    </div>
  );
}
