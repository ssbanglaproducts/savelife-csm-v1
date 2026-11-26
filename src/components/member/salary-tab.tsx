"use client";

import { useId, useState, type ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  Award,
  Banknote,
  CalendarCheck,
  CalendarClock,
  CheckCircle2,
  Clock,
  History,
  Info,
  Wallet,
  XCircle,
} from "lucide-react";
import { DialogShell } from "@/components/ui/dialog-shell";
import { formatMemberDate } from "@/components/member/format-date";
import { formatSP } from "@/lib/money";
import type { MemberSalaryDto, MemberSalaryPaymentDto } from "@/lib/services/member-salary";

type Tone = "gold" | "green" | "blue" | "neutral";

const toneClasses: Record<Tone, string> = {
  gold: "bg-amber-500/10 text-amber-700 ring-amber-500/25 dark:text-amber-300",
  green: "bg-emerald-500/10 text-emerald-700 ring-emerald-500/25 dark:text-emerald-300",
  blue: "bg-sky-500/10 text-sky-700 ring-sky-500/25 dark:text-sky-300",
  neutral: "bg-muted text-muted-foreground ring-border",
};

function IconBubble({ tone, children }: { tone: Tone; children: ReactNode }) {
  return (
    <span
      className={`flex size-8 shrink-0 items-center justify-center rounded-lg ring-1 ring-inset ${toneClasses[tone]}`}
    >
      {children}
    </span>
  );
}

function SummaryCard({
  label,
  value,
  hint,
  tone,
  icon,
}: {
  label: string;
  value: string;
  hint?: ReactNode;
  tone: Tone;
  icon: ReactNode;
}) {
  return (
    <article className="glass flex min-w-0 items-start justify-between gap-3 rounded-2xl p-4">
      <div className="min-w-0">
        <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
          {label}
        </p>
        <p className="mt-2 break-words font-display text-lg font-bold tabular-nums">{value}</p>
        {hint ? <div className="mt-1 text-[11px] leading-snug text-muted-foreground">{hint}</div> : null}
      </div>
      <IconBubble tone={tone}>{icon}</IconBubble>
    </article>
  );
}

function PaymentStatus({ status }: { status: MemberSalaryPaymentDto["status"] }) {
  const t = useTranslations("memberPanel");
  const successful = status === "SUCCESS";
  const pending = status === "PENDING";
  const label = successful
    ? t("salarySuccessful")
    : pending
      ? t("salaryStatusPending")
      : t("salaryFailed");
  const Icon = successful ? CheckCircle2 : pending ? Clock : XCircle;
  const className = successful
    ? "bg-emerald-500/15 text-emerald-700 ring-emerald-500/30 dark:text-emerald-300"
    : pending
      ? "bg-sky-500/15 text-sky-700 ring-sky-500/30 dark:text-sky-300"
      : "bg-red-500/15 text-red-700 ring-red-500/30 dark:text-red-300";

  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ring-1 ring-inset ${className}`}
    >
      <Icon className="size-3" aria-hidden="true" />
      {label}
    </span>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-xl bg-[var(--glass)] px-3 py-2.5">
      <dt className="shrink-0 text-xs text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words text-right text-xs font-bold tabular-nums">{value}</dd>
    </div>
  );
}

function InfoDot({ label }: { label: string }) {
  return (
    <span role="img" aria-label={label} title={label} className="inline-flex cursor-help text-muted-foreground">
      <Info className="size-3.5" aria-hidden="true" />
    </span>
  );
}

/** Personal salary dashboard shown as the third Rank & Rewards tab. */
export function SalaryTab({ salary }: { salary: MemberSalaryDto }) {
  const t = useTranslations("memberPanel");
  const locale = useLocale();
  const titleId = useId();
  const [showAll, setShowAll] = useState(false);
  const [selected, setSelected] = useState<MemberSalaryPaymentDto | null>(null);

  const entitlement = salary.entitlement;
  const rankLabel = entitlement
    ? locale === "bn"
      ? entitlement.rankNameBn
      : entitlement.rankName
    : t("salaryNoEntitlement");
  const maxWeeks = entitlement?.maxWeeks ?? null;
  const weeksPaid = entitlement?.weeksPaid ?? 0;
  const ongoing = maxWeeks === null;
  const progress = maxWeeks !== null && maxWeeks > 0 ? (weeksPaid * 100) / maxWeeks : 0;
  const progressLabel = `${Number.isInteger(progress) ? progress : progress.toFixed(2)}%`;
  const payments = showAll ? salary.payments : salary.payments.slice(0, 5);

  return (
    <div className="space-y-4">
      <section aria-labelledby="salary-overview-heading">
        <h2
          id="salary-overview-heading"
          className="mb-3 text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground"
        >
          {t("salaryOverview")}
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <SummaryCard
            label={t("salaryCurrentSalaryRank")}
            value={rankLabel}
            tone="gold"
            icon={<Award className="size-4" aria-hidden="true" />}
            hint={
              entitlement ? (
                <span className="inline-flex items-center gap-1 font-bold text-emerald-700 dark:text-emerald-300">
                  <CheckCircle2 className="size-3" aria-hidden="true" />
                  {t("salaryStatusActive")}
                </span>
              ) : null
            }
          />
          <SummaryCard
            label={t("salaryWeeklyCap")}
            value={entitlement ? formatSP(BigInt(entitlement.maxWeeklySalaryPaisa)) : "—"}
            tone="gold"
            icon={<Wallet className="size-4" aria-hidden="true" />}
            hint={t("salaryCapHint")}
          />
          <SummaryCard
            label={t("salaryTotalReceived")}
            value={formatSP(BigInt(salary.totalReceivedPaisa))}
            tone="green"
            icon={<Banknote className="size-4" aria-hidden="true" />}
            hint={t("salaryTotalHint")}
          />
          <SummaryCard
            label={t("salaryProgressTitle")}
            value={entitlement ? (ongoing ? String(weeksPaid) : `${weeksPaid} / ${maxWeeks}`) : "—"}
            tone="blue"
            icon={<CalendarCheck className="size-4" aria-hidden="true" />}
            hint={entitlement ? (ongoing ? t("salaryOngoing") : t("salarySuccessfulPayments")) : null}
          />
        </div>
      </section>

      <section aria-labelledby="salary-progress-heading" className="glass rounded-2xl p-4 sm:p-5">
        <div className="flex items-center gap-2">
          <h2
            id="salary-progress-heading"
            className="text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground"
          >
            {t("salaryProgressTitle")}
          </h2>
          <InfoDot label={t("salaryProgressHint")} />
        </div>

        {entitlement ? (
          <div className="mt-4">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <div>
                <p className="font-display text-lg font-bold">{rankLabel}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{t("salaryCurrentRank")}</p>
              </div>
              <p className="text-sm font-bold tabular-nums text-emerald-700 dark:text-emerald-300">
                {ongoing
                  ? t("salaryOngoingCount", { count: weeksPaid })
                  : t("salaryProgressCount", { paid: weeksPaid, total: maxWeeks })}
              </p>
            </div>

            {ongoing ? (
              <p className="mt-4 rounded-xl bg-muted px-3 py-2.5 text-xs font-semibold text-muted-foreground">
                {t("salaryOngoing")}
              </p>
            ) : (
              <div className="mt-4">
                <div className="flex items-center justify-between gap-2 text-xs font-bold">
                  <span className="text-muted-foreground">{t("salaryProgressTitle")}</span>
                  <span className="tabular-nums text-emerald-700 dark:text-emerald-300">
                    {t("salaryPercentProgress", { percent: progressLabel })}
                  </span>
                </div>
                <div
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={maxWeeks ?? 0}
                  aria-valuenow={weeksPaid}
                  aria-label={t("salaryProgressTitle")}
                  className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted"
                >
                  <div
                    className="h-full rounded-full bg-emerald-500 transition-[width] duration-300"
                    style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="mt-4 rounded-xl border border-dashed border-border px-4 py-9 text-center">
            <CalendarCheck className="mx-auto size-6 text-muted-foreground" aria-hidden="true" />
            <p className="mt-2 text-sm font-bold">{t("salaryNoEntitlement")}</p>
            <p className="mx-auto mt-1 max-w-md text-xs leading-relaxed text-muted-foreground">
              {t("salaryNoEligibility")}
            </p>
          </div>
        )}
      </section>

      <section aria-labelledby="salary-next-heading" className="glass rounded-2xl p-4 sm:p-5">
        <div className="flex items-center gap-2">
          <h2
            id="salary-next-heading"
            className="text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground"
          >
            {t("salaryNextDistribution")}
          </h2>
          <InfoDot label={t("salaryScheduleHint")} />
        </div>
        <div className="mt-4 flex items-start gap-3">
          <IconBubble tone="blue">
            <CalendarClock className="size-4" aria-hidden="true" />
          </IconBubble>
          <div className="min-w-0">
            <p className="font-display text-base font-bold">{t("salaryNextDistributionTitle")}</p>
            <p className="mt-1 text-sm font-bold tabular-nums text-sky-700 dark:text-sky-300">
              {t("salaryDistributionWhen")}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">{t("salaryTimezone")}</p>
          </div>
        </div>
      </section>

      <section aria-labelledby="salary-history-heading" className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <History className="size-4 text-muted-foreground" aria-hidden="true" />
            <h2
              id="salary-history-heading"
              className="text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground"
            >
              {t("salaryPaymentHistory")}
            </h2>
          </div>
          {salary.payments.length > 0 ? (
            <button
              type="button"
              onClick={() => setShowAll((current) => !current)}
              className="text-xs font-bold text-primary hover:underline focus-visible:rounded focus-visible:ring-2 focus-visible:ring-ring"
            >
              {showAll && salary.payments.length > 5 ? t("salaryShowLess") : t("salaryViewAll")}
            </button>
          ) : null}
        </div>

        {salary.payments.length === 0 ? (
          <p className="glass rounded-2xl px-5 py-9 text-center text-sm text-muted-foreground">
            {t("salaryNoPayments")}
          </p>
        ) : (
          <div className="glass min-w-0 divide-y divide-border overflow-hidden rounded-2xl">
            {payments.map((payment) => {
              const name = locale === "bn" ? payment.rankNameBn : payment.rankName;
              return (
                <button
                  key={payment.id}
                  type="button"
                  onClick={() => setSelected(payment)}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                >
                  <IconBubble tone={payment.status === "SUCCESS" ? "green" : "neutral"}>
                    {payment.status === "SUCCESS" ? (
                      <CheckCircle2 className="size-4" aria-hidden="true" />
                    ) : payment.status === "PENDING" ? (
                      <Clock className="size-4" aria-hidden="true" />
                    ) : (
                      <XCircle className="size-4" aria-hidden="true" />
                    )}
                  </IconBubble>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate text-sm font-bold">{name}</span>
                      <PaymentStatus status={payment.status} />
                    </div>
                    <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                      {formatMemberDate(new Date(payment.weekEndAt), locale)} · {payment.id}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p
                      className={`text-sm font-bold tabular-nums ${
                        payment.status === "SUCCESS"
                          ? "text-emerald-700 dark:text-emerald-300"
                          : "text-muted-foreground"
                      }`}
                    >
                      {formatSP(BigInt(payment.amountPaisa))}
                    </p>
                    <p className="mt-0.5 text-[10px] text-muted-foreground">
                      {formatMemberDate(new Date(payment.createdAt), locale, true)}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </section>

      {selected ? (
        <DialogShell
          title={t("salaryPaymentDetails")}
          intro={t("salaryPaymentDetailsIntro")}
          titleId={titleId}
          onClose={() => setSelected(null)}
        >
          <dl className="space-y-2">
            <DetailRow
              label={t("salaryPaymentDate")}
              value={formatMemberDate(new Date(selected.weekEndAt), locale, true)}
            />
            <DetailRow
              label={t("salaryCurrentRank")}
              value={locale === "bn" ? selected.rankNameBn : selected.rankName}
            />
            <DetailRow label={t("salaryPaymentAmount")} value={formatSP(BigInt(selected.amountPaisa))} />
            <DetailRow label={t("salaryTransactionId")} value={selected.id} />
            <DetailRow
              label={t("salaryStatus")}
              value={
                selected.status === "SUCCESS"
                  ? t("salarySuccessful")
                  : selected.status === "PENDING"
                    ? t("salaryStatusPending")
                    : t("salaryFailed")
              }
            />
          </dl>
        </DialogShell>
      ) : null}
    </div>
  );
}

