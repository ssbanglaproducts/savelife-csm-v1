import { formatSP } from "@/lib/money";
import type { TeamOverviewDto } from "@/lib/services/team";

type Month = TeamOverviewDto["series"][number];

function asNumber(value: string): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function compactMoney(value: number): string {
  const sp = value / 100;
  if (sp >= 1_000_000) return `${(sp / 1_000_000).toFixed(1)}M SP`;
  if (sp >= 1_000) return `${Math.round(sp / 1_000)}K SP`;
  return formatSP(BigInt(Math.round(value)));
}

function monthLabel(month: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, { month: "short", timeZone: "UTC" }).format(
    new Date(`${month}-01T00:00:00Z`),
  );
}

export function InvestmentActivityChart({
  series,
  locale,
  title,
  hint,
}: {
  series: Month[];
  locale: string;
  title: string;
  hint: string;
}) {
  const values = series.map((month) => asNumber(month.investmentPaisa));
  const max = Math.max(0, ...values);
  const scale = max || 1;
  const width = 720;
  const height = 244;
  const left = 8;
  const right = 8;
  const top = 18;
  const bottom = 34;
  const plotWidth = width - left - right;
  const plotHeight = height - top - bottom;
  const slot = plotWidth / series.length;
  const barWidth = Math.max(8, slot * 0.58);

  return (
    <figure className="min-w-0">
      <figcaption className="mb-5">
        <h3 className="text-sm font-bold">{title}</h3>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{hint}</p>
      </figcaption>

      <div className="overflow-x-auto pb-1">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="h-56 min-w-[560px] w-full"
          role="img"
          aria-label={`${title}. ${values.map((value, index) => `${monthLabel(series[index]!.month, locale)}: ${formatSP(BigInt(Math.round(value)))}`).join(", ")}`}
        >
          <title>{title}</title>
          {[0, 0.5, 1].map((ratio) => {
            const y = top + plotHeight * (1 - ratio);
            return (
              <g key={ratio}>
                <line
                  x1={left}
                  x2={width - right}
                  y1={y}
                  y2={y}
                  stroke="currentColor"
                  strokeOpacity={ratio === 0 ? 0.18 : 0.09}
                  strokeWidth={1}
                />
                <text x={left} y={y - 5} className="fill-muted-foreground text-[10px]">
                  {compactMoney(max * ratio)}
                </text>
              </g>
            );
          })}

          {series.map((month, index) => {
            const value = values[index]!;
            const barHeight = max === 0 ? 0 : (value / scale) * plotHeight;
            const x = left + slot * index + (slot - barWidth) / 2;
            const y = top + plotHeight - barHeight;
            return (
              <g key={month.month}>
                <rect
                  x={x}
                  y={y}
                  width={barWidth}
                  height={Math.max(barHeight, value === 0 ? 2 : 0)}
                  rx={5}
                  className="fill-primary/70"
                />
                <text
                  x={x + barWidth / 2}
                  y={height - 12}
                  textAnchor="middle"
                  className="fill-muted-foreground text-[10px]"
                >
                  {monthLabel(month.month, locale)}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      <table className="sr-only">
        <caption>{title}</caption>
        <thead>
          <tr>
            <th>Month</th>
            <th>{title}</th>
          </tr>
        </thead>
        <tbody>
          {series.map((month) => (
            <tr key={month.month}>
              <td>{month.month}</td>
              <td>{formatSP(BigInt(month.investmentPaisa))}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

function trendGeometry(points: number[]): { line: string; area: string } {
  if (points.length === 0) return { line: "", area: "" };
  const width = 240;
  const height = 72;
  const padding = 4;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const spread = max - min || 1;
  const positions = points.map((point, index) => {
    const x = padding + (index / Math.max(1, points.length - 1)) * (width - padding * 2);
    const y = padding + (1 - (point - min) / spread) * (height - padding * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  return {
    line: `M ${positions.join(" L ")}`,
    area: `M ${padding},${height - padding} L ${positions.join(" L ")} L ${width - padding},${height - padding} Z`,
  };
}

export function TrendCard({
  title,
  value,
  points,
  caption,
  tone = "primary",
}: {
  title: string;
  value: string;
  points: number[];
  caption?: string;
  tone?: "primary" | "teal";
}) {
  const { line, area } = trendGeometry(points);
  const fillClass = tone === "teal" ? "fill-emerald-400/15" : "fill-primary/15";
  const strokeClass = tone === "teal" ? "stroke-emerald-400" : "stroke-primary";

  return (
    <article className="glass min-w-0 rounded-2xl p-5">
      <div className="flex min-w-0 items-start justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
        <span
          className={`size-2.5 shrink-0 rounded-full ${tone === "teal" ? "bg-emerald-400" : "bg-primary"}`}
          aria-hidden="true"
        />
      </div>
      <p className="mt-3 truncate font-display text-2xl font-bold tabular-nums">{value}</p>
      {caption ? <p className="mt-1 truncate text-xs text-muted-foreground">{caption}</p> : null}
      <svg viewBox="0 0 240 72" className="mt-4 h-16 w-full" preserveAspectRatio="none" aria-hidden="true">
        <path d={area} className={fillClass} />
        <path d={line} className={`${strokeClass} fill-none`} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </article>
  );
}

export function MiniBars({ series, field }: { series: Month[]; field: "returnsPaisa" | "affiliateRewardsPaisa" }) {
  const values = series.map((month) => asNumber(month[field]));
  const max = Math.max(1, ...values);

  return (
    <div className="flex h-10 items-end gap-1" aria-hidden="true">
      {values.map((value, index) => (
        <span
          key={series[index]!.month}
          className="min-w-1 flex-1 rounded-sm bg-emerald-400/60"
          style={{ height: `${Math.max(6, (value / max) * 100)}%` }}
        />
      ))}
    </div>
  );
}
