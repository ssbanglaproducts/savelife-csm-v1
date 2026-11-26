import { getTranslations, setRequestLocale } from "next-intl/server";
import {
  ArrowUpRight,
  Banknote,
  CalendarDays,
  Gift,
  LockKeyhole,
  Plus,
  ScrollText,
  Send,
  ShoppingBag,
  TrendingUp,
  Trophy,
  Users,
  Wallet as WalletIcon,
} from "lucide-react";
import { auth } from "@/auth";
import { PageHeader } from "@/components/member/page-header";
import { WalletCollectAllButton } from "@/components/member/wallet-collect-all-button";
import { Link, redirect } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { formatSP } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import { REWARD_WALLETS } from "@/lib/wallet-config";

export const dynamic = "force-dynamic";

const rewardIcons = {
  gift: Gift,
  users: Users,
  trophy: Trophy,
  calendar: CalendarDays,
  trending: TrendingUp,
} as const;

const rewardToneClasses = {
  gold: {
    ring: "ring-amber-400/20",
    icon: "bg-amber-400/15 text-amber-600 dark:text-amber-300",
  },
  violet: {
    ring: "ring-violet-400/20",
    icon: "bg-violet-400/15 text-violet-600 dark:text-violet-300",
  },
  emerald: {
    ring: "ring-emerald-400/20",
    icon: "bg-emerald-400/15 text-emerald-600 dark:text-emerald-300",
  },
  sky: {
    ring: "ring-sky-400/20",
    icon: "bg-sky-400/15 text-sky-600 dark:text-sky-300",
  },
  rose: {
    ring: "ring-rose-400/20",
    icon: "bg-rose-400/15 text-rose-600 dark:text-rose-300",
  },
} as const;

export default async function WalletPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const [session, tm, tn] = await Promise.all([
    auth(),
    getTranslations("memberPanel"),
    getTranslations("nav"),
  ]);
  if (!session?.user?.id) {
    redirect({ href: "/login", locale });
    return null;
  }

  const wallet = await prisma.wallet.findUnique({
    where: { memberId: session.user.id },
    select: {
      availablePaisa: true,
      investmentPaisa: true,
      profitPaisa: true,
      affiliatePaisa: true,
      rankRewardPaisa: true,
      salaryPaisa: true,
      roiPaisa: true,
    },
  });

  const availablePaisa = wallet?.availablePaisa ?? 0n;
  const investmentPaisa = wallet?.investmentPaisa ?? 0n;
  const rewardBalances = {
    profitPaisa: wallet?.profitPaisa ?? 0n,
    affiliatePaisa: wallet?.affiliatePaisa ?? 0n,
    rankRewardPaisa: wallet?.rankRewardPaisa ?? 0n,
    salaryPaisa: wallet?.salaryPaisa ?? 0n,
    roiPaisa: wallet?.roiPaisa ?? 0n,
  };
  const collectibleCount = REWARD_WALLETS.filter(
    (walletDefinition) => rewardBalances[walletDefinition.field] > 0n,
  ).length;

  const actions = [
    {
      href: "/member/send-money",
      label: tm("walletActionSend"),
      hint: tm("walletActionSendHint"),
      icon: Send,
    },
    {
      href: "/products",
      label: tm("walletActionShop"),
      hint: tm("walletActionShopHint"),
      icon: ShoppingBag,
    },
    {
      href: "/member/withdrawals",
      label: tn("withdrawals"),
      hint: tm("walletActionWithdrawHint"),
      icon: Banknote,
    },
    {
      href: "/member/transactions",
      label: tn("transactions"),
      hint: tm("walletActionTransactionsHint"),
      icon: ScrollText,
    },
  ] as const;

  return (
    <div className="space-y-8 animate-rise">
      <PageHeader
        eyebrow={tn("wallet")}
        title={tm("walletTitle")}
        intro={tm("walletIntro")}
        icon={<WalletIcon className="size-3.5" aria-hidden="true" />}
      />

      <section aria-labelledby="available-balance-heading">
        <div className="mesh glass relative overflow-hidden rounded-3xl border-primary/20 p-6 sm:p-8">
          <div
            className="pointer-events-none absolute -right-20 -top-28 size-72 rounded-full bg-primary/15 blur-3xl"
            aria-hidden="true"
          />
          <div className="relative flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-primary">
                {tm("available")}
              </p>
              <p
                id="available-balance-heading"
                className="mt-3 font-display text-4xl font-bold tracking-tight tabular-nums sm:text-5xl"
              >
                {formatSP(availablePaisa)}
              </p>
              <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">
                {tm("walletAvailableHint")}
              </p>
              <Link
                href="/member/top-up"
                className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline focus-visible:rounded focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Plus className="size-3.5" aria-hidden="true" />
                {tm("addMoney")}
              </Link>
            </div>
            <div className="flex shrink-0 flex-col items-start gap-2 sm:items-end">
              <WalletCollectAllButton />
              <p className="text-xs text-muted-foreground">
                {collectibleCount > 0
                  ? tm("walletCollectibleReady")
                  : tm("walletCollectibleEmpty")}
              </p>
            </div>
          </div>
        </div>
      </section>

      <section aria-labelledby="reward-wallets-heading">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="reward-wallets-heading" className="font-display text-xl font-bold tracking-tight">
              {tm("walletRewardsTitle")}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">{tm("walletRewardsIntro")}</p>
          </div>
          <p className="text-xs text-muted-foreground">{tm("walletRewardsHint")}</p>
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {REWARD_WALLETS.map((walletDefinition) => {
            const Icon = rewardIcons[walletDefinition.icon];
            return (
              <article
                key={walletDefinition.field}
                className={cn(
                  "glass glass-hover min-w-0 rounded-2xl p-5 ring-1",
                  rewardToneClasses[walletDefinition.tone].ring,
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-muted-foreground">
                      {tm(walletDefinition.labelKey)}
                    </p>
                    <p className="mt-3 truncate font-display text-2xl font-bold tabular-nums">
                      {formatSP(rewardBalances[walletDefinition.field])}
                    </p>
                  </div>
                  <span
                    className={cn(
                      "flex size-10 shrink-0 items-center justify-center rounded-xl",
                      rewardToneClasses[walletDefinition.tone].icon,
                    )}
                    aria-hidden="true"
                  >
                    <Icon className="size-5" />
                  </span>
                </div>
                <p className="mt-4 text-xs text-muted-foreground">{tm("walletRewardCardHint")}</p>
              </article>
            );
          })}
        </div>
      </section>

      <section aria-labelledby="invested-capital-heading">
        <h2 id="invested-capital-heading" className="sr-only">
          {tm("investment")}
        </h2>
        <Link
          href="/member/investments"
          className="group block rounded-3xl border border-dashed border-primary/30 bg-primary/[0.04] p-6 transition-colors hover:border-primary/50 hover:bg-primary/[0.07] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:p-7"
        >
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-start gap-4">
              <span
                className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-primary/15 text-primary ring-1 ring-primary/20"
                aria-hidden="true"
              >
                <LockKeyhole className="size-6" />
              </span>
              <div className="min-w-0">
                <p className="flex items-center gap-2 text-sm font-bold text-primary">
                  <LockKeyhole className="size-3.5" aria-hidden="true" />
                  {tm("walletInvestedBadge")}
                </p>
                <p className="mt-1 font-display text-2xl font-bold tabular-nums sm:text-3xl">
                  {formatSP(investmentPaisa)}
                </p>
                <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                  {tm("walletInvestedHint")}
                </p>
              </div>
            </div>
            <span className="inline-flex shrink-0 items-center gap-1.5 text-sm font-bold text-primary">
              {tm("walletViewInvestments")}
              <ArrowUpRight
                className="size-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                aria-hidden="true"
              />
            </span>
          </div>
        </Link>
      </section>

      <section aria-labelledby="wallet-actions-heading">
        <h2 id="wallet-actions-heading" className="font-display text-xl font-bold tracking-tight">
          {tm("walletActionsTitle")}
        </h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {actions.map((action) => {
            const Icon = action.icon;
            return (
              <Link
                key={action.href}
                href={action.href}
                className="glass glass-hover group flex min-h-28 items-center gap-4 rounded-2xl p-5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span
                  className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary ring-1 ring-primary/20"
                  aria-hidden="true"
                >
                  <Icon className="size-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-display font-bold">{action.label}</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">{action.hint}</span>
                </span>
                <ArrowUpRight
                  className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                  aria-hidden="true"
                />
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}
