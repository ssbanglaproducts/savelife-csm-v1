"use client";

import { useTranslations } from "next-intl";
import type { InvestmentLedgerEntry } from "./investment-cards";

/** Full-width ledger rows shared by the admin and member investment detail pages. */
export function LedgerActivityList({ entries }: { entries: readonly InvestmentLedgerEntry[] }) {
  const t = useTranslations("adminPanel");
  const tc = useTranslations("common");

  if (entries.length === 0) {
    return <p className="text-sm text-muted-foreground">{t("noLedger")}</p>;
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border">
      <div className="hidden grid-cols-[8.5rem_10rem_4rem_7rem_7rem_minmax(0,1fr)] gap-4 border-b border-border bg-background/40 px-4 py-3 text-xs font-semibold text-muted-foreground lg:grid">
        <span>{tc("date")}</span>
        <span>{t("ledgerType")}</span>
        <span>{t("direction")}</span>
        <span className="text-right">{tc("amount")}</span>
        <span className="text-right">{t("balanceAfter")}</span>
        <span>{t("description")}</span>
      </div>
      <ul className="divide-y divide-border">
        {entries.map((entry) => (
          <li
            key={entry.id}
            className="grid gap-2 px-4 py-4 text-sm lg:grid-cols-[8.5rem_10rem_4rem_7rem_7rem_minmax(0,1fr)] lg:items-center lg:gap-4"
          >
            <span className="text-xs text-muted-foreground">{entry.date}</span>
            <span className="min-w-0 truncate font-semibold">{entry.typeLabel}</span>
            <span className="text-xs font-semibold text-muted-foreground">{entry.direction}</span>
            <span
              className={`font-display text-base font-bold tabular-nums lg:text-right ${
                entry.directionType === "CREDIT" ? "text-primary" : "text-amber-500"
              }`}
            >
              {entry.amount}
            </span>
            <span className="text-right text-xs tabular-nums text-muted-foreground">
              {entry.balanceAfter}
            </span>
            <span className="min-w-0 text-xs leading-relaxed text-muted-foreground">
              <span className="block break-words" title={entry.description}>
                {entry.description}
              </span>
              {entry.reference !== "—" ? (
                <span className="mt-1 block break-all font-mono" title={entry.reference}>
                  {entry.reference}
                </span>
              ) : null}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
