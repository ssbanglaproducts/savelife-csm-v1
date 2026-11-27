import { getLocale, getTranslations } from "next-intl/server";
import {
  ArrowUpRight,
  Banknote,
  Building2,
  CreditCard,
  Landmark,
  PlusCircle,
  ScrollText,
  ShoppingBag,
  Wallet,
} from "lucide-react";
import { getAdminAccess, hasAdminPermission } from "@/lib/admin-access";
import { Link, redirect } from "@/i18n/navigation";
import { AdminSignupChart } from "@/components/admin/admin-signup-chart";
import { AdminPageIntro, AdminSection } from "@/components/admin/admin-ui";
import { StatCard } from "@/components/ui/stat-card";
import { formatSP } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import { loadAdminDashboardStats } from "@/lib/services/admin-dashboard-stats";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const [session, locale, tn, ta] = await Promise.all([
    getAdminAccess(),
    getLocale(),
    getTranslations("nav"),
    getTranslations("adminPanel"),
  ]);
  if (!session || !hasAdminPermission(session, "dashboard.view")) redirect({ href: "/admin-login", locale });

  const stats = await loadAdminDashboardStats(prisma);

  const queues = [
    {
      href: "/admin/investments?proof=pending",
      label: ta("pendingInvestments"),
      count: stats.pendingInvestments,
      icon: <ShoppingBag className="size-4" />,
    },
    {
      href: "/admin/withdrawals",
      label: ta("pendingWithdrawals"),
      count: stats.pendingWithdrawals,
      icon: <Banknote className="size-4" />,
    },
    {
      href: "/admin/top-ups",
      label: ta("topUpsTitle"),
      count: stats.pendingTopUps,
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

      <AdminSection id="member-growth" title={ta("memberGrowth")}>
        <AdminSignupChart
          totalMembers={stats.totalMembers}
          signups={stats.signups}
          locale={locale}
        />
      </AdminSection>

      <AdminSection id="overview" title={ta("overview")}>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <StatCard
            label={ta("totalTopUpAmount")}
            value={formatSP(stats.totalTopUpPaisa)}
            icon={<Wallet className="size-4" />}
          />
          <StatCard
            label={ta("totalInvested")}
            value={formatSP(stats.totalInvestedPaisa)}
            hint={`${ta("lastMonth")}: ${formatSP(stats.lastMonthInvestedPaisa)}`}
            icon={<ShoppingBag className="size-4" />}
          />
          <StatCard
            label={ta("totalWithdrawn")}
            value={formatSP(stats.totalWithdrawnPaisa)}
            icon={<CreditCard className="size-4" />}
          />
          <StatCard
            label={ta("activeInvestments")}
            value={stats.activeInvestments}
            icon={<Landmark className="size-4" />}
          />
          <StatCard
            label={ta("rankSalaryTreasury")}
            value={formatSP(stats.salaryTreasuryPaisa)}
            hint={ta("rankSalaryTreasuryHint")}
            icon={<Building2 className="size-4" />}
          />
        </div>
      </AdminSection>
    </div>
  );
}
