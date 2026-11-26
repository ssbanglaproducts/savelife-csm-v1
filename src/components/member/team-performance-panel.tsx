"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { formatSP, formatTaka } from "@/lib/money";
import type { GrowthRange, TeamPerformanceDto } from "@/lib/services/team-performance";

const RANGES: Array<{ id: GrowthRange; key: "teamRange7d" | "teamRange30d" | "teamRange3m" | "teamRange6m" | "teamRange12m" | "teamRangeAll" }> = [
  { id: "7d", key: "teamRange7d" },
  { id: "30d", key: "teamRange30d" },
  { id: "3m", key: "teamRange3m" },
  { id: "6m", key: "teamRange6m" },
  { id: "12m", key: "teamRange12m" },
  { id: "all", key: "teamRangeAll" },
];

export function TeamPerformancePanel({
  data,
  locale,
}: {
  data: TeamPerformanceDto;
  locale: string;
}) {
  const t = useTranslations("memberPanel");
  const [range, setRange] = useState<GrowthRange>("30d");
  const points = data.growth[range] ?? [];
  const legLabels = [t("teamLegA"), t("teamLegB"), t("teamLegC")];

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label={t("teamTotalMembers")} value={String(data.overall.totalMembers)} />
        <StatCard label={t("teamActiveMembers")} value={String(data.overall.activeMembers)} />
        <StatCard label={t("teamInactiveMembers")} value={String(data.overall.inactiveMembers)} />
        <StatCard label={t("teamNewThisMonth")} value={String(data.overall.newMembersThisMonth)} />
      </div>

      <div className="glass min-w-0 rounded-2xl p-4 sm:p-5">
        <div className="mb-4 flex flex-wrap gap-2">
          {RANGES.map((item) => (
            <button
              key={item.id}
              type="button"
              aria-pressed={range === item.id}
              onClick={() => setRange(item.id)}
              className={cn(
                "rounded-full px-3 py-1.5 text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                range === item.id
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted/60 text-muted-foreground hover:text-foreground",
              )}
            >
              {t(item.key)}
            </button>
          ))}
        </div>
        <GrowthChart points={points} range={range} locale={locale} t={t} />
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {data.legs.map((leg, index) => (
          <div key={leg.slot} className="glass min-w-0 rounded-2xl p-4">
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-primary">
              {legLabels[index]}
            </p>
            <div className="mt-3 grid grid-cols-2 gap-y-3 text-xs">
              <MiniStat label={t("teamTotalMembers")} value={String(leg.totalMembers)} />
              <MiniStat label={t("teamActiveMembers")} value={String(leg.activeMembers)} />
              <MiniStat label={t("teamInactiveMembers")} value={String(leg.inactiveMembers)} />
              <MiniStat label={t("teamNewThisMonth")} value={String(leg.newMembers)} />
            </div>
            <p className="mt-4 border-t border-border pt-3 text-sm font-bold tabular-nums">
              {formatTaka(BigInt(leg.investmentPaisa), locale)}
            </p>
          </div>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label={t("teamInvestmentTotal")}
          value={formatTaka(BigInt(data.investment.totalPaisa), locale)}
        />
        <StatCard
          label={t("teamThisMonth")}
          value={formatTaka(BigInt(data.investment.thisMonthPaisa), locale)}
        />
        <StatCard
          label={t("teamGrowth")}
          value={`${data.investment.growthPercent > 0 ? "+" : ""}${data.investment.growthPercent.toFixed(1)}%`}
        />
        <StatCard
          label={t("teamRefunds")}
          value={formatTaka(BigInt(data.investment.refundPaisa), locale)}
        />
        {data.investment.legPaisa.map((value, index) => (
          <StatCard
            key={`investment-leg-${index}`}
            label={legLabels[index]}
            value={formatTaka(BigInt(value), locale)}
          />
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label={t("teamSpTotal")} value={formatSP(BigInt(data.sp.totalPaisa))} />
        <StatCard label={t("teamSpMonthly")} value={formatSP(BigInt(data.sp.monthlyPaisa))} />
        {data.sp.legPaisa.map((value, index) => (
          <StatCard
            key={`sp-leg-${index}`}
            label={legLabels[index]}
            value={formatSP(BigInt(value))}
          />
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard
          label={t("teamStatusActive")}
          value={String(data.activation.activeMembers)}
        />
        <StatCard
          label={t("teamStatusInactive")}
          value={String(data.activation.inactiveMembers)}
        />
        <StatCard
          label={t("teamActivationRate")}
          value={`${data.activation.rate.toFixed(1)}%`}
        />
        <StatCard
          label={t("teamNewlyActivated")}
          value={String(data.activation.newlyActivated)}
        />
        <div className="glass min-w-0 rounded-2xl p-4">
          <p className="text-xs text-muted-foreground">{t("teamLegComparison")}</p>
          <div className="mt-2 grid gap-1.5">
            {data.activation.legs.map((leg, index) => (
              <div key={`activation-${leg.slot}`} className="flex items-center justify-between gap-2 text-xs">
                <span className="font-semibold">{legLabels[index]}</span>
                <span className="tabular-nums text-muted-foreground">
                  {leg.activeMembers}/{leg.totalMembers}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="glass min-w-0 rounded-2xl p-4 sm:p-5">
        <p className="mb-4 text-sm font-bold">{t("teamRecentActivity")}</p>
        {data.activity.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">{t("teamNoActivity")}</p>
        ) : (
          <ul className="divide-y divide-border">
            {data.activity.map((item) => (
              <li key={item.id} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{item.fullName}</p>
                  <p className="font-mono text-[11px] text-muted-foreground" translate="no">
                    {item.memberId}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-xs font-semibold">{activityLabel(t, item.kind)}</p>
                  {item.amountPaisa !== "0" ? (
                    <p className="text-xs tabular-nums text-muted-foreground">
                      {formatTaka(BigInt(item.amountPaisa), locale)}
                    </p>
                  ) : null}
                  <p className="mt-0.5 text-[10px] text-muted-foreground">
                    {new Intl.DateTimeFormat(locale, {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                      timeZone: "UTC",
                    }).format(new Date(item.occurredAt))}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function activityLabel(
  t: ReturnType<typeof useTranslations>,
  kind: "REGISTERED" | "ACTIVATED" | "PURCHASE" | "REFUND",
): string {
  switch (kind) {
    case "REGISTERED":
      return t("teamActivityRegistered");
    case "ACTIVATED":
      return t("teamActivityActivated");
    case "PURCHASE":
      return t("teamActivityPurchase");
    case "REFUND":
      return t("teamActivityRefund");
  }
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="glass min-w-0 rounded-2xl p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-2 truncate font-display text-xl font-bold tabular-nums">{value}</p>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="truncate text-[10px] text-muted-foreground">{label}</p>
      <p className="mt-0.5 font-bold tabular-nums">{value}</p>
    </div>
  );
}

type GrowthPoint = TeamPerformanceDto["growth"][GrowthRange][number];

function formatPointLabel(label: string, range: GrowthRange, locale: string): string {
  if (range === "7d" || range === "30d") {
    return new Intl.DateTimeFormat(locale, {
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    }).format(new Date(`${label}T00:00:00Z`));
  }
  return new Intl.DateTimeFormat(locale, {
    month: "short",
    year: "2-digit",
    timeZone: "UTC",
  }).format(new Date(`${label}-01T00:00:00Z`));
}

function GrowthChart({
  points,
  range,
  locale,
  t,
}: {
  points: GrowthPoint[];
  range: GrowthRange;
  locale: string;
  t: ReturnType<typeof useTranslations>;
}) {
  if (points.length === 0) {
    return <p className="py-12 text-center text-sm text-muted-foreground">{t("teamNoActivity")}</p>;
  }

  const width = 720;
  const height = 220;
  const top = 16;
  const bottom = 34;
  const plotHeight = height - top - bottom;
  const maxInvestment = Math.max(1, ...points.map((point) => Number(BigInt(point.investmentPaisa))));
  const maxMembers = Math.max(1, ...points.map((point) => point.members));
  const slot = width / points.length;
  const barWidth = Math.max(6, slot * 0.5);

  const memberPoints = points.map((point, index) => {
    const x = slot * index + slot / 2;
    const y = top + plotHeight - (point.members / maxMembers) * plotHeight;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  return (
    <div className="overflow-x-auto pb-1">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-56 min-w-[620px] w-full"
        role="img"
        aria-label={t("teamRecentActivity")}
      >
        <title>{t("teamGrowth")}</title>
        {[0, 0.5, 1].map((ratio) => {
          const y = top + plotHeight * (1 - ratio);
          return (
            <line
              key={ratio}
              x1={0}
              x2={width}
              y1={y}
              y2={y}
              stroke="currentColor"
              strokeOpacity={ratio === 0 ? 0.16 : 0.08}
            />
          );
        })}
        {points.map((point, index) => {
          const value = Number(BigInt(point.investmentPaisa));
          const barHeight = (value / maxInvestment) * plotHeight;
          const x = slot * index + (slot - barWidth) / 2;
          return (
            <g key={point.label}>
              <rect
                x={x}
                y={top + plotHeight - barHeight}
                width={barWidth}
                height={Math.max(barHeight, 2)}
                rx={4}
                className="fill-primary/60"
              />
              <text
                x={slot * index + slot / 2}
                y={height - 10}
                textAnchor="middle"
                className="fill-muted-foreground text-[10px]"
              >
                {formatPointLabel(point.label, range, locale)}
              </text>
            </g>
          );
        })}
        <polyline
          points={memberPoints.join(" ")}
          className="fill-none stroke-emerald-400"
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {memberPoints.map((point, index) => {
          const [x, y] = point.split(",");
          return <circle key={`member-${points[index]!.label}`} cx={x} cy={y} r={3} className="fill-emerald-400" />;
        })}
      </svg>
      <table className="sr-only">
        <caption>{t("teamGrowth")}</caption>
        <thead>
          <tr>
            <th>{t("teamThisMonth")}</th>
            <th>{t("teamInvestmentTotal")}</th>
            <th>{t("teamTotalMembers")}</th>
          </tr>
        </thead>
        <tbody>
          {points.map((point) => (
            <tr key={`table-${point.label}`}>
              <td>{formatPointLabel(point.label, range, locale)}</td>
              <td>{formatTaka(BigInt(point.investmentPaisa), locale)}</td>
              <td>{point.members}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
