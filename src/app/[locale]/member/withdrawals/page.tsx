import { getTranslations, setRequestLocale } from "next-intl/server";
import { Landmark } from "lucide-react";
import { auth } from "@/auth";
import { PageHeader } from "@/components/member/page-header";
import { formatMemberDate } from "@/components/member/format-date";
import { statusLabelKey } from "@/components/member/status-labels";
import { WithdrawalForm } from "@/components/member/withdrawal-form";
import { redirect } from "@/i18n/navigation";
import { formatSP, paisaToSPInput } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import { isProfitOnlyMatured, resolveProfitOnlyMaturityDate } from "@/lib/services/maturity";
import { parseSavedWithdrawalMethod } from "@/lib/withdrawal-methods";

export const dynamic = "force-dynamic";

function accountText(value: unknown, key: string) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return "—";
  const field = (value as Record<string, unknown>)[key];
  return typeof field === "string" ? field : "—";
}

type PaymentMethodKey = "bkash" | "nagad" | "bank" | "other";

function paymentMethodLabelKey(method: string): PaymentMethodKey {
  switch (method) {
    case "BKASH":
      return "bkash";
    case "NAGAD":
      return "nagad";
    case "BANK":
      return "bank";
    default:
      return "other";
  }
}

export default async function WithdrawalsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const [session, tm, tn, tc] = await Promise.all([
    auth(),
    getTranslations("memberPanel"),
    getTranslations("nav"),
    getTranslations("checkout"),
  ]);
  if (!session?.user?.id) {
    redirect({ href: "/login", locale });
    return null;
  }

  const memberId = session.user.id;
  const [wallet, settings, requests, profitOnlyInvestments, savedMethods] = await Promise.all([
    prisma.wallet.findUnique({
      where: { memberId },
      select: { availablePaisa: true },
    }),
    prisma.investmentSettings.findFirst({
      where: { isActive: true },
      orderBy: { version: "desc" },
      select: { minWithdrawalPaisa: true, withdrawalFeeBps: true },
    }),
    prisma.withdrawal.findMany({
      where: { memberId },
      orderBy: { requestedAt: "desc" },
      select: {
        id: true,
        requestNumber: true,
        amountPaisa: true,
        feePaisa: true,
        netPaisa: true,
        method: true,
        accountDetails: true,
        status: true,
        type: true,
        noticeAt: true,
        payableAt: true,
        note: true,
        requestedAt: true,
      },
    }),
    prisma.investment.findMany({
      where: {
        memberId,
        type: "PROFIT_ONLY",
        status: "ACTIVE",
        remainingPrincipalPaisa: { gt: 0n },
        withdrawals: {
          none: { type: "PRINCIPAL", status: { in: ["PENDING", "APPROVED"] } },
        },
      },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        investmentNumber: true,
        remainingPrincipalPaisa: true,
        lockInEndsAt: true,
        startDate: true,
        lockInMonths: true,
        createdAt: true,
      },
    }),
    prisma.withdrawalMethod.findMany({
      where: { memberId },
      orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
      select: {
        id: true,
        label: true,
        method: true,
        accountDetails: true,
        isDefault: true,
      },
    }),
  ]);

  const availablePaisa = wallet?.availablePaisa ?? 0n;
  const minWithdrawalPaisa = settings?.minWithdrawalPaisa ?? 50000n;
  const feeBps = settings?.withdrawalFeeBps ?? 1000;
  const principalInvestments = profitOnlyInvestments
    .filter((investment) => {
      const maturity = resolveProfitOnlyMaturityDate({
        lockInEndsAt: investment.lockInEndsAt,
        startDate: investment.startDate,
        lockInMonths: investment.lockInMonths,
        fallbackStartDate: investment.createdAt,
      });
      return maturity ? isProfitOnlyMatured(maturity) : false;
    })
    .map((investment) => ({
      id: investment.id,
      label: `${investment.investmentNumber} · ${formatSP(investment.remainingPrincipalPaisa)}`,
      amount: paisaToSPInput(investment.remainingPrincipalPaisa),
    }));

  return (
    <div className="space-y-8 animate-rise">
      <PageHeader
        eyebrow={tn("withdrawals")}
        title={tm("withdrawalsTitle")}
        intro={tm("withdrawalsIntro")}
        icon={<Landmark className="size-3.5" aria-hidden="true" />}
      />

      <WithdrawalForm
        availablePaisa={availablePaisa}
        minWithdrawalPaisa={minWithdrawalPaisa}
        feeBps={feeBps}
        principalInvestments={principalInvestments}
        savedMethods={savedMethods.map(parseSavedWithdrawalMethod)}
      />

      <section className="glass min-w-0 rounded-3xl p-6 sm:p-8" aria-labelledby="withdrawals-heading">
        <h2 id="withdrawals-heading" className="font-display text-xl font-bold tracking-tight">
          {tm("withdrawalsTitle")}
        </h2>
        {requests.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">{tm("noWithdrawals")}</p>
        ) : (
          <ul className="mt-5 space-y-4">
            {requests.map((request) => (
              <li key={request.id} className="min-w-0 rounded-2xl border border-border bg-background/40 p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">{tm("requestNumber")}</p>
                    <p className="truncate font-display font-bold text-primary" translate="no">
                      {request.requestNumber}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {tm("requestedAt")}: {formatMemberDate(request.requestedAt, locale, true)}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {tm("withdrawalType")}:{" "}
                      {request.type === "PRINCIPAL"
                        ? tm("principalWithdrawal")
                        : tm("availableWithdrawal")}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {tm("paymentMethod")}: {tc(paymentMethodLabelKey(request.method))}
                    </p>
                    {request.noticeAt && request.payableAt ? (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {tm("noticeAt")}: {formatMemberDate(request.noticeAt, locale, true)} · {tm("payableAt")}:{" "}
                        {formatMemberDate(request.payableAt, locale, true)}
                      </p>
                    ) : null}
                  </div>
                  <span className="glass rounded-full px-3 py-1 text-xs font-semibold">
                    {tm(statusLabelKey(request.status))}
                  </span>
                </div>
                <dl className="mt-4 grid gap-3 sm:grid-cols-3">
                  <div className="min-w-0">
                    <dt className="text-xs text-muted-foreground">{tm("amount")}</dt>
                    <dd className="mt-1 font-display font-bold tabular-nums">{formatSP(request.amountPaisa)}</dd>
                  </div>
                  <div className="min-w-0">
                    <dt className="text-xs text-muted-foreground">{tm("fee")}</dt>
                    <dd className="mt-1 font-display font-bold tabular-nums">{formatSP(request.feePaisa)}</dd>
                  </div>
                  <div className="min-w-0">
                    <dt className="text-xs text-muted-foreground">{tm("net")}</dt>
                    <dd className="mt-1 font-display font-bold tabular-nums">{formatSP(request.netPaisa)}</dd>
                  </div>
                </dl>
                <div className="mt-4 text-xs text-muted-foreground">
                  <p className="font-semibold">{tm("accountDetails")}</p>
                  <p className="mt-1">
                    {tm("accountName")}: {accountText(request.accountDetails, "accountName")} · {tm("accountNumber")}:{" "}
                    <span translate="no">{accountText(request.accountDetails, "accountNumber")}</span>
                  </p>
                  {request.method === "BANK" ? (
                    <p className="mt-1">
                      {tm("bankName")}: {accountText(request.accountDetails, "bankName")} · {tm("branch")}:{" "}
                      {accountText(request.accountDetails, "branch")}
                    </p>
                  ) : null}
                </div>
                {request.note ? <p className="mt-2 text-xs text-muted-foreground">{request.note}</p> : null}
              </li>
            ))}
          </ul>
        )}
        <p className="mt-6 text-xs text-muted-foreground">{tm("statusNote")}</p>
      </section>
    </div>
  );
}
