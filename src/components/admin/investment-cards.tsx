"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { ChevronRight, Landmark, Search } from "lucide-react";
import { EmptyState, StatusBadge, adminInputClass, type StatusTone } from "@/components/admin/admin-ui";
import type { InvestmentAudience } from "@/lib/services/admin-investments";
import { Link } from "@/i18n/navigation";

export type InvestmentLedgerEntry = {
  id: string;
  date: string;
  typeLabel: string;
  direction: string;
  directionType: "CREDIT" | "DEBIT";
  amount: string;
  balanceAfter: string;
  description: string;
  reference: string;
};

export type InvestmentCardRow = {
  id: string;
  investmentNumber: string;
  type: string;
  status: string;
  statusLabel: string;
  tone: StatusTone;
  typeLabel: string;
  amount: string;
  monthlyInstallment: string;
  createdAt: string;
  progressLabel: string;
  progress: { paid: number; total: number; percent: number };
  canReject: boolean;
  hasPendingProof: boolean;
  member: {
    id: string;
    memberId: string;
    name: string;
    email: string;
    phone: string;
    profileImage: string | null;
  };
  terms: {
    remainingPrincipal: string;
    durationMonths: string;
    lockInMonths: string;
    startDate: string;
    lockInEndsAt: string;
    createdAt: string;
    updatedAt: string;
    verifiedAt: string;
    settingsVersion: string;
  };
  principalNotice: {
    id: string;
    status: string;
    statusLabel: string;
    tone: StatusTone;
    noticeAt: string;
    payableAt: string;
    amount: string;
  } | null;
  installments: readonly {
    id: string;
    periodNo: number;
    dueDate: string;
    amount: string;
    status: string;
    statusLabel: string;
    tone: StatusTone;
    paidAt: string;
  }[];
  proofs: readonly {
    id: string;
    status: string;
    method: string;
    transactionRef: string;
    amount: string;
    statusLabel: string;
    tone: StatusTone;
    note: string;
    imageUrl: string | null;
    submittedAt: string;
    reviewedAt: string;
  }[];
  rewards: readonly {
    id: string;
    beneficiary: string;
    level: number;
    rate: string;
    amount: string;
    createdAt: string;
  }[];
  profitLines: readonly {
    id: string;
    month: string;
    date: string;
    statusLabel: string;
    eligible: string;
    allocated: string;
    rate: string;
  }[];
  ledger: readonly InvestmentLedgerEntry[];
  recentLedger: readonly InvestmentLedgerEntry[];
  audit: readonly {
    id: string;
    action: string;
    entityType: string;
    actor: string;
    createdAt: string;
  }[];
};

export type InvestmentInstallment = InvestmentCardRow["installments"][number];

const railTone: Record<StatusTone, string> = {
  success: "bg-primary",
  warning: "bg-amber-500",
  danger: "bg-red-500",
  neutral: "bg-muted-foreground/40",
};

export function InvestmentCards({
  rows,
  audience = "admin",
  pendingProofOnly = false,
  statusFilter,
  emptyMessage,
}: {
  rows: readonly InvestmentCardRow[];
  audience?: InvestmentAudience;
  pendingProofOnly?: boolean;
  statusFilter?: string;
  emptyMessage?: string;
}) {
  const t = useTranslations(audience === "admin" ? "adminPanel" : "memberPanel");
  const tc = useTranslations("common");
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const statusScopedRows = statusFilter
      ? rows.filter((row) => row.status === statusFilter)
      : rows;
    const scopedRows = pendingProofOnly
      ? statusScopedRows.filter((row) => row.hasPendingProof)
      : statusScopedRows;
    if (!needle) return scopedRows;
    return scopedRows.filter((row) => {
      const values = [
        row.investmentNumber,
        row.typeLabel,
        row.statusLabel,
        row.terms.startDate,
        ...row.proofs.map((proof) => proof.transactionRef),
      ];
      if (audience === "admin") {
        values.push(row.member.name, row.member.memberId, row.member.email, row.member.phone);
      }
      return values.some((value) => value.toLowerCase().includes(needle));
    });
  }, [audience, pendingProofOnly, query, rows, statusFilter]);

  const basePath = audience === "admin" ? "/admin/investments" : "/member/investments";

  return (
    <div>
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          {audience === "admin" ? (
            <Link
              href={pendingProofOnly ? basePath : `${basePath}?proof=pending`}
              className="rounded-full border border-border px-2.5 py-1 text-xs font-semibold text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {pendingProofOnly ? t("showAllRecords") : t("pendingProofFilter")}
            </Link>
          ) : null}
        </div>
        <label className="relative w-full sm:max-w-sm">
          <span className="sr-only">{tc("search")}</span>
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={tc("search")}
            className={`${adminInputClass} pl-10`}
          />
        </label>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          message={
            query
              ? t("noInvestmentMatches")
              : emptyMessage ?? (pendingProofOnly ? t("noProofMatches") : t("noInvestments"))
          }
        />
      ) : (
        <div className="flex flex-wrap gap-4">
          {filtered.map((row) => (
            <Link
              key={row.id}
              href={`${basePath}/${row.id}`}
              aria-label={`${tc("view")}: ${row.investmentNumber}`}
              className="glass relative min-w-[min(100%,20rem)] flex-1 overflow-hidden rounded-2xl p-5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring hover:border-primary/40"
            >
              <span
                className={`absolute inset-y-0 left-0 w-1 ${railTone[row.tone]}`}
                aria-hidden="true"
              />
              <span className="absolute inset-x-0 top-0 h-1 bg-border/50" aria-hidden="true">
                <span
                  className={`block h-full ${row.progress.total > 0 ? "bg-primary" : "bg-muted-foreground/30"}`}
                  style={{ width: `${row.progress.total > 0 ? row.progress.percent : 100}%` }}
                />
              </span>

              <div className="flex items-start gap-3 pt-1">
                {audience === "admin" ? (
                  <Avatar name={row.member.name} src={row.member.profileImage} />
                ) : (
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-full border border-primary/20 bg-primary/10 text-primary">
                    <Landmark className="size-5" aria-hidden="true" />
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-display text-base font-semibold">
                        {audience === "admin" ? row.member.name : row.investmentNumber}
                      </p>
                      <p className="truncate font-mono text-[11px] text-muted-foreground">
                        {audience === "admin" ? row.member.memberId : row.typeLabel}
                      </p>
                    </div>
                    <StatusBadge tone={row.tone} label={row.statusLabel} />
                  </div>
                  {audience === "admin" && row.hasPendingProof ? (
                    <div className="mt-2 flex justify-end">
                      <StatusBadge tone="warning" label={t("pendingProof")} />
                    </div>
                  ) : null}
                  {row.principalNotice ? (
                    <div className="mt-2 flex justify-end">
                      <StatusBadge
                        tone={row.principalNotice.tone}
                        label={`${t("principalNotice")}: ${row.principalNotice.statusLabel}`}
                      />
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="mt-5 flex items-end justify-between gap-3 border-t border-border pt-4">
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">{tc("amount")}</p>
                  <p className="truncate font-display text-2xl font-bold tabular-nums" title={row.amount}>
                    {row.amount}
                  </p>
                </div>
                <span className="shrink-0 rounded-full border border-border bg-[var(--glass)] px-2.5 py-1 text-xs font-semibold">
                  {audience === "admin" ? row.typeLabel : row.progressLabel}
                </span>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-x-3 gap-y-3 text-xs">
                <div className="min-w-0">
                  <p className="text-muted-foreground">
                    {audience === "admin" ? t("investmentNumber") : t("startDate")}
                  </p>
                  <p className="truncate font-mono">
                    {audience === "admin" ? row.investmentNumber : row.terms.startDate}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">{t("installments")}</p>
                  <p className="tabular-nums">{row.progressLabel}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">{t("remainingPrincipal")}</p>
                  <p className="tabular-nums">{row.terms.remainingPrincipal}</p>
                </div>
                <div className="min-w-0">
                  <p className="text-muted-foreground">{t("applied")}</p>
                  <p className="truncate">{row.createdAt}</p>
                </div>
              </div>

              <div className="mt-4 border-t border-border pt-3">
                <p className="text-xs font-semibold text-muted-foreground">{t("ledgerActivity")}</p>
                {row.recentLedger.length === 0 ? (
                  <p className="mt-1 text-[11px] text-muted-foreground">{t("noLedger")}</p>
                ) : (
                  <ul className="mt-2 space-y-1.5">
                    {row.recentLedger.map((entry) => (
                      <li key={entry.id} className="flex items-baseline justify-between gap-2 text-[11px]">
                        <span className="min-w-0 truncate text-muted-foreground">
                          <span className="font-semibold text-foreground">{entry.typeLabel}</span>
                          {" · "}
                          {entry.date}
                        </span>
                        <span
                          className={`shrink-0 font-bold tabular-nums ${
                            entry.directionType === "CREDIT" ? "text-primary" : "text-amber-500"
                          }`}
                        >
                          {entry.amount}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <span className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-primary">
                {tc("view")}
                <ChevronRight className="size-3.5" aria-hidden="true" />
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function Avatar({ name, src }: { name: string; src: string | null }) {
  const [failed, setFailed] = useState(false);
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

  if (src && !failed) {
    return (
      // Profile images are admin-uploaded files or external URLs of unknown size.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={name}
        onError={() => setFailed(true)}
        className="size-11 shrink-0 rounded-full border border-border object-cover"
      />
    );
  }

  return (
    <span className="flex size-11 shrink-0 items-center justify-center rounded-full border border-border bg-primary/10 text-xs font-bold text-primary">
      {initials || "?"}
    </span>
  );
}
