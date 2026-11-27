"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { SignupPoint } from "@/lib/services/admin-dashboard-stats";
import { cn } from "@/lib/utils";

type Range = "30d" | "7d" | "today" | "all";

type RangeLabel = "range30Days" | "range7Days" | "rangeToday" | "rangeAllTime";

const RANGE_OPTIONS: Array<{
  id: Range;
  label: RangeLabel;
  days?: number;
}> = [
  { id: "30d", label: "range30Days", days: 30 },
  { id: "7d", label: "range7Days", days: 7 },
  { id: "today", label: "rangeToday", days: 1 },
  { id: "all", label: "rangeAllTime" },
];

export function AdminSignupChart({
  totalMembers,
  signups,
  locale,
}: {
  totalMembers: number;
  signups: readonly SignupPoint[];
  locale: string;
}) {
  const t = useTranslations("adminPanel");
  const [range, setRange] = useState<Range>("today");
  const option = RANGE_OPTIONS.find((item) => item.id === range) ?? RANGE_OPTIONS[2]!;
  const points: readonly SignupPoint[] =
    range === "all"
      ? [{ date: t("rangeAllTime"), count: totalMembers }]
      : signups.slice(-(option.days ?? 30));
  const rangeTotal = points.reduce((sum, point) => sum + point.count, 0);
  const rangeLabel = range === "all" ? t("allTimeSignUps") : t("newMembersThisMonth");
  const chartLabel = range === "all" ? t("allTimeSignUps") : t("signupChartLabel");
  const max = Math.max(1, ...points.map((point) => point.count));

  const formatLabel = (date: string, index: number) => {
    if (range === "all") return t("rangeAllTime");
    if (range === "today") return t("rangeToday");
    if (range === "7d") {
      return new Intl.DateTimeFormat(locale, {
        weekday: "short",
        timeZone: "UTC",
      }).format(new Date(`${date}T00:00:00Z`));
    }
    if (index !== 0 && index !== points.length - 1 && index % 5 !== 0) return "";
    return new Intl.DateTimeFormat(locale, {
      day: "numeric",
      month: "numeric",
      timeZone: "UTC",
    }).format(new Date(`${date}T00:00:00Z`));
  };

  return (
    <article className="glass glass-hover min-w-0 rounded-2xl p-4 sm:p-5">
      <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground">{t("totalMembers")}</p>
          <p className="mt-2 font-display text-3xl font-bold tracking-tight tabular-nums">
            {totalMembers}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {rangeLabel}: {rangeTotal}
          </p>
        </div>
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary ring-1 ring-primary/20">
          <Users className="size-4" aria-hidden="true" />
        </span>
      </div>

      <div
        role="group"
        aria-label={t("memberGrowth")}
        className="mt-5 flex flex-wrap gap-1 rounded-xl border border-border bg-[var(--glass)] p-1"
      >
        {RANGE_OPTIONS.map((item) => (
          <Button
            key={item.id}
            type="button"
            size="sm"
            variant="ghost"
            aria-pressed={range === item.id}
            onClick={() => setRange(item.id)}
            className={cn(
              "h-8 rounded-lg px-3 text-xs",
              range === item.id
                ? "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t(item.label)}
          </Button>
        ))}
      </div>

      <div
        role="img"
        aria-label={chartLabel}
        className="mt-4 flex h-48 min-w-0 items-stretch gap-1 overflow-hidden rounded-xl border border-border/60 bg-[var(--glass)] p-2 sm:gap-2 sm:p-3"
      >
        {points.map((point, index) => (
          <div key={point.date} className="flex h-full min-w-0 flex-1 flex-col">
            <div className="flex min-h-0 flex-1 items-end">
              <div
                title={`${point.date}: ${point.count}`}
                className="w-full rounded-t-md bg-primary/70 ring-1 ring-inset ring-primary/20 transition-all"
                style={{ height: `${Math.max(3, (point.count / max) * 100)}%` }}
              />
            </div>
            <span className="mt-2 h-4 truncate text-center text-[10px] text-muted-foreground">
              {formatLabel(point.date, index)}
            </span>
          </div>
        ))}
      </div>

      <table className="sr-only">
        <caption>{chartLabel}</caption>
        <thead>
          <tr>
            <th>{t("signupChartDate")}</th>
            <th>{t("signupChartCount")}</th>
          </tr>
        </thead>
        <tbody>
          {points.map((point) => (
            <tr key={point.date}>
              <td>{point.date}</td>
              <td>{point.count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </article>
  );
}
