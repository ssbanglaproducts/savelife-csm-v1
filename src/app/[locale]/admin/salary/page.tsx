import { getLocale, getTranslations } from "next-intl/server";
import { Banknote } from "lucide-react";
import { AdminPageIntro } from "@/components/admin/admin-ui";
import { SalaryOverviewContent } from "@/components/admin/salary-plan/salary-overview-content";
import {
  SalaryRunSection,
  SalaryDistributionsSection,
} from "@/components/admin/rank-salary/salary-sections";
import { SalaryPaymentRecordsContent } from "@/components/admin/rank-salary/salary-payment-records-content";
import { PlanHistoryContent } from "@/components/admin/salary-plan/plan-history-content";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

export const dynamic = "force-dynamic";

type SalaryTab = "overview" | "weekly" | "records" | "history";
type QueryValue = string | string[] | undefined;

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
  const [query, tn, ta] = await Promise.all([
    searchParams,
    getTranslations("nav"),
    getTranslations("adminPanel"),
  ]);

  const requested = first(query.tab);
  const tab: SalaryTab =
    requested === "weekly" || requested === "records" || requested === "history"
      ? requested
      : "overview";

  const tabs: Array<{ key: SalaryTab; label: string }> = [
    { key: "overview", label: ta("salaryOverviewTitle") },
    { key: "weekly", label: ta("weeklyDistributionTitle") },
    { key: "records", label: ta("salaryPaymentRecordsTitle") },
    { key: "history", label: ta("distributionHistoryTitle") },
  ];

  return (
    <div className="space-y-8 animate-rise">
      <AdminPageIntro
        eyebrow={tn("admin")}
        title={ta("salaryOverviewTitle")}
        intro={ta("salaryIntro")}
        icon={<Banknote className="size-4" aria-hidden="true" />}
      />

      <nav aria-label={ta("salaryOverviewTitle")} className="flex flex-wrap gap-2">
        {tabs.map(({ key, label }) => {
          const active = tab === key;
          return (
            <Link
              key={key}
              href={tabHref(key)}
              aria-current={active ? "page" : undefined}
              className={cn(
                "inline-flex items-center rounded-xl border px-3 py-2 text-sm font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-ring",
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

      {tab === "overview" ? <SalaryOverviewContent /> : null}
      {tab === "weekly" ? (
        <div className="space-y-8">
          <SalaryRunSection />
          <SalaryDistributionsSection />
        </div>
      ) : null}
      {tab === "records" ? <SalaryPaymentRecordsContent /> : null}
      {tab === "history" ? (
        <div className="space-y-8">
          <SalaryDistributionsSection />
          <PlanHistoryContent />
        </div>
      ) : null}
    </div>
  );
}