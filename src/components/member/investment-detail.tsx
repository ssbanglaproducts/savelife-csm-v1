"use client";

import { useTranslations } from "next-intl";
import { Landmark } from "lucide-react";
import { StatusBadge } from "@/components/admin/admin-ui";
import {
  DetailSection,
  EmptyNote,
  Field,
  InstallmentPanel,
  InvestmentMetricStrip,
  RecordLine,
  RecordTile,
} from "@/components/admin/investment-detail";
import type { InvestmentCardRow } from "@/components/admin/investment-cards";
import { LedgerActivityList } from "@/components/admin/ledger-list";

/** Member-facing view of a single investment. Internal audit data is omitted. */
export function MemberInvestmentDetail({ row }: { row: InvestmentCardRow }) {
  const t = useTranslations("memberPanel");
  const tc = useTranslations("common");
  const isInstallment = row.type === "INSTALLMENT";
  const endDateLabel = isInstallment ? t("planEnds") : t("maturityDate");
  const endDate = isInstallment
    ? (row.installments[row.installments.length - 1]?.dueDate ?? "—")
    : row.terms.lockInEndsAt;

  return (
    <div className="space-y-6">
      <section className="glass relative overflow-hidden rounded-2xl p-5 sm:p-6">
        <div
          className="absolute inset-y-0 left-0 w-1 bg-primary"
          aria-hidden="true"
        />
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-4">
            <span className="flex size-14 shrink-0 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
              <Landmark className="size-6" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="truncate font-display text-2xl font-bold" translate="no">
                  {row.investmentNumber}
                </h2>
                <StatusBadge tone={row.tone} label={row.statusLabel} />
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{row.typeLabel}</p>
            </div>
          </div>
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
          <div className="grid gap-x-8 gap-y-5 sm:grid-cols-3">
            <Field label={tc("status")} value={row.principalNotice.statusLabel} />
            <Field label={t("noticeAmount")} value={row.principalNotice.amount} />
            <Field label={t("payableAt")} value={row.principalNotice.payableAt} />
          </div>
          <p className="mt-4 text-xs text-muted-foreground">{t("principalNoticeHint")}</p>
        </DetailSection>
      ) : null}

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
          noPending: t("noPendingInstallments"),
          noPaid: t("noPaidInstallments"),
        }}
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

      <DetailSection title={t("ledgerActivity")}>
        <LedgerActivityList entries={row.ledger} />
      </DetailSection>
    </div>
  );
}
