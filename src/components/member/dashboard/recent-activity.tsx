import { ArrowDownLeft, ArrowRightLeft, ArrowUpRight } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { DashboardRecentEntry } from "@/lib/services/member-dashboard";
import { cn } from "@/lib/utils";

export async function RecentActivity({
  entries,
}: {
  entries: readonly DashboardRecentEntry[];
}) {
  const [t, tc] = await Promise.all([
    getTranslations("memberPanel"),
    getTranslations("common"),
  ]);

  return (
    <section aria-labelledby="recent-activity-heading" className="glass min-w-0 rounded-3xl border border-border/60 p-5 sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <h2 id="recent-activity-heading" className="font-display text-lg font-bold tracking-tight sm:text-xl">
          {t("recentActivity")}
        </h2>
        <Link
          href="/member/transactions"
          className="shrink-0 rounded-lg text-xs font-semibold text-primary transition-colors hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {tc("viewAll")}
        </Link>
      </div>

      {entries.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">{t("noActivity")}</p>
      ) : (
        <ul className="mt-4 divide-y divide-border">
          {entries.map((entry) => {
            const transfer = entry.direction === "TRANSFER";
            const incoming = entry.direction === "IN";
            const Icon = transfer ? ArrowRightLeft : incoming ? ArrowDownLeft : ArrowUpRight;
            return (
              <li key={entry.id} className="flex items-center gap-3 py-3.5">
                <span
                  className={cn(
                    "flex size-9 shrink-0 items-center justify-center rounded-xl",
                    transfer
                      ? "bg-sky-500/10 text-sky-600 dark:text-sky-300"
                      : incoming
                        ? "bg-emerald-500/10 text-emerald-500"
                        : "bg-amber-500/10 text-amber-500",
                  )}
                >
                  <Icon className="size-4" aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">
                    {entry.sourceLabelKey
                      ? t("walletTransfer", { source: t(entry.sourceLabelKey) })
                      : t(entry.typeKey)}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">{entry.dateTime}</p>
                </div>
                <p
                  className={cn(
                    "shrink-0 break-words text-right text-sm font-bold tabular-nums",
                    !transfer && (incoming ? "text-emerald-500" : "text-amber-500"),
                  )}
                >
                  {transfer ? "" : incoming ? "+" : "-"}
                  {entry.amount}
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
