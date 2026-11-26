import { getLocale, getTranslations } from "next-intl/server";
import {
  CreditCard,
  Landmark,
  ReceiptText,
  ScrollText,
  ShoppingBag,
  Users,
  Wallet,
} from "lucide-react";
import { auth } from "@/auth";
import { Link, redirect } from "@/i18n/navigation";
import { buttonVariants } from "@/components/ui/button";
import { StatCard } from "@/components/ui/stat-card";
import { AdminSection } from "@/components/admin/admin-ui";
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
  if (session?.user?.role !== "ADMIN") redirect({ href: "/login", locale });

  const [
    members,
    pendingWithdrawals,
    activeInvestments,
    distributions,
    investedAggregate,
    withdrawnAggregate,
  ] = await Promise.all([
    prisma.member.count(),
    prisma.withdrawal.count({ where: { status: "PENDING" } }),
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

  return (
    <div className="space-y-8 animate-rise">
      <section className="mesh glass relative overflow-hidden rounded-3xl p-6 sm:p-8">
        <div className="relative min-w-0">
          <div className="flex items-center gap-2 text-xs font-bold tracking-[0.12em] text-primary">
            <ScrollText className="size-3.5" aria-hidden="true" />
            {tn("admin")}
          </div>
          <h1 className="mt-3 font-display text-balance text-3xl font-bold leading-tight tracking-tight sm:text-4xl">
            {tn("dashboard")}
          </h1>
          <p className="mt-3 max-w-lg text-sm leading-relaxed text-muted-foreground">
            {ta("auditIntro")}
          </p>
        </div>
      </section>

      <AdminSection id="overview" title={ta("overview")}>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <StatCard label={ta("membersCount")} value={members} icon={<Users className="size-4" />} />
          <StatCard
            label={ta("totalInvested")}
            value={formatSP(totalInvestedPaisa)}
            icon={<ShoppingBag className="size-4" />}
          />
          <Link
            href="/admin/investments?proof=pending"
            className="block rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label={ta("pendingProofFilter")}
          >
            <StatCard
              label={ta("totalWithdrawn")}
              value={formatSP(totalWithdrawnPaisa)}
              icon={<CreditCard className="size-4" />}
            />
          </Link>
          <StatCard
            label={ta("pendingWithdrawals")}
            value={pendingWithdrawals}
            icon={<Wallet className="size-4" />}
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
        </div>
      </AdminSection>

      <section className="glass rounded-2xl p-5 sm:p-6" aria-labelledby="risk-audit-heading">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <ScrollText className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
            <div className="min-w-0">
              <h2 id="risk-audit-heading" className="font-display text-base font-bold">
                Risk & audit
              </h2>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{ta("auditIntro")}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/admin/audit" className={buttonVariants({ variant: "outline", size: "sm" })}>
              {ta("auditTitle")}
            </Link>
            <Link href="/member/company-info" className={buttonVariants({ variant: "ghost", size: "sm" })}>
              {tn("program")}
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
