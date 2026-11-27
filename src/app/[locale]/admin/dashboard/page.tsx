import { getLocale, getTranslations } from "next-intl/server";
import {
  ArrowUpRight,
  Banknote,
  CreditCard,
  Landmark,
  PlusCircle,
  ReceiptText,
  ScrollText,
  ShoppingBag,
  Users,
} from "lucide-react";
import { auth } from "@/auth";
import { Link, redirect } from "@/i18n/navigation";
import { AdminPageIntro, AdminSection } from "@/components/admin/admin-ui";
import { StatCard } from "@/components/ui/stat-card";
import { formatSP } from "@/lib/money";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const [session, locale, tn, ta] = await Promise.all([
    auth(),
    getLocale(),
    getTranslations("nav"),
    getTranslations("adminPanel"),
  ]);
  if (session?.user?.role !== "ADMIN") redirect({ href: "/admin-login", locale });

  const [
    members,
    pendingProofs,
    pendingWithdrawals,
    pendingTopUps,
    activeInvestments,
    distributions,
    investedAggregate,
    withdrawnAggregate,
  ] = await Promise.all([
    prisma.member.count(),
    prisma.paymentProof.count({ where: { status: "PENDING" } }),
    prisma.withdrawal.count({ where: { status: "PENDING" } }),
    prisma.walletTopUp.count({ where: { status: "PENDING" } }),
    prisma.investment.count({ where: { status: "ACTIVE" } }),
    prisma.profitDistribution.count(),
    prisma.investment.aggregate({
      where: { status: "ACTIVE" },
      _sum: { amountPaisa: true },
    }),
    prisma.withdrawal.aggregate({
      where: { status: "PAID" },
      _sum: { netPaisa: true },
    }),
  ]);

  const totalInvestedPaisa = investedAggregate._sum.amountPaisa ?? 0n;
  const totalWithdrawnPaisa = withdrawnAggregate._sum.netPaisa ?? 0n;

  const queues = [
    {
      href: "/admin/investments?proof=pending",
      label: ta("pendingPayments"),
      count: pendingProofs,
      icon: <ShoppingBag className="size-4" />,
    },
    {
      href: "/admin/withdrawals",
      label: ta("pendingWithdrawals"),
      count: pendingWithdrawals,
      icon: <Banknote className="size-4" />,
    },
    {
      href: "/admin/top-ups",
      label: ta("topUpsTitle"),
      count: pendingTopUps,
      icon: <PlusCircle className="size-4" />,
    },
  ];

  return (
    <div className="space-y-6 animate-rise sm:space-y-8">
      <AdminPageIntro
        eyebrow={tn("admin")}
        title={tn("dashboard")}
        intro={ta("dashboardIntro")}
        icon={<ScrollText className="size-3.5" aria-hidden="true" />}
      />

      <AdminSection id="attention" title={ta("needsAttention")}>
        <div className="grid gap-3 sm:grid-cols-3">
          {queues.map((queue) => (
            <Link
              key={queue.href}
              href={queue.href}
              className="group min-w-0 rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <div className="glass glass-hover flex h-full min-w-0 items-center gap-3 rounded-2xl p-4 sm:p-5">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 text-amber-600 ring-1 ring-amber-500/25 dark:text-amber-300">
                  {queue.icon}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs text-muted-foreground">{queue.label}</p>
                  <p className="mt-0.5 font-display text-2xl font-bold tabular-nums">
                    {queue.count}
                  </p>
                </div>
                <ArrowUpRight
                  className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                  aria-hidden="true"
                />
              </div>
            </Link>
          ))}
        </div>
      </AdminSection>

      <AdminSection id="overview" title={ta("overview")}>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <StatCard
            label={ta("membersCount")}
            value={members}
            icon={<Users className="size-4" />}
          />
          <StatCard
            label={ta("totalInvested")}
            value={formatSP(totalInvestedPaisa)}
            icon={<ShoppingBag className="size-4" />}
          />
          <StatCard
            label={ta("totalWithdrawn")}
            value={formatSP(totalWithdrawnPaisa)}
            icon={<CreditCard className="size-4" />}
          />
          <StatCard
            label={ta("activeInvestments")}
            value={activeInvestments}
            icon={<Landmark className="size-4" />}
          />
          <StatCard
            label={ta("distributionsCount")}
            value={distributions}
            icon={<ReceiptText className="size-4" />}
          />
          <Link
            href="/admin/audit"
            className="block min-w-0 rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <StatCard
              label={ta("auditTitle")}
              value={ta("viewDetails")}
              icon={<ScrollText className="size-4" />}
            />
          </Link>
        </div>
      </AdminSection>
    </div>
  );
}
