"use client";

import { useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { ChevronDown, Copy } from "lucide-react";
import { toast } from "sonner";
import { StatusBadge } from "@/components/admin/admin-ui";
import { copyText } from "@/lib/clipboard";
import { cn } from "@/lib/utils";
import {
  InvestmentRejectForm,
  PaymentReviewForm,
  ReverseInstallmentForm,
} from "./action-forms";
import type { InvestmentCardRow, InvestmentInstallment } from "./investment-cards";
import { LedgerActivityList } from "./ledger-list";

export function InvestmentDetail({ row }: { row: InvestmentCardRow }) {
  const t = useTranslations("adminPanel");
  const tc = useTranslations("common");
  const isInstallment = row.type === "INSTALLMENT";
  const endDateLabel = isInstallment ? t("planEnds") : t("maturityDate");
  const endDate = isInstallment
    ? (row.installments[row.installments.length - 1]?.dueDate ?? "—")
    : row.terms.lockInEndsAt;

  async function copy(value: string, label: string) {
    if (!(await copyText(value))) {
      toast.error(tc("error"));
      return;
    }
    toast.success(`${label}: ${value}`);
  }

  return (
    <div className="space-y-6">
      <section className="glass relative overflow-hidden rounded-2xl p-5 sm:p-6">
        <div
          className={cn(
            "absolute inset-y-0 left-0 w-1",
            {
              success: "bg-primary",
              warning: "bg-amber-500",
              danger: "bg-red-500",
              neutral: "bg-muted-foreground/40",
            }[row.tone],
          )}
          aria-hidden="true"
        />
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 items-center gap-4">
            <Avatar name={row.member.name} src={row.member.profileImage} large />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="truncate font-display text-2xl font-bold">{row.member.name}</h2>
                <StatusBadge tone={row.tone} label={row.statusLabel} />
              </div>
              <p className="mt-1 break-all font-mono text-xs text-muted-foreground">
                {row.investmentNumber} · {row.member.memberId}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">{row.typeLabel}</p>
            </div>
          </div>
          {row.canReject ? <InvestmentRejectForm investmentId={row.id} /> : null}
        </div>

        <InvestmentMetricStrip
          row={row}
          labels={{
            progress: t("installmentProgress"),
            noProgress: t("noSchedule"),
            amount: tc("amount"),
            remainingPrincipal: t("remainingPrincipal"),
            monthlyInstallment: t("monthlyInstallment"),
            installments: t("installments"),
          }}
        />
      </section>

      <DetailSection title={t("termsTimeline")}>
        <div className="grid gap-x-8 gap-y-5 sm:grid-cols-2 xl:grid-cols-4">
          <Field label={t("investmentType")} value={row.typeLabel} />
          <Field label={t("remainingPrincipal")} value={row.terms.remainingPrincipal} />
          <Field label={t("settingsVersion")} value={row.terms.settingsVersion} />
          <Field label={t("durationMonthsLabel")} value={row.terms.durationMonths} />
          <Field label={t("lockInMonths")} value={row.terms.lockInMonths} />
          <Field label={t("startDate")} value={row.terms.startDate} />
          <Field label={endDateLabel} value={endDate} />
          <Field label={t("applied")} value={row.terms.createdAt} />
          <Field label={t("activatedAt")} value={row.terms.verifiedAt} />
        </div>
      </DetailSection>

      {row.principalNotice ? (
        <DetailSection title={t("principalNotice")}>
          <div className="grid gap-x-8 gap-y-5 sm:grid-cols-2 xl:grid-cols-4">
            <Field label={tc("status")} value={row.principalNotice.statusLabel} />
            <Field label={t("noticeAmount")} value={row.principalNotice.amount} />
            <Field label={t("noticeAt")} value={row.principalNotice.noticeAt} />
            <Field label={t("payableAt")} value={row.principalNotice.payableAt} />
          </div>
          <p className="mt-4 text-xs text-muted-foreground">{t("principalNoticeHint")}</p>
        </DetailSection>
      ) : null}

      <DetailSection title={t("member")}>
        <div className="grid gap-x-8 gap-y-5 sm:grid-cols-2 xl:grid-cols-4">
          <Field label={t("name")} value={row.member.name} />
          <Field label={t("investmentNumber")} value={row.member.memberId} mono />
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">{t("email")}</p>
            <div className="mt-1 flex min-w-0 items-center gap-2 text-sm">
              <span className="min-w-0 truncate" title={row.member.email}>
                {row.member.email}
              </span>
              <CopyButton
                label={t("copyEmail")}
                onClick={() => void copy(row.member.email, t("email"))}
              />
            </div>
          </div>
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">{t("phone")}</p>
            <div className="mt-1 flex min-w-0 items-center gap-2 text-sm">
              <span className="min-w-0 truncate">{row.member.phone}</span>
              <CopyButton
                label={t("copyPhone")}
                onClick={() => void copy(row.member.phone, t("phone"))}
              />
            </div>
          </div>
        </div>
      </DetailSection>

      <InstallmentPanel
        installments={row.installments}
        labels={{
          title: t("installments"),
          hint: t("installmentGraphicHint"),
          pending: t("pending"),
          paid: t("paid"),
          due: t("dueDate"),
          paidAt: t("paidAt"),
          expand: t("expandInstallments"),
          collapse: t("collapseInstallments"),
          noInstallments: t("noInstallments"),
          noPending: t("noPendingInstallments"),
          noPaid: t("noPaidInstallments"),
        }}
        renderAction={(installment) =>
          installment.status === "PAID" ? (
            <ReverseInstallmentForm installmentId={installment.id} />
          ) : null
        }
      />

      <DetailSection title={t("paymentProofs")}>
        {row.proofs.length === 0 ? (
          <EmptyNote message={t("noProofs")} />
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {row.proofs.map((proof) => (
              <RecordTile key={proof.id}>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold">{proof.method}</span>
                  <StatusBadge tone={proof.tone} label={proof.statusLabel} />
                </div>
                <p className="mt-3 font-display text-lg font-bold tabular-nums">{proof.amount}</p>
                <RecordLine label={t("reference")} value={proof.transactionRef} mono />
                <RecordLine label={tc("date")} value={proof.submittedAt} />
                {proof.reviewedAt !== "—" ? (
                  <RecordLine label={t("verifiedAt")} value={proof.reviewedAt} />
                ) : null}
                {proof.note !== "—" ? (
                  <RecordLine label={t("note")} value={proof.note} />
                ) : null}
                {proof.imageUrl ? (
                  <a
                    href={proof.imageUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-3 inline-flex text-xs font-semibold text-primary hover:underline"
                  >
                    {tc("view")}
                  </a>
                ) : null}
                {proof.status === "PENDING" ? (
                  <div className="mt-4 border-t border-border pt-4">
                    <PaymentReviewForm proofId={proof.id} />
                  </div>
                ) : null}
              </RecordTile>
            ))}
          </div>
        )}
      </DetailSection>

      <DetailSection title={t("profitReceived")}>
        {row.profitLines.length === 0 ? (
          <EmptyNote message={t("noProfit")} />
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {row.profitLines.map((line) => (
              <RecordTile key={line.id}>
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-xs text-muted-foreground">{line.month}</span>
                  <StatusBadge tone="success" label={line.statusLabel} />
                </div>
                <p className="mt-3 font-display text-lg font-bold tabular-nums">{line.allocated}</p>
                <RecordLine label={tc("date")} value={line.date} />
                <RecordLine label={t("eligible")} value={line.eligible} />
                <RecordLine label={t("profitPerThousand")} value={line.rate} />
              </RecordTile>
            ))}
          </div>
        )}
      </DetailSection>

      <DetailSection title={t("affiliateRewards")}>
        {row.rewards.length === 0 ? (
          <EmptyNote message={t("noRewards")} />
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {row.rewards.map((reward) => (
              <RecordTile key={reward.id}>
                <p className="truncate font-semibold">{reward.beneficiary}</p>
                <p className="mt-3 font-display text-lg font-bold tabular-nums">{reward.amount}</p>
                <RecordLine label={t("level")} value={String(reward.level)} />
                <RecordLine label={t("rate")} value={reward.rate} />
                <RecordLine label={tc("date")} value={reward.createdAt} />
              </RecordTile>
            ))}
          </div>
        )}
      </DetailSection>

      <DetailSection title={t("ledgerActivity")}>
        <LedgerActivityList entries={row.ledger} />
      </DetailSection>

      <DetailSection title={t("auditTitle")}>
        {row.audit.length === 0 ? (
          <EmptyNote message={t("noAudit")} />
        ) : (
          <div className="grid gap-x-8 gap-y-3 sm:grid-cols-2 xl:grid-cols-3">
            {row.audit.map((entry) => (
              <p key={entry.id} className="min-w-0 text-xs">
                <span className="font-mono font-semibold">{entry.action}</span>
                <span className="text-muted-foreground">
                  {" · "}
                  {entry.entityType} · {entry.actor} · {entry.createdAt}
                </span>
              </p>
            ))}
          </div>
        )}
      </DetailSection>
    </div>
  );
}

export type MetricStripLabels = {
  progress: string;
  noProgress: string;
  amount: string;
  remainingPrincipal: string;
  monthlyInstallment: string;
  installments: string;
};

/** Progress rail above a row of four identically sized numeric metrics. */
export function InvestmentMetricStrip({
  row,
  labels,
}: {
  row: InvestmentCardRow;
  labels: MetricStripLabels;
}) {
  const { paid, total, percent } = row.progress;

  return (
    <div className="mt-6 border-t border-border pt-5">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs">
        <span className="font-semibold text-muted-foreground">{labels.progress}</span>
        <span className="font-semibold tabular-nums">
          {total > 0 ? `${paid}/${total} · ${percent}%` : labels.noProgress}
        </span>
      </div>
      <div
        className="h-2 w-full overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-label={labels.progress}
        aria-valuenow={total > 0 ? percent : 0}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-300"
          style={{ width: `${total > 0 ? percent : 0}%` }}
        />
      </div>
      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Metric label={labels.amount} value={row.amount} />
        <Metric label={labels.remainingPrincipal} value={row.terms.remainingPrincipal} />
        <Metric label={labels.monthlyInstallment} value={row.monthlyInstallment} />
        <Metric label={labels.installments} value={row.progressLabel} />
      </div>
    </div>
  );
}

export type InstallmentPanelLabels = {
  title: string;
  hint: string;
  pending: string;
  paid: string;
  due: string;
  paidAt: string;
  expand: string;
  collapse: string;
  /** Only used when there are no installments at all. */
  noInstallments?: string;
  noPending: string;
  noPaid: string;
};

/** Collapsed installment timeline that expands into pending and paid groups. */
export function InstallmentPanel({
  installments,
  labels,
  renderAction,
}: {
  installments: readonly InvestmentInstallment[];
  labels: InstallmentPanelLabels;
  renderAction?: (installment: InvestmentInstallment) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const pending = installments.filter((item) => item.status !== "PAID");
  const paid = installments.filter((item) => item.status === "PAID");

  return (
    <section className="glass min-w-0 rounded-2xl p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-display text-base font-bold">{labels.title}</h3>
          <p className="mt-1 text-xs text-muted-foreground">{labels.hint}</p>
        </div>
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-border bg-[var(--glass)] px-3 py-2 text-xs font-semibold transition-colors hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {open ? labels.collapse : labels.expand}
          <ChevronDown
            className={cn("size-3.5 transition-transform duration-200", open && "rotate-180")}
            aria-hidden="true"
          />
        </button>
      </div>

      {installments.length === 0 ? (
        <p className="mt-5 text-sm text-muted-foreground">
          {labels.noInstallments ?? labels.noPending}
        </p>
      ) : (
        <div className="mt-5 flex flex-wrap gap-1.5" role="list" aria-label={labels.title}>
          {installments.map((item) => (
            <span
              key={item.id}
              role="listitem"
              title={`#${item.periodNo} · ${item.amount} · ${item.statusLabel}`}
              className={cn(
                "flex h-9 min-w-[1.75rem] flex-1 items-center justify-center rounded-md px-1 text-[10px] font-bold tabular-nums",
                {
                  success: "bg-primary text-primary-foreground",
                  warning: "bg-amber-500/15 text-amber-700 ring-1 ring-inset ring-amber-500/40 dark:text-amber-300",
                  danger: "bg-red-500/15 text-red-600 ring-1 ring-inset ring-red-500/40 dark:text-red-300",
                  neutral: "bg-muted text-muted-foreground ring-1 ring-inset ring-border",
                }[item.tone],
              )}
            >
              {item.periodNo}
            </span>
          ))}
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-[11px] text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm bg-primary" aria-hidden="true" />
          {labels.paid}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm bg-amber-500/40 ring-1 ring-inset ring-amber-500/40" aria-hidden="true" />
          {labels.pending}
        </span>
        <span className="tabular-nums">
          {paid.length} / {installments.length}
        </span>
      </div>

      {open ? (
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <InstallmentGroup title={labels.pending} count={pending.length} empty={labels.noPending}>
            {pending.map((item) => (
              <InstallmentLine key={item.id} item={item} labels={labels}>
                {renderAction?.(item)}
              </InstallmentLine>
            ))}
          </InstallmentGroup>
          <InstallmentGroup title={labels.paid} count={paid.length} empty={labels.noPaid}>
            {paid.map((item) => (
              <InstallmentLine key={item.id} item={item} labels={labels}>
                {renderAction?.(item)}
              </InstallmentLine>
            ))}
          </InstallmentGroup>
        </div>
      ) : null}
    </section>
  );
}

function InstallmentGroup({
  title,
  count,
  empty,
  children,
}: {
  title: string;
  count: number;
  empty: string;
  children: ReactNode;
}) {
  return (
    <div className="min-w-0 rounded-xl border border-border bg-[var(--glass)] p-4">
      <div className="flex items-center justify-between gap-2 border-b border-border pb-3">
        <h4 className="text-sm font-bold">{title}</h4>
        <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-bold tabular-nums">
          {count}
        </span>
      </div>
      {count === 0 ? (
        <p className="mt-4 text-xs text-muted-foreground">{empty}</p>
      ) : (
        <ul className="mt-1 divide-y divide-border">{children}</ul>
      )}
    </div>
  );
}

function InstallmentLine({
  item,
  labels,
  children,
}: {
  item: InvestmentInstallment;
  labels: InstallmentPanelLabels;
  children?: ReactNode;
}) {
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5 text-sm first:pt-2 last:pb-0">
      <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-muted font-mono text-xs font-bold tabular-nums">
        {item.periodNo}
      </span>
      <span className="font-display font-bold tabular-nums">{item.amount}</span>
      <span className="text-xs text-muted-foreground">
        {item.status === "PAID" ? labels.paidAt : labels.due}: {item.status === "PAID" ? item.paidAt : item.dueDate}
      </span>
      <div className="ml-auto flex items-center gap-2">
        <StatusBadge tone={item.tone} label={item.statusLabel} />
        {children}
      </div>
    </li>
  );
}

export function Avatar({
  name,
  src,
  large = false,
}: {
  name: string;
  src: string | null;
  large?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
  const size = large ? "size-16 text-lg" : "size-11 text-xs";

  if (src && !failed) {
    return (
      // Profile images are admin-uploaded files or external URLs of unknown size.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={name}
        onError={() => setFailed(true)}
        className={cn(size, "shrink-0 rounded-full border border-border object-cover")}
      />
    );
  }

  return (
    <span
      className={cn(
        size,
        "flex shrink-0 items-center justify-center rounded-full border border-border bg-primary/10 font-bold text-primary",
      )}
    >
      {initials || "?"}
    </span>
  );
}

function CopyButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="shrink-0 rounded p-1 text-muted-foreground transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <Copy className="size-3.5" aria-hidden="true" />
    </button>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-xl border border-border bg-[var(--glass)] p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className="mt-1 truncate font-display text-lg font-bold tabular-nums sm:text-xl"
        title={value}
      >
        {value}
      </p>
    </div>
  );
}

export function DetailSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="glass min-w-0 rounded-2xl p-5 sm:p-6">
      <h3 className="font-display text-base font-bold">{title}</h3>
      <div className="mt-5">{children}</div>
    </section>
  );
}

export function Field({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="min-w-0">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn("mt-1 text-sm", mono && "break-all font-mono text-xs")}>{value}</p>
    </div>
  );
}

export function RecordTile({ children }: { children: ReactNode }) {
  return (
    <div className="min-w-0 rounded-xl border border-border bg-[var(--glass)] p-4">{children}</div>
  );
}

export function RecordLine({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="mt-2 flex min-w-0 items-baseline justify-between gap-3 text-xs">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span className={cn("min-w-0 truncate text-right font-semibold", mono && "font-mono")} title={value}>
        {value}
      </span>
    </div>
  );
}

export function EmptyNote({ message }: { message: string }) {
  return <p className="text-sm text-muted-foreground">{message}</p>;
}
