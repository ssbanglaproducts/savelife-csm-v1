"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import {
  EmptyState,
  StatusBadge,
  adminInputClass,
  type StatusTone,
} from "@/components/admin/admin-ui";
import { Link } from "@/i18n/navigation";
import { formatSP } from "@/lib/money";
import { cn } from "@/lib/utils";

export type SalaryTreasuryHistoryPaymentView = {
  readonly id: string;
  readonly memberRecordId: string;
  readonly memberDisplayId: string;
  readonly memberName: string;
  readonly amountPaisa: string;
  readonly weekNumberLabel: string;
  readonly status: "SUCCESS" | "FAILED";
  readonly statusLabel: string;
  readonly statusTone: StatusTone;
};

export type SalaryTreasuryHistoryRunView = {
  readonly id: string;
  readonly weekLabel: string;
  readonly postedLabel: string;
  readonly statusLabel: string;
  readonly statusTone: StatusTone;
  readonly payments: readonly SalaryTreasuryHistoryPaymentView[];
};

export function SalaryTreasuryHistory({
  runs,
  labels,
}: {
  runs: readonly SalaryTreasuryHistoryRunView[];
  labels: {
    readonly search: string;
    readonly noMatches: string;
    readonly rankPaid: string;
    readonly noPayments: string;
    readonly paidMembers: string;
  };
}) {
  const [query, setQuery] = useState("");

  const filteredRuns = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return runs;

    return runs
      .map((run) => {
        const weekMatches = `${run.weekLabel} ${run.postedLabel}`.toLowerCase().includes(needle);
        const payments = weekMatches
          ? run.payments
          : run.payments.filter((payment) =>
              [
                payment.memberName,
                payment.memberDisplayId,
                payment.weekNumberLabel,
                formatSP(BigInt(payment.amountPaisa)),
                payment.statusLabel,
              ].some((value) => value.toLowerCase().includes(needle)),
            );
        return { run: { ...run, payments }, weekMatches };
      })
      .filter(({ run, weekMatches }) => weekMatches || run.payments.length > 0)
      .map(({ run }) => run);
  }, [runs, query]);

  return (
    <div className="space-y-4">
      <div className="relative max-w-md">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={labels.search}
          aria-label={labels.search}
          className={cn(adminInputClass, "pl-9")}
        />
      </div>

      {filteredRuns.length === 0 ? (
        <EmptyState message={labels.noMatches} />
      ) : (
        <div className="glass divide-y divide-border overflow-hidden rounded-2xl">
          {filteredRuns.map((run) => {
            const paid = run.payments.filter((payment) => payment.status === "SUCCESS");
            const paidPaisa = paid.reduce(
              (total, payment) => total + BigInt(payment.amountPaisa),
              0n,
            );

            return (
              <article key={run.id} id={`distribution-${run.id}`} className="p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="font-display text-lg font-bold tabular-nums">
                      {run.weekLabel}
                    </h3>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {run.postedLabel} · {labels.paidMembers} {paid.length}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <StatusBadge tone={run.statusTone} label={run.statusLabel} />
                    <span className="font-display text-lg font-bold tabular-nums">
                      {formatSP(paidPaisa)}
                    </span>
                  </div>
                </div>

                <p className="mt-4 text-xs font-semibold text-muted-foreground">
                  {labels.rankPaid}
                </p>
                {run.payments.length === 0 ? (
                  <p className="mt-2 text-sm text-muted-foreground">{labels.noPayments}</p>
                ) : (
                  <ul className="mt-2 grid gap-2 lg:grid-cols-2">
                    {run.payments.map((payment) => (
                      <li
                        key={payment.id}
                        className="flex items-center justify-between gap-3 rounded-xl border border-border bg-[var(--glass-strong)] px-3 py-2 text-xs"
                      >
                        <div className="min-w-0">
                          <Link
                            href={`/admin/members/${payment.memberDisplayId}`}
                            className="truncate font-semibold hover:underline"
                          >
                            {payment.memberName}
                          </Link>
                          <p className="truncate text-muted-foreground">
                            {payment.memberDisplayId} · {payment.weekNumberLabel}
                          </p>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="font-semibold tabular-nums">
                            {formatSP(BigInt(payment.amountPaisa))}
                          </p>
                          <StatusBadge tone={payment.statusTone} label={payment.statusLabel} />
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
