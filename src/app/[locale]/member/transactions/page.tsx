import { getTranslations, setRequestLocale } from "next-intl/server";
import {
  ArrowDownLeft,
  ArrowRightLeft,
  ArrowUpRight,
  Banknote,
  CalendarDays,
  ChevronDown,
  Gift,
  Landmark,
  Percent,
  Plus,
  ReceiptText,
  RotateCcw,
  ScrollText,
  ShoppingBag,
  SlidersHorizontal,
  TrendingUp,
  Trophy,
  Users,
  type LucideIcon,
} from "lucide-react";
import { auth } from "@/auth";
import { PageHeader } from "@/components/member/page-header";
import { formatMemberDate } from "@/components/member/format-date";
import { directionLabelKey, ledgerTypeLabelKey } from "@/components/member/status-labels";
import { Link, redirect } from "@/i18n/navigation";
import type { LedgerEntryType } from "@/generated/prisma/enums";
import { formatSP } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;

const transactionIcons: Record<LedgerEntryType, LucideIcon> = {
  ORDER_REFUND: RotateCcw,
  INVESTMENT_PRINCIPAL: Landmark,
  INSTALLMENT_PAYMENT: ReceiptText,
  PROFIT_DISTRIBUTION: TrendingUp,
  AFFILIATE_REWARD: Users,
  WITHDRAWAL: Banknote,
  WITHDRAWAL_FEE: Percent,
  BALANCE_TRANSFER: ArrowRightLeft,
  PRINCIPAL_RETURN: RotateCcw,
  ADMIN_ADJUSTMENT: SlidersHorizontal,
  REWARD_COLLECTION: Gift,
  MEMBER_TRANSFER_OUT: ArrowUpRight,
  MEMBER_TRANSFER_IN: ArrowDownLeft,
  ORDER_WALLET_PAYMENT: ShoppingBag,
  WALLET_TOP_UP: Plus,
  RANK_REWARD_CREDIT: Trophy,
  RANK_REWARD_RECLASSIFY: Trophy,
  SALARY_PAYMENT: CalendarDays,
  ROI_COMMISSION_CREDIT: TrendingUp,
};

const transactionIconTone: Record<LedgerEntryType, string> = {
  ORDER_REFUND: "bg-sky-500/10 text-sky-600 ring-sky-500/20 dark:text-sky-300",
  INVESTMENT_PRINCIPAL: "bg-violet-500/10 text-violet-600 ring-violet-500/20 dark:text-violet-300",
  INSTALLMENT_PAYMENT: "bg-indigo-500/10 text-indigo-600 ring-indigo-500/20 dark:text-indigo-300",
  PROFIT_DISTRIBUTION: "bg-emerald-500/10 text-emerald-600 ring-emerald-500/20 dark:text-emerald-300",
  AFFILIATE_REWARD: "bg-amber-500/10 text-amber-600 ring-amber-500/20 dark:text-amber-300",
  WITHDRAWAL: "bg-rose-500/10 text-rose-600 ring-rose-500/20 dark:text-rose-300",
  WITHDRAWAL_FEE: "bg-rose-500/10 text-rose-600 ring-rose-500/20 dark:text-rose-300",
  BALANCE_TRANSFER: "bg-sky-500/10 text-sky-600 ring-sky-500/20 dark:text-sky-300",
  PRINCIPAL_RETURN: "bg-indigo-500/10 text-indigo-600 ring-indigo-500/20 dark:text-indigo-300",
  ADMIN_ADJUSTMENT: "bg-teal-500/10 text-teal-600 ring-teal-500/20 dark:text-teal-300",
  REWARD_COLLECTION: "bg-amber-500/10 text-amber-600 ring-amber-500/20 dark:text-amber-300",
  MEMBER_TRANSFER_OUT: "bg-rose-500/10 text-rose-600 ring-rose-500/20 dark:text-rose-300",
  MEMBER_TRANSFER_IN: "bg-emerald-500/10 text-emerald-600 ring-emerald-500/20 dark:text-emerald-300",
  ORDER_WALLET_PAYMENT: "bg-sky-500/10 text-sky-600 ring-sky-500/20 dark:text-sky-300",
  WALLET_TOP_UP: "bg-emerald-500/10 text-emerald-600 ring-emerald-500/20 dark:text-emerald-300",
  RANK_REWARD_CREDIT: "bg-purple-500/10 text-purple-600 ring-purple-500/20 dark:text-purple-300",
  RANK_REWARD_RECLASSIFY: "bg-purple-500/10 text-purple-600 ring-purple-500/20 dark:text-purple-300",
  SALARY_PAYMENT: "bg-blue-500/10 text-blue-600 ring-blue-500/20 dark:text-blue-300",
  ROI_COMMISSION_CREDIT: "bg-rose-500/10 text-rose-600 ring-rose-500/20 dark:text-rose-300",
};

function amountClass(direction: "CREDIT" | "DEBIT") {
  return direction === "CREDIT" ? "amount-credit" : "amount-debit";
}

export default async function TransactionsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ page?: string | string[] | undefined }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const [session, tm, tn, tc, query] = await Promise.all([
    auth(),
    getTranslations("memberPanel"),
    getTranslations("nav"),
    getTranslations("common"),
    searchParams,
  ]);
  if (!session?.user?.id) {
    redirect({ href: "/login", locale });
    return null;
  }

  const requestedPage = Array.isArray(query.page) ? query.page[0] : query.page;
  const parsedPage = Number.parseInt(requestedPage ?? "1", 10);
  const total = await prisma.ledgerEntry.count({
    where: { memberId: session.user.id },
  });
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(Math.max(Number.isFinite(parsedPage) ? parsedPage : 1, 1), totalPages);

  const entries = await prisma.ledgerEntry.findMany({
    where: { memberId: session.user.id },
    orderBy: { createdAt: "desc" },
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
    select: {
      id: true,
      type: true,
      direction: true,
      amountPaisa: true,
      balanceAfterPaisa: true,
      createdAt: true,
      description: true,
      referenceType: true,
      referenceId: true,
    },
  });

  const transferNumbers = [
    ...new Set(
      entries
        .filter((entry) => entry.referenceType === "MemberTransfer" && entry.referenceId)
        .map((entry) => entry.referenceId as string),
    ),
  ];
  const transfers =
    transferNumbers.length > 0
      ? await prisma.memberTransfer.findMany({
          where: { transferNumber: { in: transferNumbers } },
          select: {
            transferNumber: true,
            sender: { select: { fullName: true, memberId: true } },
            recipient: { select: { fullName: true, memberId: true } },
          },
        })
      : [];
  const transferByNumber = new Map(transfers.map((item) => [item.transferNumber, item]));

  return (
    <div className="space-y-8 animate-rise">
      <PageHeader
        eyebrow={tn("transactions")}
        title={tm("transactionsTitle")}
        intro={tm("transactionsIntro")}
        icon={<ScrollText className="size-3.5" aria-hidden="true" />}
      />

      <section className="min-w-0" aria-labelledby="transactions-heading">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 id="transactions-heading" className="font-display text-xl font-bold tracking-tight">
            {tm("transactionsTitle")}
          </h2>
          {total > 0 ? (
            <p className="text-xs text-muted-foreground">
              {tm("pageLabel", { page, totalPages })}
            </p>
          ) : null}
        </div>

        {entries.length === 0 ? (
          <p className="mt-5 text-sm text-muted-foreground">{tm("noTransactions")}</p>
        ) : (
          <ul className="mt-5 space-y-2">
            {entries.map((entry) => {
              const transfer = entry.referenceId ? transferByNumber.get(entry.referenceId) : undefined;
              const counterparty = transfer
                ? entry.direction === "DEBIT"
                  ? transfer.recipient
                  : transfer.sender
                : undefined;
              const counterpartyLabel = transfer
                ? entry.direction === "DEBIT"
                  ? tm("sentTo")
                  : tm("receivedFrom")
                : null;

              const Icon = transactionIcons[entry.type];
              const title = tm(ledgerTypeLabelKey(entry.type));

              return (
                <li key={entry.id} className="glass rounded-2xl border border-border/60">
                  <details className="group">
                    <summary className="flex cursor-pointer list-none items-center gap-3 rounded-2xl p-3.5 transition-colors hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:p-4 [&::-webkit-details-marker]:hidden">
                      <span
                        className={cn(
                          "flex size-10 shrink-0 items-center justify-center rounded-xl ring-1",
                          transactionIconTone[entry.type],
                        )}
                        aria-hidden="true"
                      >
                        <Icon className="size-5" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold">{title}</span>
                        <span className="mt-1 block truncate text-xs text-muted-foreground">
                          {formatMemberDate(entry.createdAt, locale, true)}
                        </span>
                      </span>
                      <span className="shrink-0 text-right">
                        <span
                          className={cn(
                            "block font-display text-sm font-bold tabular-nums sm:text-base",
                            amountClass(entry.direction),
                          )}
                        >
                          {entry.direction === "DEBIT" ? "-" : "+"}
                          {formatSP(entry.amountPaisa)}
                        </span>
                      </span>
                      <ChevronDown
                        className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
                        aria-hidden="true"
                      />
                    </summary>
                    <dl className="grid gap-x-6 gap-y-2 border-t border-border/60 px-3.5 py-3 text-xs sm:grid-cols-2 sm:px-4 sm:py-4">
                      <div className="min-w-0 sm:col-span-2">
                        <dt className="text-muted-foreground">{tm("transactionId")}</dt>
                        <dd className="mt-0.5 break-words font-mono text-[11px] font-semibold" translate="no">
                          {entry.id}
                        </dd>
                      </div>
                      <div className="min-w-0">
                        <dt className="text-muted-foreground">{tm("direction")}</dt>
                        <dd className="mt-0.5 font-semibold">
                          {tm(directionLabelKey(entry.direction))}
                        </dd>
                      </div>
                      <div className="min-w-0">
                        <dt className="text-muted-foreground">{tm("balanceAfter")}</dt>
                        <dd className="mt-0.5 font-semibold tabular-nums">
                          {formatSP(entry.balanceAfterPaisa)}
                        </dd>
                      </div>
                      {counterparty && counterpartyLabel ? (
                        <div className="min-w-0 sm:col-span-2">
                          <dt className="text-muted-foreground">{counterpartyLabel}</dt>
                          <dd className="mt-0.5 font-semibold">
                            {counterparty.fullName}{" "}
                            <span translate="no">({counterparty.memberId})</span>
                          </dd>
                        </div>
                      ) : null}
                      {entry.description ? (
                        <div className="min-w-0 sm:col-span-2">
                          <dt className="text-muted-foreground">{tm("description")}</dt>
                          <dd className="mt-0.5 break-words">{entry.description}</dd>
                        </div>
                      ) : null}
                      {entry.referenceId ? (
                        <div className="min-w-0 sm:col-span-2">
                          <dt className="text-muted-foreground">{tm("reference")}</dt>
                          <dd className="mt-0.5 break-words font-semibold" translate="no">
                            {entry.referenceId}
                          </dd>
                        </div>
                      ) : null}
                    </dl>
                  </details>
                </li>
              );
            })}
          </ul>
        )}

        {totalPages > 1 ? (
          <nav className="mt-6 flex items-center justify-between gap-3 border-t border-border pt-5" aria-label={tn("transactions")}>
            <Link
              href={page > 1 ? `/member/transactions?page=${page - 1}` : `/member/transactions?page=1`}
              className={cnPagination(page <= 1)}
              aria-disabled={page <= 1}
            >
              {tc("previous")}
            </Link>
            <span className="text-xs text-muted-foreground">{tm("pageLabel", { page, totalPages })}</span>
            <Link
              href={page < totalPages ? `/member/transactions?page=${page + 1}` : `/member/transactions?page=${totalPages}`}
              className={cnPagination(page >= totalPages)}
              aria-disabled={page >= totalPages}
            >
              {tc("next")}
            </Link>
          </nav>
        ) : null}
      </section>
    </div>
  );
}

function cnPagination(disabled: boolean) {
  return [
    "rounded-xl border border-border px-4 py-2 text-sm font-semibold transition-colors",
    disabled
      ? "pointer-events-none opacity-40"
      : "hover:border-primary/40 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
  ].join(" ");
}
