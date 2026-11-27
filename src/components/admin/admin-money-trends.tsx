"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { CreditCard, ShoppingBag, Wallet } from "lucide-react";
import { ChartBar } from "@/components/admin/chart-bar";
import { Button } from "@/components/ui/button";
import { formatSP } from "@/lib/money";
import type { MoneyTrendPoint } from "@/lib/services/admin-dashboard-stats";
import { cn } from "@/lib/utils";

type Range = "30d" | "7d" | "today";

const RANGE_OPTIONS: Array<{ id: Range; label: "range30Days" | "range7Days" | "rangeToday"; days: number }> = [
  { id: "30d", label: "range30Days", days: 30 },
  { id: "7d", label: "range7Days", days: 7 },
  { id: "today", label: "rangeToday", days: 1 },
];

type MetricData = {
  readonly total: string;
  readonly series: readonly MoneyTrendPoint[];
  readonly hint?: string;
};

/** Swipeable, switchable trend charts for the three headline money totals. */
export function AdminMoneyTrends({
  locale,
  topUp,
  invested,
  withdrawn,
}: {
  locale: string;
  topUp: MetricData;
  invested: MetricData;
  withdrawn: MetricData;
}) {
  const t = useTranslations("adminPanel");
  const [range, setRange] = useState<Range>("30d");
  const [active, setActive] = useState(0);
  const trackRef = useRef<HTMLDivElement>(null);
  const days = RANGE_OPTIONS.find((item) => item.id === range)?.days ?? 30;

  const metrics = [
    {
      id: "topUp",
      label: t("totalTopUpAmount"),
      icon: Wallet,
      total: topUp.total,
      hint: topUp.hint,
      series: topUp.series,
    },
    {
      id: "invested",
      label: t("totalInvested"),
      icon: ShoppingBag,
      total: invested.total,
      hint: invested.hint,
      series: invested.series,
    },
    {
      id: "withdrawn",
      label: t("totalWithdrawn"),
      icon: CreditCard,
      total: withdrawn.total,
      hint: withdrawn.hint,
      series: withdrawn.series,
    },
  ] as const;

  const onScroll = () => {
    const track = trackRef.current;
    if (!track || track.clientWidth === 0) return;
    const index = Math.round(track.scrollLeft / track.clientWidth);
    setActive(Math.min(metrics.length - 1, Math.max(0, index)));
  };

  const selectMetric = (index: number) => {
    setActive(index);
    const slide = trackRef.current?.children[index];
    if (slide instanceof HTMLElement) {
      slide.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
    }
  };

  const formatTooltipDate = (date: string) =>
    new Intl.DateTimeFormat(locale, {
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    }).format(new Date(`${date}T00:00:00Z`));

  const formatLabel = (date: string, index: number, length: number) => {
    if (range === "today") return t("rangeToday");
    if (range === "7d") {
      return new Intl.DateTimeFormat(locale, {
        weekday: "short",
        timeZone: "UTC",
      }).format(new Date(`${date}T00:00:00Z`));
    }
    const step = Math.max(1, Math.ceil(length / 6));
    if (index !== 0 && index !== length - 1 && index % step !== 0) return "";
    return new Intl.DateTimeFormat(locale, {
      day: "numeric",
      month: "numeric",
      timeZone: "UTC",
    }).format(new Date(`${date}T00:00:00Z`));
  };

  return (
    <div className="min-w-0 space-y-3">
      <div
        role="group"
        aria-label={t("moneyTrends")}
        className="flex flex-wrap items-center gap-2"
      >
        <div className="flex flex-1 flex-wrap gap-1 rounded-xl border border-border bg-[var(--glass)] p-1">
          {metrics.map((metric, index) => {
            const Icon = metric.icon;
            return (
              <Button
                key={metric.id}
                type="button"
                size="sm"
                variant="ghost"
                aria-pressed={active === index}
                onClick={() => selectMetric(index)}
                className={cn(
                  "h-8 gap-1.5 rounded-lg px-3 text-xs",
                  active === index
                    ? "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className="size-3.5" aria-hidden="true" />
                {metric.label}
              </Button>
            );
          })}
        </div>
        <div className="flex gap-1 rounded-xl border border-border bg-[var(--glass)] p-1">
          {RANGE_OPTIONS.map((item) => (
            <Button
              key={item.id}
              type="button"
              size="sm"
              variant="ghost"
              aria-pressed={range === item.id}
              onClick={() => setRange(item.id)}
              className={cn(
                "h-8 rounded-lg px-2.5 text-xs",
                range === item.id
                  ? "bg-primary/15 text-foreground hover:bg-primary/15"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {t(item.label)}
            </Button>
          ))}
        </div>
      </div>

      <div
        ref={trackRef}
        onScroll={onScroll}
        role="group"
        aria-label={t("moneyTrends")}
        className="flex snap-x snap-mandatory gap-3 overflow-x-auto rounded-2xl pb-2 transition-[height] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {metrics.map((metric) => {
          const Icon = metric.icon;
          const series = metric.series.slice(-days);
          const points = series.map((point, index) => {
            const amount = BigInt(point.amountPaisa);
            const cumulative = series
              .slice(0, index + 1)
              .reduce((sum, item) => sum + BigInt(item.amountPaisa), 0n);
            return { date: point.date, amount, cumulative };
          });
          const running = points.at(-1)?.cumulative ?? 0n;
          const max = points.reduce((largest, point) => (point.amount > largest ? point.amount : largest), 1n);
          const ratio = (amount: bigint) => Number((amount * 10_000n) / max) / 10_000;

          return (
            <div key={metric.id} className="w-full min-w-full snap-center">
              <article className="glass glass-hover min-w-0 rounded-2xl p-4 sm:p-5">
                <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm text-muted-foreground">{metric.label}</p>
                    <p className="mt-2 font-display text-3xl font-bold tracking-tight tabular-nums">
                      {metric.total}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {metric.hint ?? `${t("moneyChartPeriodTotal")}: ${formatSP(running)}`}
                    </p>
                  </div>
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary ring-1 ring-primary/20">
                    <Icon className="size-4" aria-hidden="true" />
                  </span>
                </div>

                <div
                  role="group"
                  aria-label={`${metric.label} ${t("moneyChartLabel")}`}
                  className="mt-4 flex h-48 min-w-0 items-stretch gap-1 rounded-xl border border-border/60 bg-[var(--glass)] p-2 sm:gap-2 sm:p-3"
                >
                  {points.map((point, index) => (
                    <ChartBar
                      key={point.date}
                      label={`${formatTooltipDate(point.date)}: ${formatSP(point.amount)}`}
                      title={formatTooltipDate(point.date)}
                      rows={[
                        { label: t("moneyChartAmount"), value: formatSP(point.amount) },
                        { label: t("moneyChartRunningTotal"), value: formatSP(point.cumulative) },
                      ]}
                      ratio={ratio(point.amount)}
                      dateLabel={formatLabel(point.date, index, points.length)}
                    />
                  ))}
                </div>

                <table className="sr-only">
                  <caption>{`${metric.label} ${t("moneyChartLabel")}`}</caption>
                  <thead>
                    <tr>
                      <th>{t("signupChartDate")}</th>
                      <th>{t("moneyChartAmount")}</th>
                      <th>{t("moneyChartRunningTotal")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {points.map((point) => (
                      <tr key={point.date}>
                        <td>{point.date}</td>
                        <td>{formatSP(point.amount)}</td>
                        <td>{formatSP(point.cumulative)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </article>
            </div>
          );
        })}
      </div>

      <div className="flex justify-center gap-1.5 sm:hidden" aria-hidden="true">
        {metrics.map((metric, index) => (
          <span
            key={metric.id}
            className={cn(
              "h-1.5 rounded-full bg-border transition-all",
              index === active ? "w-4 bg-primary" : "w-1.5",
            )}
          />
        ))}
      </div>
    </div>
  );
}
