"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { ArrowLeft, ChevronLeft, ChevronRight, Search, SlidersHorizontal, X } from "lucide-react";
import { EmptyState, adminInputClass } from "@/components/admin/admin-ui";
import { MemberAvatar } from "@/components/admin/member-actions";
import { Button } from "@/components/ui/button";
import { InfinityText } from "@/components/ui/infinity-text";
import { RankBadge } from "@/components/ui/rank-badge";
import { Link } from "@/i18n/navigation";
import { accentCardStyle, rankAccent, rankProgressGradient } from "@/lib/rank-accent";
import {
  SALARY_RANK_KEYS,
  salaryWeeksProgress,
  type SalaryRankKey,
} from "@/lib/salary";
import { cn } from "@/lib/utils";

export type RankMemberView = {
  readonly id: string;
  readonly memberDisplayId: string;
  readonly memberName: string;
  readonly phone: string;
  readonly profileImageUrl: string | null;
  readonly active: boolean;
  readonly rankKey: SalaryRankKey | null;
  readonly salaryEligible: boolean;
  readonly weeksPaid: number;
  readonly achievedAt: string | null;
};

export type RankOption = {
  readonly rankKey: SalaryRankKey;
  readonly name: string;
  readonly badgeUrl: string;
  readonly count: number;
  readonly activeCount: number;
  readonly inactiveCount: number;
};

type StatusFilter = "ALL" | "ACTIVE" | "INACTIVE";
type EligibilityFilter = "ALL" | "ELIGIBLE" | "NOT_ELIGIBLE";
type ProgressFilter = "ALL" | "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED";

type Filters = {
  readonly status: StatusFilter;
  readonly eligibility: EligibilityFilter;
  readonly from: string;
  readonly to: string;
  readonly progress: ProgressFilter;
};

const EMPTY_FILTERS: Filters = {
  status: "ALL",
  eligibility: "ALL",
  from: "",
  to: "",
  progress: "ALL",
};

const PAGE_SIZE = 10;

function progressFor(weeksPaid: number, maxWeeks: number | null): ProgressFilter {
  if (weeksPaid <= 0) return "NOT_STARTED";
  if (maxWeeks !== null && weeksPaid >= maxWeeks) return "COMPLETED";
  return "IN_PROGRESS";
}

function appliedFilterCount(filters: Filters): number {
  let count = 0;
  if (filters.status !== "ALL") count += 1;
  if (filters.eligibility !== "ALL") count += 1;
  if (filters.from) count += 1;
  if (filters.to) count += 1;
  if (filters.progress !== "ALL") count += 1;
  return count;
}

export function RankMemberList({
  ranks,
  members,
  maxWeeksByRank,
  fixedRank = null,
}: {
  ranks: readonly RankOption[];
  members: readonly RankMemberView[];
  maxWeeksByRank: Readonly<Record<SalaryRankKey, number | null>>;
  fixedRank?: SalaryRankKey | null;
}) {
  const t = useTranslations("adminPanel");
  const [query, setQuery] = useState("");
  const [draftFilters, setDraftFilters] = useState<Filters>(EMPTY_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState<Filters>(EMPTY_FILTERS);
  const [filterOpen, setFilterOpen] = useState(false);
  const [showAllRanks, setShowAllRanks] = useState(false);
  const [page, setPage] = useState(1);

  const filterRef = useRef<HTMLDivElement>(null);
  const filterPanelId = useId();

  useEffect(() => {
    if (!filterOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!filterRef.current?.contains(event.target as Node)) setFilterOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setFilterOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [filterOpen]);

  const fixedRankOption = fixedRank
    ? ranks.find((rank) => rank.rankKey === fixedRank) ?? null
    : null;
  const selectedCount = fixedRankOption?.count ?? members.length;
  const showResults = Boolean(fixedRankOption) || showAllRanks;

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return members.filter((member) => {
      if (fixedRank && member.rankKey !== fixedRank) return false;
      if (
        needle &&
        ![member.memberDisplayId, member.memberName, member.phone].some((value) =>
          value.toLowerCase().includes(needle),
        )
      ) {
        return false;
      }
      if (appliedFilters.status === "ACTIVE" && !member.active) return false;
      if (appliedFilters.status === "INACTIVE" && member.active) return false;
      if (appliedFilters.eligibility === "ELIGIBLE" && !member.salaryEligible) return false;
      if (appliedFilters.eligibility === "NOT_ELIGIBLE" && member.salaryEligible) return false;
      if (appliedFilters.progress !== "ALL") {
        const memberMaxWeeks = member.rankKey
          ? maxWeeksByRank[member.rankKey] ?? null
          : null;
        if (progressFor(member.weeksPaid, memberMaxWeeks) !== appliedFilters.progress) return false;
      }
      const achievedDate = member.achievedAt?.slice(0, 10) ?? "";
      if (appliedFilters.from && (!achievedDate || achievedDate < appliedFilters.from)) return false;
      if (appliedFilters.to && (!achievedDate || achievedDate > appliedFilters.to)) return false;
      return true;
    });
  }, [members, query, appliedFilters, fixedRank, maxWeeksByRank]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const start = (currentPage - 1) * PAGE_SIZE;
  const pageRows = filtered.slice(start, start + PAGE_SIZE);
  const filterBadgeCount = appliedFilterCount(appliedFilters);

  function openFilterPanel(): void {
    if (filterOpen) {
      setFilterOpen(false);
      return;
    }
    setDraftFilters(appliedFilters);
    setFilterOpen(true);
  }

  function applyFilters(): void {
    setAppliedFilters(draftFilters);
    setPage(1);
    setFilterOpen(false);
  }

  function resetFilters(): void {
    setDraftFilters(EMPTY_FILTERS);
    setAppliedFilters(EMPTY_FILTERS);
    setPage(1);
    setFilterOpen(false);
  }

  return (
    <div className="space-y-5">
      {fixedRankOption ? (
        <section className="space-y-3" aria-label={t("rankMembersRank")}>
          <Link
            href="/admin/rank-salary/rank-members"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ArrowLeft className="size-3.5" aria-hidden="true" />
            {t("rankMembersBackToRanks")}
          </Link>
          <div
            style={accentCardStyle(rankAccent(fixedRankOption.rankKey))}
            className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border bg-[var(--glass)] px-4 py-4 sm:px-5"
          >
            <div className="flex min-w-0 items-center gap-3 sm:gap-4">
              <RankBadge
                src={fixedRankOption.badgeUrl}
                rankKey={fixedRankOption.rankKey}
                size={56}
                preload
              />
              <div className="min-w-0">
                <p className="truncate font-display text-xl font-bold sm:text-2xl">
                  {fixedRankOption.name}
                </p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-5 sm:gap-7">
              <div className="text-center">
                <p className="font-display text-2xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                  {fixedRankOption.activeCount}
                </p>
                <p className="mt-0.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {t("rankMembersActive")}
                </p>
              </div>
              <div className="text-center">
                <p className="font-display text-2xl font-bold tabular-nums text-red-600 dark:text-red-400">
                  {fixedRankOption.inactiveCount}
                </p>
                <p className="mt-0.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {t("rankMembersInactive")}
                </p>
              </div>
            </div>
          </div>
        </section>
      ) : showAllRanks ? (
        <section className="space-y-3" aria-label={t("rankMembersAllRanks")}>
          <button
            type="button"
            onClick={() => setShowAllRanks(false)}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ArrowLeft className="size-3.5" aria-hidden="true" />
            {t("rankMembersBackToRanks")}
          </button>
          <div className="flex items-center justify-between gap-3 rounded-2xl border border-primary/30 bg-primary/5 px-4 py-3">
            <p className="font-display text-lg font-bold">{t("rankMembersAllRanks")}</p>
            <p className="text-sm font-semibold tabular-nums text-muted-foreground">
              {t("rankMembersCount", { count: members.length })}
            </p>
          </div>
        </section>
      ) : (
        <section aria-label={t("rankMembersSelectRank")} className="space-y-3">
          <h2 className="text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">
            {t("rankMembersSelectRank")}
          </h2>
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            {ranks.map((rank) => {
              const accent = rankAccent(rank.rankKey);
              return (
                <Link
                  key={rank.rankKey}
                  href={`/admin/rank-salary/rank-members/${rank.rankKey}`}
                  aria-label={`${rank.name} · ${t("rankMembersCount", { count: rank.count })}`}
                  style={accentCardStyle(accent)}
                  className={cn(
                    "flex min-h-[7.5rem] min-w-0 flex-col items-center justify-center gap-1.5 rounded-xl border px-2 py-3 text-center transition-colors hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:min-h-[8.5rem]",
                    accent.tier === "default"
                      ? "border-border bg-[var(--glass)]"
                      : cn("bg-[var(--glass)]", accent.border),
                  )}
                >
                  <RankBadge src={rank.badgeUrl} rankKey={rank.rankKey} size={44} />
                  <span
                    className={cn(
                      "w-full truncate text-xs font-bold leading-tight",
                      accent.tier !== "default" && accent.title,
                    )}
                  >
                    {rank.name}
                  </span>
                  <span className="flex items-baseline justify-center gap-1">
                    <span className="font-display text-lg font-bold tabular-nums">
                      {rank.count}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {t("rankMembersMembers")}
                    </span>
                  </span>
                </Link>
              );
            })}
          </div>
          <button
            type="button"
            onClick={() => setShowAllRanks(true)}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-primary/30 bg-primary/10 px-4 py-3 text-sm font-bold text-primary transition-colors hover:bg-primary/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {t("rankMembersAllRanks")}
            <span className="text-xs font-semibold tabular-nums text-primary/70">
              {t("rankMembersCount", { count: members.length })}
            </span>
          </button>
        </section>
      )}

      {showResults ? (
      <section aria-label={t("rankMembersSearchFilter")} className="space-y-2">
        <h2 className="text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">
          {t("rankMembersSearchFilter")}
        </h2>
        <div ref={filterRef} className="relative">
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <input
              type="search"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setPage(1);
              }}
              placeholder={t("rankMembersSearchPlaceholder")}
              aria-label={t("rankMembersSearchPlaceholder")}
              className={cn(adminInputClass, "pl-10 pr-12")}
            />
            <button
              type="button"
              onClick={openFilterPanel}
              aria-label={t("rankMembersFilters")}
              aria-expanded={filterOpen}
              aria-controls={filterPanelId}
              className="absolute right-1 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <SlidersHorizontal className="size-4" aria-hidden="true" />
              {filterBadgeCount > 0 ? (
                <span className="absolute -right-1 -top-1 grid size-4 place-items-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                  {filterBadgeCount}
                </span>
              ) : null}
            </button>
          </div>

          {filterOpen ? (
            <>
              <button
                type="button"
                aria-label={t("rankMembersCloseFilters")}
                className="fixed inset-0 z-40 bg-black/40 sm:hidden"
                onClick={() => setFilterOpen(false)}
              />
              <div
                id={filterPanelId}
                role="dialog"
                aria-label={t("rankMembersFilters")}
                className="fixed inset-x-0 bottom-0 z-50 space-y-3 rounded-t-2xl border border-border bg-background p-4 shadow-xl sm:absolute sm:inset-x-auto sm:bottom-auto sm:right-0 sm:top-full sm:z-30 sm:mt-2 sm:w-80 sm:rounded-2xl"
              >
                <div className="flex items-center justify-between sm:hidden">
                  <p className="text-sm font-bold">{t("rankMembersFilters")}</p>
                  <button
                    type="button"
                    aria-label={t("rankMembersCloseFilters")}
                    onClick={() => setFilterOpen(false)}
                    className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <X className="size-4" aria-hidden="true" />
                  </button>
                </div>

                <FilterSelect
                  label={t("rankMembersAccountStatus")}
                  value={draftFilters.status}
                  onChange={(value) => setDraftFilters((current) => ({ ...current, status: value }))}
                  options={[
                    ["ALL", t("rankMembersAll")],
                    ["ACTIVE", t("rankMembersActive")],
                    ["INACTIVE", t("rankMembersInactive")],
                  ]}
                />
                <FilterSelect
                  label={t("rankMembersSalaryEligibility")}
                  value={draftFilters.eligibility}
                  onChange={(value) =>
                    setDraftFilters((current) => ({ ...current, eligibility: value }))
                  }
                  options={[
                    ["ALL", t("rankMembersAll")],
                    ["ELIGIBLE", t("rankMembersEligible")],
                    ["NOT_ELIGIBLE", t("rankMembersNotEligible")],
                  ]}
                />
                <FilterSelect
                  label={t("rankMembersSalaryProgressFilter")}
                  value={draftFilters.progress}
                  onChange={(value) =>
                    setDraftFilters((current) => ({ ...current, progress: value }))
                  }
                  options={[
                    ["ALL", t("rankMembersAll")],
                    ["NOT_STARTED", t("rankMembersNotStarted")],
                    ["IN_PROGRESS", t("rankMembersInProgress")],
                    ["COMPLETED", t("rankMembersCompleted")],
                  ]}
                />

                <div className="space-y-1">
                  <p className="text-xs font-semibold">{t("rankMembersAchievementDate")}</p>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="block min-w-0">
                      <span className="mb-1 block text-xs text-muted-foreground">
                        {t("rankMembersFromDate")}
                      </span>
                      <input
                        type="date"
                        value={draftFilters.from}
                        max={draftFilters.to || undefined}
                        onChange={(event) =>
                          setDraftFilters((current) => ({ ...current, from: event.target.value }))
                        }
                        className={adminInputClass}
                      />
                    </label>
                    <label className="block min-w-0">
                      <span className="mb-1 block text-xs text-muted-foreground">
                        {t("rankMembersToDate")}
                      </span>
                      <input
                        type="date"
                        value={draftFilters.to}
                        min={draftFilters.from || undefined}
                        onChange={(event) =>
                          setDraftFilters((current) => ({ ...current, to: event.target.value }))
                        }
                        className={adminInputClass}
                      />
                    </label>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1">
                  <Button type="button" variant="outline" onClick={resetFilters}>
                    {t("rankMembersResetFilters")}
                  </Button>
                  <Button type="button" onClick={applyFilters}>
                    {t("rankMembersApplyFilters")}
                  </Button>
                </div>
              </div>
            </>
          ) : null}
        </div>
      </section>
      ) : null}

      {showResults ? (
      <section aria-label={t("rankMembersList")} className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">
            {t("rankMembersList")}
          </h2>
          <p className="text-xs tabular-nums text-muted-foreground">
            {t("rankMembersShowing", {
              start: filtered.length === 0 ? 0 : start + 1,
              end: Math.min(start + PAGE_SIZE, filtered.length),
              total: filtered.length,
            })}
          </p>
        </div>

        {pageRows.length === 0 ? (
          <EmptyState
            message={
              fixedRank && selectedCount === 0
                ? t("rankMembersEmptyRank")
                : members.length === 0
                  ? t("rankMembersNoMembers")
                  : t("rankMembersNoMatches")
            }
          />
        ) : (
          <ul className="space-y-2">
            {pageRows.map((member) => {
              const memberRankKey = member.rankKey ?? SALARY_RANK_KEYS[0];
              const memberMaxWeeks = member.rankKey
                ? maxWeeksByRank[member.rankKey] ?? null
                : null;
              const progress = salaryWeeksProgress(member.weeksPaid, memberMaxWeeks);
              const fillClass =
                rankProgressGradient(memberRankKey) ?? rankAccent(memberRankKey).progress;
              const weekLabel = `${t("rankMembersWeek")} ${member.weeksPaid} / ${
                memberMaxWeeks === null ? "∞" : memberMaxWeeks
              }`;

              return (
                <li key={member.id}>
                  <Link
                    href={`/admin/members/${member.memberDisplayId}`}
                    className="flex items-center gap-3 rounded-xl border border-border bg-[var(--glass)] px-3 py-2.5 transition-colors hover:border-primary/40 hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <span
                      className={cn(
                        "shrink-0 rounded-full",
                        !member.active && "ring-1 ring-red-500",
                      )}
                    >
                      <MemberAvatar
                        name={member.memberName}
                        src={member.profileImageUrl}
                        size="sm"
                      />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">
                        {member.memberName}
                      </span>
                      <span className="block truncate font-mono text-[11px] text-muted-foreground">
                        {member.memberDisplayId}
                      </span>
                    </span>
                    <span className="w-24 shrink-0 sm:w-36">
                      <span className="block truncate text-right text-[11px] font-semibold tabular-nums">
                        <InfinityText value={weekLabel} />
                      </span>
                      <span className="mt-1 block h-1.5 w-full overflow-hidden rounded-full bg-muted">
                        <span
                          className={cn("block h-full rounded-full", fillClass)}
                          style={{ width: `${progress.percent}%` }}
                        />
                      </span>
                    </span>
                    <ChevronRight
                      className="size-4 shrink-0 text-muted-foreground"
                      aria-hidden="true"
                    />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}

        {filtered.length > 0 ? (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
            <p className="text-xs tabular-nums text-muted-foreground">
              {t("rankMembersPage")} {currentPage} / {totalPages}
            </p>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={currentPage <= 1}
                onClick={() => setPage((value) => Math.max(1, value - 1))}
              >
                <ChevronLeft className="size-4" aria-hidden="true" />
                {t("rankMembersPrevious")}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={currentPage >= totalPages}
                onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
              >
                {t("rankMembersNext")}
                <ChevronRight className="size-4" aria-hidden="true" />
              </Button>
            </div>
          </div>
        ) : null}
      </section>
      ) : null}
    </div>
  );
}

function FilterSelect<T extends string>({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: T;
  onChange: (value: T) => void;
  options: readonly (readonly [T, string])[];
}) {
  return (
    <label className="block min-w-0">
      <span className="mb-1 block text-xs font-semibold">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value as T)}
        className={adminInputClass}
      >
        {options.map(([optionValue, optionLabel]) => (
          <option key={optionValue} value={optionValue}>
            {optionLabel}
          </option>
        ))}
      </select>
    </label>
  );
}
