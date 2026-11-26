import { getTranslations } from "next-intl/server";
import { Trophy } from "lucide-react";
import { AdminPageIntro } from "@/components/admin/admin-ui";
import { RankPlanContent } from "@/components/admin/rank-plan-content";
import { RankMembersContent } from "@/components/admin/rank-salary/rank-members-content";
import { SalaryTreasuriesSection } from "@/components/admin/rank-salary/salary-sections";
import { RankPlanHistoryContent } from "@/components/admin/rank-plan-history-content";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

type RankTab = "configuration" | "members" | "treasuries" | "history";
type QueryValue = string | string[] | undefined;

function first(value: QueryValue): string | undefined {
  const resolved = Array.isArray(value) ? value[0] : value;
  return resolved?.trim() ? resolved.trim() : undefined;
}

function tabHref(tab: RankTab): string {
  return `/admin/ranks?tab=${tab}`;
}

export default async function AdminRanksPage({
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
  const tab: RankTab =
    requested === "members" || requested === "treasuries" || requested === "history"
      ? requested
      : "configuration";

  const tabs: Array<{ key: RankTab; label: string }> = [
    { key: "configuration", label: ta("rankConfigurationTitle") },
    { key: "members", label: ta("rankMembersTitle") },
    { key: "treasuries", label: ta("rankTreasuriesTitle") },
    { key: "history", label: ta("rankConfigPlanHistory") },
  ];

  return (
    <div className="space-y-8 animate-rise">
      <AdminPageIntro
        eyebrow={tn("admin")}
        title={ta("rankConfigurationTitle")}
        intro={ta("rankPlanIntro")}
        icon={<Trophy className="size-4" aria-hidden="true" />}
      />

      <nav
        aria-label={ta("rankConfigurationTitle")}
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

      {tab === "configuration" ? <RankPlanContent /> : null}
      {tab === "members" ? <RankMembersContent /> : null}
      {tab === "treasuries" ? <SalaryTreasuriesSection /> : null}
      {tab === "history" ? <RankPlanHistoryContent /> : null}
    </div>
  );
}