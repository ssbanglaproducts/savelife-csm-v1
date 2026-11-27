import { getLocale, getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { redirect } from "@/i18n/navigation";
import { AdminAccent } from "@/components/admin/admin-accent";
import { PanelShell } from "@/components/layout/panel-shell";
import type { PanelLink } from "@/components/layout/panel-nav-types";
import { getAdminAccess, hasAdminPermission } from "@/lib/admin-access";
import type { AdminPermission } from "@/lib/admin-permissions";
import { prisma } from "@/lib/prisma";

type GuardedLink = PanelLink & { permission: AdminPermission };

export default async function AdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  const [access, tn, ta, locale] = await Promise.all([
    getAdminAccess(),
    getTranslations("nav"),
    getTranslations("adminPanel"),
    getLocale(),
  ]);

  // The proxy also guards this area; this is defence in depth. Permissions are
  // read from the database on every request, never from the JWT.
  if (!access) {
    redirect({ href: "/admin-login", locale });
    return null;
  }
  const can = (permission: AdminPermission) => hasAdminPermission(access, permission);

  const [adminMember, pendingPayments, pendingWithdrawals, pendingTopUps] = await Promise.all([
    prisma.member.findUnique({
      where: { id: access.id },
      select: { fullName: true, profileImage: true },
    }),
    can("investments.view")
      ? prisma.paymentProof.count({
          where: { status: "PENDING", member: { role: "MEMBER" } },
        })
      : Promise.resolve(0),
    can("withdrawals.view")
      ? prisma.withdrawal.count({
          where: { status: "PENDING", member: { role: "MEMBER" } },
        })
      : Promise.resolve(0),
    can("topUps.view")
      ? prisma.walletTopUp.count({
          where: { status: "PENDING", member: { role: "MEMBER" } },
        })
      : Promise.resolve(0),
  ]);

  const guardedLinks: GuardedLink[] = [
    {
      href: "/admin/dashboard",
      label: ta("dashboardTitle"),
      group: ta("navGroupOverview"),
      permission: "dashboard.view",
    },
    {
      href: "/admin/members",
      label: ta("membersTitle"),
      group: ta("navGroupOperations"),
      permission: "members.view",
    },
    {
      href: "/admin/orders",
      label: ta("ordersTitle"),
      group: ta("navGroupOperations"),
      permission: "orders.view",
    },
    {
      href: "/admin/products",
      label: ta("productsTitle"),
      group: ta("navGroupOperations"),
      permission: "products.view",
    },
    {
      href: "/admin/categories",
      label: ta("categoriesTitle"),
      group: ta("navGroupOperations"),
      permission: "categories.view",
    },
    {
      href: "/admin/investments",
      label: ta("investmentsTitle"),
      group: ta("navGroupRewards"),
      permission: "investments.view",
      badge:
        pendingPayments > 0
          ? { count: pendingPayments, label: ta("badgePendingPayments"), tone: "warning" }
          : undefined,
    },
    {
      href: "/admin/distributions",
      label: ta("distributionsTitle"),
      group: ta("navGroupRewards"),
      permission: "distributions.view",
    },
    {
      href: "/admin/affiliate-commissions",
      label: ta("affiliateCommissionsTitle"),
      group: ta("navGroupRewards"),
      permission: "affiliateCommissions.view",
    },
    {
      href: "/admin/roi-commission",
      label: ta("roiCommissionTitle"),
      group: ta("navGroupRewards"),
      permission: "roiCommission.view",
    },
    {
      href: "/admin/ranks",
      label: ta("rankConfigurationTitle"),
      group: ta("navGroupRewards"),
      permission: "ranks.view",
    },
    {
      href: "/admin/salary",
      label: ta("salaryOverviewTitle"),
      group: ta("navGroupRewards"),
      permission: "salary.view",
    },
    {
      href: "/admin/withdrawals",
      label: ta("withdrawalsTitle"),
      group: ta("navGroupMoney"),
      permission: "withdrawals.view",
      badge:
        pendingWithdrawals > 0
          ? { count: pendingWithdrawals, label: ta("badgePendingWithdrawals"), tone: "warning" }
          : undefined,
    },
    {
      href: "/admin/top-ups",
      label: ta("topUpsTitle"),
      group: ta("navGroupMoney"),
      permission: "topUps.view",
      badge:
        pendingTopUps > 0
          ? { count: pendingTopUps, label: ta("badgePendingTopUps"), tone: "warning" }
          : undefined,
    },
    {
      href: "/admin/settings",
      label: ta("settingsHubTitle"),
      group: ta("navGroupContent"),
      permission: "settings.view",
    },
    {
      href: "/admin/gallery",
      label: tn("gallery"),
      group: ta("navGroupContent"),
      permission: "content.view",
    },
    {
      href: "/admin/announcements",
      label: tn("announcements"),
      group: ta("navGroupContent"),
      permission: "content.view",
    },
    {
      href: "/admin/audit",
      label: ta("auditTitle"),
      group: ta("navGroupSystem"),
      permission: "audit.view",
    },
    {
      href: "/admin/staff",
      label: ta("staffTitle"),
      group: ta("navGroupSystem"),
      permission: "staff.view",
    },
  ];

  const links: PanelLink[] = guardedLinks
    .filter((link) => can(link.permission))
    .map((link) => ({
      href: link.href,
      label: link.label,
      group: link.group,
      badge: link.badge,
    }));
  const availableHrefs = new Set(links.map((link) => link.href));
  const primaryHrefs = [
    "/admin/dashboard",
    "/admin/members",
    "/admin/investments",
    "/admin/staff",
  ].filter((href) => availableHrefs.has(href));

  return (
    <>
      <AdminAccent />
      <PanelShell
        title={tn("admin")}
        links={links}
        primaryHrefs={primaryHrefs}
        hideMobilePreferences
        avatar={{
          name: adminMember?.fullName ?? access.name,
          image: adminMember?.profileImage ?? null,
          memberId: access.memberId,
          role: access.role,
          status: "ACTIVE",
        }}
      >
        {children}
      </PanelShell>
    </>
  );
}
