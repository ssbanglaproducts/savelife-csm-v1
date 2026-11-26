"use client";

import { useCallback, useState } from "react";
import { useTranslations } from "next-intl";
import { Check, Landmark, Plus, X } from "lucide-react";
import {
  InvestmentCards,
  type InvestmentCardRow,
} from "@/components/admin/investment-cards";
import { buttonVariants } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

type StatusFilter = "ALL" | "ACTIVE" | "PENDING";

export function InvestmentsWorkspace({
  rows,
  activeCount,
  pendingCount,
}: {
  rows: readonly InvestmentCardRow[];
  activeCount: number;
  pendingCount: number;
}) {
  const t = useTranslations("memberPanel");
  const [filter, setFilter] = useState<StatusFilter>("ALL");

  const toggleFilter = useCallback((next: Exclude<StatusFilter, "ALL">) => {
    setFilter((current) => (current === next ? "ALL" : next));
  }, []);

  const emptyMessage =
    filter === "ACTIVE"
      ? t("noActiveInvestments")
      : filter === "PENDING"
        ? t("noPendingInvestments")
        : undefined;

  return (
    <>
      <div className="flex justify-start">
        <Link
          href="/member/investments/new"
          className={cn(buttonVariants({ size: "sm" }), "w-full sm:w-auto")}
        >
          <Plus className="size-4" aria-hidden="true" />
          {t("newInvestment")}
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <button
          type="button"
          aria-pressed={filter === "ACTIVE"}
          onClick={() => toggleFilter("ACTIVE")}
          className={cn(
            "glass glass-hover min-w-0 rounded-2xl p-5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            filter === "ACTIVE"
              ? "border-primary/50 ring-1 ring-primary/30"
              : "hover:border-primary/40",
          )}
        >
          <div className="flex min-w-0 items-start justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              {`${t("active")} · ${t("investmentsCount")}`}
            </p>
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-600 ring-1 ring-emerald-500/20 dark:text-emerald-400">
              <Check className="size-4" aria-hidden="true" />
            </span>
          </div>
          <p className="mt-4 truncate font-display text-3xl font-bold tracking-tight tabular-nums">
            {activeCount}
          </p>
          <p className="mt-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
            {filter === "ACTIVE" ? t("filterActiveSelected") : t("filterActiveHint")}
          </p>
        </button>

        <button
          type="button"
          aria-pressed={filter === "PENDING"}
          onClick={() => toggleFilter("PENDING")}
          className={cn(
            "glass glass-hover min-w-0 rounded-2xl p-5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            filter === "PENDING"
              ? "border-amber-500/50 ring-1 ring-amber-500/30"
              : "hover:border-amber-500/40",
          )}
        >
          <div className="flex min-w-0 items-start justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              {`${t("pending")} · ${t("investmentsCount")}`}
            </p>
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 text-amber-600 ring-1 ring-amber-500/20 dark:text-amber-400">
              <Landmark className="size-4" aria-hidden="true" />
            </span>
          </div>
          <p className="mt-4 truncate font-display text-3xl font-bold tracking-tight tabular-nums">
            {pendingCount}
          </p>
          <p className="mt-1 text-xs font-semibold text-amber-600 dark:text-amber-400">
            {filter === "PENDING" ? t("filterPendingSelected") : t("filterPendingHint")}
          </p>
        </button>
      </div>

      <section
        className="min-w-0"
        aria-labelledby="investments-list-heading"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 id="investments-list-heading" className="font-display text-xl font-bold tracking-tight">
            {t("investmentsTitle")}
          </h2>
          {filter !== "ALL" ? (
            <button
              type="button"
              onClick={() => setFilter("ALL")}
              className="inline-flex w-fit items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <X className="size-3.5" aria-hidden="true" />
              {t("clearStatusFilter")}
            </button>
          ) : null}
        </div>
        <div className="mt-5">
          <InvestmentCards
            rows={rows}
            audience="member"
            statusFilter={filter === "ALL" ? undefined : filter}
            emptyMessage={emptyMessage}
          />
        </div>
      </section>
    </>
  );
}
