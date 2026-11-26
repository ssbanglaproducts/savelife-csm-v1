import { getLocale, getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { auth } from "@/auth";
import { redirect } from "@/i18n/navigation";
import { PanelShell } from "@/components/layout/panel-shell";
import type { PanelLink } from "@/components/layout/panel-nav-types";
import { prisma } from "@/lib/prisma";

export default async function AdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  const [session, tn, ta, locale] = await Promise.all([
    auth(),
    getTranslations("nav"),
    getTranslations("adminPanel"),
    getLocale(),
  ]);

  // The proxy also guards this area; this is defence in depth.
  const adminId = session?.user?.id;
  if (!adminId || session?.user?.role !== "ADMIN") redirect({ href: "/login", locale });

  const [adminMember, pendingPayments, pendingWithdrawals, pendingTopUps] = await Promise.all([
    prisma.member.findUnique({
      where: { id: adminId },
      select: { fullName: true, profileImage: true },
    }),
    prisma.paymentProof.count({ where: { status: "PENDING" } }),
    prisma.withdrawal.count({ where: { status: "PENDING" } }),
    prisma.walletTopUp.count({ where: { status: "PENDING" } }),
  ]);

  const links: PanelLink[] = [
    { href: "/admin/dashboard", label: ta("dashboardTitle") },
    { href: "/admin/members", label: ta("membersTitle") },
    { href: "/admin/orders", label: ta("ordersTitle") },
    { href: "/admin/products", label: ta("productsTitle") },
    { href: "/admin/categories", label: ta("categoriesTitle") },
    {
      href: "/admin/investments",
      label: ta("investmentsTitle"),
      badge:
        pendingPayments > 0
          ? { count: pendingPayments, label: ta("badgePendingPayments"), tone: "warning" }
          : undefined,
    },
    { href: "/admin/distributions", label: ta("distributionsTitle") },
    { href: "/admin/roi-commission", label: ta("roiCommissionTitle") },
    { href: "/admin/ranks", label: ta("rankConfigurationTitle") },
    { href: "/admin/salary", label: ta("salaryOverviewTitle") },
    {
      href: "/admin/withdrawals",
      label: ta("withdrawalsTitle"),
      badge:
        pendingWithdrawals > 0
          ? { count: pendingWithdrawals, label: ta("badgePendingWithdrawals"), tone: "warning" }
          : undefined,
    },
    {
      href: "/admin/top-ups",
      label: ta("topUpsTitle"),
      badge:
        pendingTopUps > 0
          ? { count: pendingTopUps, label: ta("badgePendingTopUps"), tone: "warning" }
          : undefined,
    },
    { href: "/admin/settings", label: ta("settingsHubTitle") },
    { href: "/admin/gallery", label: tn("gallery") },
    { href: "/admin/announcements", label: tn("announcements") },
    { href: "/admin/audit", label: ta("auditTitle") },
  ];

  return (
    <PanelShell
      title={tn("admin")}
      links={links}
      primaryHrefs={[
        "/admin/dashboard",
        "/admin/members",
        "/admin/orders",
        "/admin/top-ups",
      ]}
      avatar={{
        name: adminMember?.fullName ?? session?.user?.name ?? "Admin",
        image: adminMember?.profileImage ?? null,
        memberId: session?.user?.memberId ?? "SL000000",
        role: "ADMIN",
        status: session?.user?.status ?? "ACTIVE",
      }}
    >
      {children}
    </PanelShell>
  );
}
