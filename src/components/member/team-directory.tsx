"use client";

import { useMemo, useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { ArrowUpRight, Search, Users } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { buttonVariants } from "@/components/ui/button";
import { statusLabelKey } from "@/components/member/status-labels";
import { formatSP } from "@/lib/money";
import type { TeamOverviewDto } from "@/lib/services/team";
import { TeamAvatar, StatusPill, TeamSection } from "./team-ui";

type Row = TeamOverviewDto["directory"][number];

export function TeamDirectory({ rows, scopeMemberId }: { rows: Row[]; scopeMemberId: string }) {
  const t = useTranslations("memberPanel");
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter(
      (row) =>
        row.memberId.toLowerCase().includes(term) || row.fullName.toLowerCase().includes(term),
    );
  }, [query, rows]);

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
  }

  function teamHref(memberId: string): string {
    return `/member/team?member=${encodeURIComponent(memberId)}`;
  }

  function detailHref(memberId: string): string {
    return `/member/team?member=${encodeURIComponent(scopeMemberId)}&details=${encodeURIComponent(memberId)}`;
  }

  return (
    <TeamSection id="team-members" title={t("teamDirectoryTitle")} intro={t("teamDirectoryIntro")}>
      <div className="glass rounded-3xl p-5 sm:p-6">
        <form onSubmit={handleSearch} className="max-w-md">
          <label htmlFor="team-search" className="text-xs font-semibold text-muted-foreground">
            {t("teamSearch")}
          </label>
          <div className="relative mt-2">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <input
              id="team-search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t("teamSearch")}
              className="h-11 w-full rounded-xl border border-border bg-[var(--glass-strong)] pl-9 pr-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
        </form>

        {filtered.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-dashed border-border px-5 py-12 text-center">
            <Users className="mx-auto size-6 text-muted-foreground" aria-hidden="true" />
            <p className="mt-3 text-sm font-semibold">
              {rows.length === 0 ? t("teamNoMembers") : t("teamNoMatches")}
            </p>
          </div>
        ) : (
          <ul className="mt-6 grid gap-4 xl:grid-cols-2">
            {filtered.map((row) => (
              <li
                key={row.id}
                className="rounded-2xl border border-border bg-background/40 p-5 transition-colors hover:border-primary/40"
              >
                <div className="flex min-w-0 items-start gap-3">
                  <TeamAvatar name={row.fullName} image={row.profileImage} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold">{row.fullName}</p>
                    <p
                      className="mt-0.5 truncate font-mono text-[11px] text-muted-foreground"
                      translate="no"
                    >
                      {row.memberId}
                    </p>
                    <div className="mt-2">
                      <StatusPill label={t(statusLabelKey(row.status))} />
                    </div>
                  </div>
                </div>

                <dl className="mt-5 grid grid-cols-2 gap-3 border-t border-border pt-4">
                  <div className="min-w-0">
                    <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      {t("teamSize")}
                    </dt>
                    <dd className="mt-1 font-display text-xl font-bold tabular-nums">
                      {row.teamMembers}
                    </dd>
                  </div>
                  <div className="min-w-0">
                    <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      {t("teamInvestment")}
                    </dt>
                    <dd className="mt-1 truncate font-display text-lg font-bold tabular-nums">
                      {formatSP(BigInt(row.teamInvestmentPaisa))}
                    </dd>
                  </div>
                </dl>

                <div className="mt-5 flex flex-wrap items-center gap-2">
                  <Link
                    href={teamHref(row.memberId)}
                    className={buttonVariants({ variant: "outline", size: "sm" })}
                  >
                    {t("teamViewTeam")}
                    <ArrowUpRight className="size-3.5" aria-hidden="true" />
                  </Link>
                  <Link
                    href={detailHref(row.memberId)}
                    className={buttonVariants({ variant: "ghost", size: "sm" })}
                  >
                    {t("viewDetails")}
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </TeamSection>
  );
}
