import { getTranslations, setRequestLocale } from "next-intl/server";
import { CalendarDays, Wallet as WalletIcon } from "lucide-react";
import { auth } from "@/auth";
import { formatMemberDate } from "@/components/member/format-date";
import { PageHeader } from "@/components/member/page-header";
import { Link, redirect } from "@/i18n/navigation";
import { formatSP } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import { isSalaryRankKey } from "@/lib/salary";
import { getActiveSalaryPlan } from "@/lib/services/salary-plan";

export const dynamic = "force-dynamic";

export default async function MemberSalaryPage({
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
    getTranslations("common"),
  ]);
  if (!session?.user?.id) {
    redirect({ href: "/login", locale });
    return null;
  }

  const salaryPlan = await getActiveSalaryPlan(prisma);
  const [wallet, entitlement, payments] = await Promise.all([
    prisma.wallet.findUnique({
      where: { memberId: session.user.id },
      select: { salaryPaisa: true },
    }),
    prisma.salaryEntitlement.findUnique({
      where: { memberId: session.user.id },
      select: {
        rankKey: true,
        rankSortOrder: true,
        weeksPaid: true,
        achievedAt: true,
        isActive: true,
      },
    }),
    prisma.salaryPayment.findMany({
      where: { memberId: session.user.id },
      orderBy: { createdAt: "desc" },
      take: 100,
      select: {
        id: true,
        rankKey: true,
        amountPaisa: true,
        weekNumber: true,
        status: true,
        createdAt: true,
        distribution: { select: { weekEndAt: true, postedAt: true } },
      },
    }),
  ]);

  const config =
    entitlement?.isActive && isSalaryRankKey(entitlement.rankKey)
      ? salaryPlan.configs[entitlement.rankKey]
      : null;
  const rankLabel = config
    ? locale === "bn"
      ? config.defaultNameBn
      : config.defaultName
    : tm("salaryNoEntitlement");
  const durationLabel = config
    ? config.maxWeeks === null
      ? tm("salaryOngoing")
      : `${config.maxWeeks} ${tm("week")}`
    : "—";

  return (
    <div className="space-y-8 animate-rise">
      <PageHeader
        eyebrow={tn("salary")}
        title={tm("salaryTitle")}
        intro={tm("salaryIntro")}
        icon={<CalendarDays className="size-3.5" aria-hidden="true" />}
      />

      <section aria-labelledby="salary-summary-heading" className="grid gap-4 sm:grid-cols-3">
        <h2 id="salary-summary-heading" className="sr-only">
          {tm("salaryTitle")}
        </h2>
        <article className="glass rounded-2xl p-5">
          <p className="text-xs font-semibold text-muted-foreground">{tm("salaryCurrentRank")}</p>
          <p className="mt-3 break-words font-display text-xl font-bold">{rankLabel}</p>
          <p className="mt-2 text-xs text-muted-foreground">
            {entitlement ? formatMemberDate(entitlement.achievedAt, locale) : "—"}
          </p>
        </article>
        <article className="glass rounded-2xl p-5">
          <p className="text-xs font-semibold text-muted-foreground">{tm("salaryBalance")}</p>
          <p className="mt-3 font-display text-2xl font-bold tabular-nums">
            {formatSP(wallet?.salaryPaisa ?? 0n)}
          </p>
          <Link
            href="/member/wallet"
            className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline focus-visible:rounded focus-visible:ring-2 focus-visible:ring-ring"
          >
            <WalletIcon className="size-3.5" aria-hidden="true" />
            {tn("wallet")}
          </Link>
        </article>
        <article className="glass rounded-2xl p-5">
          <p className="text-xs font-semibold text-muted-foreground">{tm("salaryWeeksPaid")}</p>
          <p className="mt-3 font-display text-2xl font-bold tabular-nums">
            {entitlement?.weeksPaid ?? 0}
            {config?.maxWeeks !== null && config ? ` / ${config.maxWeeks}` : ""}
          </p>
          <p className="mt-2 text-xs text-muted-foreground">{durationLabel}</p>
        </article>
      </section>

      <p className="text-xs text-muted-foreground">{tm("salaryInactiveHint")}</p>

      <section aria-labelledby="salary-history-title-heading" className="space-y-4">
        <div>
          <h2 id="salary-history-title-heading" className="font-display text-xl font-bold">
            {tm("salaryHistoryTitle")}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">{tm("salaryHistoryIntro")}</p>
        </div>

        {payments.length === 0 ? (
          <p className="glass rounded-2xl px-5 py-10 text-center text-sm text-muted-foreground">
            {tm("salaryNoPayments")}
          </p>
        ) : (
          <div className="glass min-w-0 overflow-hidden rounded-2xl">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[680px] border-collapse text-left text-sm">
                <caption className="sr-only">{tm("salaryHistoryTitle")}</caption>
                <thead>
                  <tr className="border-b border-border text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    <th scope="col" className="whitespace-nowrap px-4 py-3">
                      {tm("salaryWeek")}
                    </th>
                    <th scope="col" className="whitespace-nowrap px-4 py-3">
                      {tm("salaryCurrentRank")}
                    </th>
                    <th scope="col" className="whitespace-nowrap px-4 py-3">
                      {tm("salaryWeekNumber")}
                    </th>
                    <th scope="col" className="whitespace-nowrap px-4 py-3">
                      {tc("amount")}
                    </th>
                    <th scope="col" className="whitespace-nowrap px-4 py-3">
                      {tm("salaryPaidAt")}
                    </th>
                    <th scope="col" className="whitespace-nowrap px-4 py-3">
                      {tm("salaryStatus")}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {payments.map((payment) => {
                    const paymentConfig = isSalaryRankKey(payment.rankKey)
                      ? salaryPlan.configs[payment.rankKey]
                      : null;
                    const paymentRank = paymentConfig
                      ? locale === "bn"
                        ? paymentConfig.defaultNameBn
                        : paymentConfig.defaultName
                      : payment.rankKey;
                    const paid = payment.status === "SUCCESS";
                    return (
                      <tr key={payment.id} className="align-top">
                        <td className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground">
                          {formatMemberDate(payment.distribution.weekEndAt, locale)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3">{paymentRank}</td>
                        <td className="whitespace-nowrap px-4 py-3 tabular-nums">
                          {payment.weekNumber}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 font-semibold tabular-nums">
                          {formatSP(payment.amountPaisa)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground">
                          {formatMemberDate(payment.distribution.postedAt, locale, true)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3">
                          <span
                            className={
                              paid
                                ? "amount-credit text-xs font-bold"
                                : "amount-debit text-xs font-bold"
                            }
                          >
                            {paid ? tm("salarySuccess") : tm("salaryFailed")}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
