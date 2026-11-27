import type { ReactNode } from "react";
import { getLocale, getTranslations } from "next-intl/server";
import { History, Trophy, Users, Wallet } from "lucide-react";
import { AdminPageIntro } from "@/components/admin/admin-ui";
import { RankPlanBody } from "@/components/admin/rank-plan-content";
import { RankMembersContent } from "@/components/admin/rank-salary/rank-members-content";
import { SalaryTreasuriesBody } from "@/components/admin/rank-salary/salary-sections";
import { RankPlanHistoryBody } from "@/components/admin/rank-plan-history-content";
import { Link, redirect } from "@/i18n/navigation";
import { getAdminAccess, hasAdminPermission } from "@/lib/admin-access";
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
  const [query, access, locale, tn, ta] = await Promise.all([
    searchParams,
    getAdminAccess(),
    getLocale(),
    getTranslations("nav"),
    getTranslations("adminPanel"),
  ]);
  if (!access || !hasAdminPermission(access, "ranks.view")) {
    redirect({ href: "/admin-login", locale });
  }

  const requested = first(query.tab);
  const tab: RankTab =
    requested === "members" || requested === "treasuries" || requested === "history"
      ? requested
      : "configuration";

  const tabs: Array<{ key: RankTab; label: string }> = [
    { key: "configuration", label: ta("rankConfigurationTitle") },
    { key: "members", label: ta("rankMembersTitle") },
    { key: "treasuries", label: ta("rankTreasuriesTitle") },
    { key: "history", label: ta("rankConfigHistoryTitle") },
  ];

  const meta: Record<RankTab, { title: string; intro: string; icon: ReactNode }> = {
    configuration: {
      title: ta("rankConfigurationTitle"),
      intro: ta("rankPlanIntro"),
      icon: <Trophy className="size-4" aria-hidden="true" />,
    },
    members: {
      title: ta("rankMembersTitle"),
      intro: ta("rankMembersIntro"),
      icon: <Users className="size-4" aria-hidden="true" />,
    },
    treasuries: {
      title: ta("rankTreasuriesTitle"),
      intro: ta("salaryIntro"),
      icon: <Wallet className="size-4" aria-hidden="true" />,
    },
    history: {
      title: ta("rankConfigHistoryTitle"),
      intro: ta("rankPlanImmutableNote"),
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

      {tab === "configuration" ? <RankPlanBody /> : null}
      {tab === "members" ? <RankMembersContent /> : null}
      {tab === "treasuries" ? <SalaryTreasuriesBody /> : null}
      {tab === "history" ? <RankPlanHistoryBody /> : null}
    </div>
  );
}
