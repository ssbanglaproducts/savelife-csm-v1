"use client";

import { cn } from "@/lib/utils";

export type ChartTooltipRow = {
  readonly label: string;
  readonly value: string;
};

/** One focusable chart column with a hover/focus tooltip. */
export function ChartBar({
  label,
  title,
  rows,
  ratio,
  dateLabel,
}: {
  label: string;
  title: string;
  rows: readonly ChartTooltipRow[];
  ratio: number;
  dateLabel: string;
}) {
  const hasValue = ratio > 0;

  return (
    <div className="group relative flex h-full min-w-0 flex-1 flex-col">
      <div className="flex min-h-0 flex-1 items-end">
        <div className="relative h-full w-full">
          <div
            role="img"
            aria-label={label}
            tabIndex={0}
            className={cn(
              "absolute bottom-0 w-full rounded-t-md transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              hasValue
                ? "bg-primary/70 ring-1 ring-inset ring-primary/20 group-hover:bg-primary/90"
                : "bg-border/50 group-hover:bg-border",
            )}
            style={{ height: hasValue ? `${Math.max(3, ratio * 100)}%` : "2px" }}
          />
          <div className="pointer-events-none absolute bottom-full left-1/2 z-30 mb-2 hidden w-max max-w-[12rem] -translate-x-1/2 rounded-lg border border-border bg-[var(--card-solid)] px-2.5 py-2 text-left text-xs shadow-xl group-hover:block group-focus-within:block">
            <p className="font-semibold text-foreground">{title}</p>
            {rows.map((row) => (
              <p key={row.label} className="mt-1 flex items-center justify-between gap-3 text-muted-foreground">
                <span>{row.label}</span>
                <span className="font-semibold tabular-nums text-foreground">{row.value}</span>
              </p>
            ))}
          </div>
        </div>
      </div>
      <span className="mt-2 h-4 truncate text-center text-[10px] text-muted-foreground">
        {dateLabel}
      </span>
    </div>
  );
}
