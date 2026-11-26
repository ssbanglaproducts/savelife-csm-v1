import { LockKeyhole, Trophy } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { InfinityText } from "@/components/ui/infinity-text";
import { RankBadge } from "@/components/ui/rank-badge";
import { rankAccent, rankProgressGradient, type RankAccent } from "@/lib/rank-accent";
import type { MemberRankSummary } from "@/lib/services/member-rank-summary";
import { cn } from "@/lib/utils";

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, value));
}

function CardProgress({
  percent,
  label,
  leftLabel,
  rightLabel,
  accent,
  valueLabel,
  gradient,
}: {
  percent: number;
  label: string;
  leftLabel?: string;
  rightLabel?: string;
  accent: RankAccent | null;
  valueLabel?: string;
  gradient?: string | null;
}) {
  const width = clampPercent(percent);

  return (
    <div className="mt-2">
      <div className="flex items-center justify-between gap-2">
        <span className="min-w-0 truncate text-[9px] font-bold uppercase tracking-[0.1em] text-muted-foreground sm:text-[10px]">
          {label}
        </span>
        <span className={cn("shrink-0 text-[11px] font-bold tabular-nums", accent?.eyebrow)}>
          <InfinityText value={valueLabel ?? `${Math.round(width)}%`} />
        </span>
      </div>
      <div
        className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted/80 ring-1 ring-inset ring-border/50"
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(width)}
        aria-valuetext={valueLabel ? `${label}: ${valueLabel}` : undefined}
      >
        <div
          className={cn(
            "h-full rounded-full transition-[width] duration-700 ease-out",
            gradient ?? accent?.progress ?? "bg-primary",
          )}
          style={{ width: `${width}%` }}
        />
      </div>
      {leftLabel || rightLabel ? (
        <div className="mt-1.5 flex items-start justify-between gap-2 text-[9px] leading-tight text-muted-foreground sm:text-[10px]">
          <span className="min-w-0 break-words">{leftLabel}</span>
          <span className="min-w-0 break-words text-right">{rightLabel}</span>
        </div>
      ) : null}
    </div>
  );
}

export function MetricCard({
  label,
  value,
  inactive = false,
}: {
  label: string;
  value: string;
  inactive?: boolean;
}) {
  return (
    <article
      className={cn(
        "glass glass-hover flex h-full min-h-[92px] flex-col justify-between rounded-2xl border border-border/60 p-3 sm:min-h-[116px] sm:p-5",
        inactive && "accent-inactive",
      )}
    >
      <p className="text-[11px] font-medium leading-snug text-muted-foreground sm:text-xs">{label}</p>
      <p className="mt-2 break-words font-display text-lg font-bold tracking-tight tabular-nums sm:mt-4 sm:text-2xl">
        {value}
      </p>
    </article>
  );
}

export function ProgressCard({
  title,
  returned,
  total,
  percent,
  returnedLabel,
  totalLabel,
}: {
  title: string;
  returned: string;
  total: string;
  percent: number;
  returnedLabel: string;
  totalLabel: string;
}) {
  const width = Math.min(100, Math.max(0, percent));

  return (
    <article className="glass glass-hover flex h-full min-h-[104px] flex-col rounded-2xl border border-border/60 p-3 sm:min-h-[116px] sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-semibold">{title}</p>
        <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-bold text-primary tabular-nums">
          {width.toFixed(1)}%
        </span>
      </div>
      <p className="mt-2 break-words text-sm font-bold tabular-nums">
        {returned} <span className="font-medium text-muted-foreground">/ {total}</span>
      </p>
      <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-gradient-to-r from-primary to-primary/60"
          style={{ width: `${width}%` }}
        />
      </div>
      <div className="mt-2 flex justify-between gap-2 text-[10px] text-muted-foreground">
        <span>{returnedLabel}</span>
        <span>{totalLabel}</span>
      </div>
    </article>
  );
}

export function LockedCard({
  title,
  comingSoon,
  href,
}: {
  title: string;
  comingSoon: string;
  href?: string;
}) {
  const content = (
    <article className="flex h-full min-h-[92px] flex-col justify-between rounded-2xl border border-dashed border-border bg-muted/30 p-3 opacity-70 transition-opacity hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:min-h-[116px] sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-semibold text-muted-foreground">{title}</p>
        <LockKeyhole className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      </div>
      <p className="mt-4 text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
        {comingSoon}
      </p>
    </article>
  );

  return href ? <Link href={href} className="block h-full rounded-2xl">{content}</Link> : content;
}

export function RankCard({
  title,
  rank,
  rankLabel,
  emptyLabel,
  actionLabel,
  progressPercent,
  progressLabel,
  inactive = false,
}: {
  title: string;
  rank: MemberRankSummary | null;
  rankLabel: string;
  emptyLabel: string;
  actionLabel: string;
  progressPercent: number;
  progressLabel: string;
  inactive?: boolean;
}) {
  const accent = rank ? rankAccent(rank.rankKey) : null;

  return (
    <Link href="/member/rank-rewards" className="block h-full rounded-2xl">
      <article
        style={accent?.backgroundImage ? { backgroundImage: accent.backgroundImage } : undefined}
        className={cn(
          "glass glass-hover relative flex h-full min-h-[142px] flex-col gap-2 rounded-2xl border border-border/60 p-3.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:min-h-[150px] sm:p-4",
          accent?.border,
          !rank && inactive && "accent-inactive",
        )}
      >
        <div className="relative flex items-start justify-between gap-3">
          <p className="text-sm font-semibold">{title}</p>
          {rank ? (
            <RankBadge src={rank.badgeImageUrl} rankKey={rank.rankKey} size={56} />
          ) : (
            <Trophy className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          )}
        </div>
        <div className="relative flex flex-wrap items-end justify-between gap-x-3 gap-y-1">
          <p
            className={cn(
              "break-words font-display text-lg font-bold",
              accent?.title,
            )}
          >
            {rank ? rankLabel : emptyLabel}
          </p>
          <span
            className={cn(
              "text-[10px] font-bold uppercase tracking-[0.12em] text-primary",
              accent?.value,
            )}
          >
            {actionLabel}
          </span>
        </div>
        <CardProgress
          percent={progressPercent}
          label={progressLabel}
          accent={accent}
        />
      </article>
    </Link>
  );
}

export function SalaryCard({
  title,
  rankKey,
  balance,
  progressPercent,
  progressLabel,
  progressValueLabel,
  progressLeftLabel,
  progressRightLabel,
  lastWeekLabel,
  lastWeekAmount,
  thisMonthLabel,
  thisMonthAmount,
}: {
  title: string;
  rankKey: string | null;
  balance: string;
  progressPercent: number;
  progressLabel: string;
  progressValueLabel?: string;
  progressLeftLabel: string;
  progressRightLabel: string;
  lastWeekLabel: string;
  lastWeekAmount: string;
  thisMonthLabel: string;
  thisMonthAmount: string;
}) {
  const accent = rankAccent(rankKey);

  return (
    <Link href="/member/salary" className="block h-full rounded-2xl">
      <article
        style={accent.backgroundImage ? { backgroundImage: accent.backgroundImage } : undefined}
        className={cn(
          "glass glass-hover flex h-full min-h-[142px] flex-col gap-2 rounded-2xl border border-border/60 p-3.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:min-h-[150px] sm:p-4",
          accent.border,
        )}
      >
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-semibold">{title}</p>
          <p
            className={cn(
              "font-display text-base font-bold tabular-nums sm:text-lg",
              accent.value,
            )}
          >
            {balance}
          </p>
        </div>
        <CardProgress
          percent={progressPercent}
          label={progressLabel}
          leftLabel={progressLeftLabel}
          rightLabel={progressRightLabel}
          accent={accent}
          valueLabel={progressValueLabel}
          gradient={rankProgressGradient(rankKey)}
        />
        <div className="mt-auto grid grid-cols-2 gap-2">
          <div className="min-w-0 rounded-lg border border-border/50 bg-background/40 px-2 py-1.5">
            <p className="truncate text-[9px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
              {lastWeekLabel}
            </p>
            <p className="mt-0.5 truncate text-sm font-bold tabular-nums">{lastWeekAmount}</p>
          </div>
          <div className="min-w-0 rounded-lg border border-border/50 bg-background/40 px-2 py-1.5">
            <p className="truncate text-[9px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
              {thisMonthLabel}
            </p>
            <p className="mt-0.5 truncate text-sm font-bold tabular-nums">{thisMonthAmount}</p>
          </div>
        </div>
      </article>
    </Link>
  );
}
