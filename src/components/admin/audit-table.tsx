"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { ChevronDown, Search, SlidersHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { AdminTable, EmptyState, adminInputClass } from "./admin-ui";

export type AuditRow = {
  id: string;
  actor: string;
  action: string;
  entity: string;
  createdAt: string;
  before: string;
  after: string;
};

const PAGE_SIZE = 25;

export function AuditTable({ rows }: { rows: AuditRow[] }) {
  const t = useTranslations("adminPanel");
  const tc = useTranslations("common");
  const fieldId = useId();
  const filterRef = useRef<HTMLDivElement>(null);

  const [query, setQuery] = useState("");
  const [actorFilter, setActorFilter] = useState("ALL");
  const [actionFilter, setActionFilter] = useState("ALL");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());
  const [page, setPage] = useState(1);

  const actors = useMemo(
    () => Array.from(new Set(rows.map((row) => row.actor))).sort((a, b) => a.localeCompare(b)),
    [rows],
  );
  const actions = useMemo(
    () => Array.from(new Set(rows.map((row) => row.action))).sort((a, b) => a.localeCompare(b)),
    [rows],
  );

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return rows.filter((row) => {
      if (actorFilter !== "ALL" && row.actor !== actorFilter) return false;
      if (actionFilter !== "ALL" && row.action !== actionFilter) return false;
      if (!needle) return true;
      return [row.actor, row.action, row.entity, row.createdAt, row.before, row.after].some((value) =>
        value.toLowerCase().includes(needle),
      );
    });
  }, [actionFilter, actorFilter, query, rows]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const visibleRows = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const activeFilterCount =
    (actorFilter === "ALL" ? 0 : 1) + (actionFilter === "ALL" ? 0 : 1);

  useEffect(() => {
    if (!filtersOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!filterRef.current?.contains(event.target as Node)) setFiltersOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setFiltersOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [filtersOpen]);

  function clearFilters() {
    setQuery("");
    setActorFilter("ALL");
    setActionFilter("ALL");
    setPage(1);
    setFiltersOpen(false);
  }

  function toggleDetails(id: string) {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  if (rows.length === 0) {
    return <EmptyState message={t("noActivity")} />;
  }

  return (
    <div className="space-y-4">
      <div className="glass rounded-2xl p-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <label className="relative min-w-0 flex-1">
            <span className="sr-only">{t("auditSearchPlaceholder")}</span>
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <input
              id={`${fieldId}-search`}
              type="search"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setPage(1);
              }}
              placeholder={t("auditSearchPlaceholder")}
              className={cn(adminInputClass, "pl-10")}
            />
          </label>

          <div ref={filterRef} className="relative shrink-0">
            <button
              type="button"
              aria-expanded={filtersOpen}
              aria-controls={`${fieldId}-filters`}
              onClick={() => setFiltersOpen((open) => !open)}
              className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-border bg-[var(--glass)] px-4 text-sm font-semibold transition-colors hover:border-primary/50 hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:w-auto"
            >
              <SlidersHorizontal className="size-4" aria-hidden="true" />
              {tc("filter")}
              {activeFilterCount > 0 ? (
                <span className="grid size-5 place-items-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                  {activeFilterCount}
                </span>
              ) : null}
            </button>

            {filtersOpen ? (
              <div
                id={`${fieldId}-filters`}
                role="group"
                aria-label={tc("filter")}
                className="absolute right-0 z-20 mt-2 w-[min(20rem,calc(100vw-2rem))] rounded-xl border border-border bg-[var(--glass-strong)] p-3 shadow-xl backdrop-blur-xl"
              >
                <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  {t("auditActorFilter")}
                  <select
                    value={actorFilter}
                    onChange={(event) => {
                      setActorFilter(event.target.value);
                      setPage(1);
                    }}
                    className={cn(adminInputClass, "mt-1 h-9 text-xs normal-case tracking-normal")}
                  >
                    <option value="ALL">{t("auditAllActors")}</option>
                    {actors.map((actor) => (
                      <option key={actor} value={actor}>
                        {actor}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="mt-3 block text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  {t("auditActionFilter")}
                  <select
                    value={actionFilter}
                    onChange={(event) => {
                      setActionFilter(event.target.value);
                      setPage(1);
                    }}
                    className={cn(adminInputClass, "mt-1 h-9 text-xs normal-case tracking-normal")}
                  >
                    <option value="ALL">{t("auditAllActions")}</option>
                    {actions.map((action) => (
                      <option key={action} value={action}>
                        {action}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="mt-3 flex justify-end gap-2">
                  <Button type="button" variant="ghost" size="sm" onClick={clearFilters}>
                    {t("filterReset")}
                  </Button>
                  <Button type="button" size="sm" onClick={() => setFiltersOpen(false)}>
                    {t("filterApply")}
                  </Button>
                </div>
              </div>
            ) : null}
          </div>
        </div>

        {activeFilterCount > 0 || query ? (
          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              {t("activeFilters")}
            </span>
            {query ? (
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  setPage(1);
                }}
                className="inline-flex items-center gap-1 rounded-full bg-accent px-2.5 py-1 text-xs font-semibold text-foreground transition-colors hover:bg-primary/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {query}
                <X className="size-3" aria-hidden="true" />
              </button>
            ) : null}
            {actorFilter !== "ALL" ? (
              <button
                type="button"
                onClick={() => {
                  setActorFilter("ALL");
                  setPage(1);
                }}
                className="inline-flex items-center gap-1 rounded-full bg-accent px-2.5 py-1 text-xs font-semibold text-foreground transition-colors hover:bg-primary/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {actorFilter}
                <X className="size-3" aria-hidden="true" />
              </button>
            ) : null}
            {actionFilter !== "ALL" ? (
              <button
                type="button"
                onClick={() => {
                  setActionFilter("ALL");
                  setPage(1);
                }}
                className="inline-flex items-center gap-1 rounded-full bg-accent px-2.5 py-1 font-mono text-xs font-semibold text-foreground transition-colors hover:bg-primary/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {actionFilter}
                <X className="size-3" aria-hidden="true" />
              </button>
            ) : null}
            <button
              type="button"
              onClick={clearFilters}
              className="text-xs font-semibold text-primary hover:underline focus-visible:rounded focus-visible:ring-2 focus-visible:ring-ring"
            >
              {t("clearAllFilters")}
            </button>
          </div>
        ) : null}
      </div>

      {filtered.length === 0 ? (
        <EmptyState message={tc("noResults")} />
      ) : (
        <>
          <AdminTable
            caption={t("auditTitle")}
            headers={[t("actor"), t("action"), t("entity"), t("createdAt"), t("auditDetails")]}
          >
            {visibleRows.flatMap((row) => {
              const isExpanded = expanded.has(row.id);
              const detailId = `${fieldId}-${row.id}`;
              return [
                <tr key={row.id} className={cn("align-top", isExpanded && "bg-primary/5")}>
                  <td className="min-w-[140px] px-4 py-3 font-semibold">{row.actor}</td>
                  <td className="whitespace-nowrap px-4 py-3 font-mono text-xs">{row.action}</td>
                  <td className="min-w-[160px] break-words px-4 py-3 text-xs">{row.entity}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground">
                    {row.createdAt}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right">
                    <button
                      type="button"
                      aria-expanded={isExpanded}
                      aria-controls={detailId}
                      onClick={() => toggleDetails(row.id)}
                      className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1 text-xs font-semibold text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {isExpanded ? t("auditHideDetails") : t("auditDetails")}
                      <ChevronDown
                        className={cn("size-3.5 transition-transform duration-200", isExpanded && "rotate-180")}
                        aria-hidden="true"
                      />
                    </button>
                  </td>
                </tr>,
                ...(isExpanded
                  ? [
                      <tr key={`${row.id}-details`} className="bg-muted/30">
                        <td colSpan={5} className="px-4 py-4">
                          <div id={detailId} className="grid gap-3 md:grid-cols-2">
                            <div className="min-w-0">
                              <p className="mb-1 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                                {t("before")}
                              </p>
                              <pre className="max-h-72 overflow-auto rounded-xl border border-border bg-background/70 p-3 font-mono text-xs leading-relaxed whitespace-pre-wrap break-words">
                                {row.before}
                              </pre>
                            </div>
                            <div className="min-w-0">
                              <p className="mb-1 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                                {t("after")}
                              </p>
                              <pre className="max-h-72 overflow-auto rounded-xl border border-border bg-background/70 p-3 font-mono text-xs leading-relaxed whitespace-pre-wrap break-words">
                                {row.after}
                              </pre>
                            </div>
                          </div>
                        </td>
                      </tr>,
                    ]
                  : []),
              ];
            })}
          </AdminTable>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground tabular-nums">
              {t("visibleCount", { count: filtered.length, total: rows.length })}
            </p>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={currentPage <= 1}
                onClick={() => setPage(currentPage - 1)}
              >
                {tc("previous")}
              </Button>
              <span className="text-xs font-semibold tabular-nums">
                {currentPage} / {pageCount}
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={currentPage >= pageCount}
                onClick={() => setPage(currentPage + 1)}
              >
                {tc("next")}
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
