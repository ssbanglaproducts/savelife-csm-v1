import { getLocale, getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { auth } from "@/auth";
import { redirect } from "@/i18n/navigation";
import { PanelShell } from "@/components/layout/panel-shell";
import type { PanelLink } from "@/components/layout/panel-nav-types";
import { AccountLockedScreen } from "@/components/member/account-locked-screen";
import { InactiveAccessGate } from "@/components/member/inactive-access-gate";
import { INACTIVE_LOCKED_NAV_HREFS } from "@/lib/member-panel-access";
import { prisma } from "@/lib/prisma";

export default async function MemberLayout({
  children,
}: {
  children: ReactNode;
}) {
  const [session, t, tm, locale] = await Promise.all([
    auth(),
    getTranslations("nav"),
    getTranslations("memberPanel"),
    getLocale(),
  ]);

  // The proxy also guards this area; this is defence in depth.
  if (!session?.user?.id) {
    redirect({ href: "/login", locale });
    return null;
  }

  // Read the live status from the DB: the JWT status claim is a snapshot taken
  // at sign-in, so an admin deactivation must take effect immediately.
  const [
    member,
    unreadNotifications,
    pendingInvestments,
    pendingOrders,
    pendingWithdrawals,
    pendingTopUps,
  ] = await Promise.all([
    prisma.member.findUnique({
      where: { id: session.user.id },
      select: {
        status: true,
        deactivationNote: true,
        fullName: true,
        profileImage: true,
        wallet: { select: { availablePaisa: true } },
      },
    }),
    prisma.notification.count({
      where: {
        OR: [{ memberId: session.user.id }, { memberId: null }],
        reads: { none: { memberId: session.user.id } },
      },
    }),
    prisma.investment.count({
      where: { memberId: session.user.id, status: "PENDING" },
    }),
    prisma.order.count({
      where: { memberId: session.user.id, status: "PENDING" },
    }),
    prisma.withdrawal.count({
      where: { memberId: session.user.id, status: "PENDING" },
    }),
    prisma.walletTopUp.count({
      where: { memberId: session.user.id, status: "PENDING" },
    }),
  ]);
  if (member?.status === "SUSPENDED") {
    return <AccountLockedScreen note={member.deactivationNote} />;
  }

  const inactive = member?.status === "INACTIVE";
  const links: PanelLink[] = [
    {
      href: "/member/dashboard",
      label: t("dashboard"),
      group: t("groupOverview"),
      badge:
        unreadNotifications > 0
          ? {
              count: unreadNotifications,
              label: tm("badgeUnread", { count: unreadNotifications }),
            }
          : undefined,
    },
    { href: "/member/profile", label: t("profile"), group: t("groupOverview") },
    {
      href: "/member/team",
      label: t("team"),
      group: t("groupNetwork"),
      locked: inactive && INACTIVE_LOCKED_NAV_HREFS.includes("/member/team"),
    },
    {
      href: "/member/rank-rewards",
      label: t("rankRewards"),
      group: t("groupNetwork"),
      locked: inactive && INACTIVE_LOCKED_NAV_HREFS.includes("/member/rank-rewards"),
    },
    {
      href: "/member/salary",
      label: t("salary"),
      group: t("groupWallet"),
      locked: inactive && INACTIVE_LOCKED_NAV_HREFS.includes("/member/salary"),
    },
    { href: "/member/wallet", label: t("wallet"), group: t("groupWallet") },
    {
      href: "/member/top-up",
      label: t("topUp"),
      group: t("groupWallet"),
      badge:
        pendingTopUps > 0
          ? {
              count: pendingTopUps,
              label: tm("badgePendingTopUps", { count: pendingTopUps }),
              tone: "warning",
            }
          : undefined,
    },
    {
      href: "/member/send-money",
      label: t("sendMoney"),
      group: t("groupWallet"),
      locked: inactive && INACTIVE_LOCKED_NAV_HREFS.includes("/member/send-money"),
    },
    { href: "/member/transactions", label: t("transactions"), group: t("groupWallet") },
    {
      href: "/member/withdrawals",
      label: t("withdrawals"),
      group: t("groupWallet"),
      locked: inactive && INACTIVE_LOCKED_NAV_HREFS.includes("/member/withdrawals"),
      badge:
        pendingWithdrawals > 0
          ? {
              count: pendingWithdrawals,
              label: tm("badgePendingWithdrawals", { count: pendingWithdrawals }),
              tone: "warning",
            }
          : undefined,
    },
    {
      href: "/member/orders",
      label: t("orders"),
      group: t("groupActivity"),
      locked: inactive && INACTIVE_LOCKED_NAV_HREFS.includes("/member/orders"),
      badge:
        pendingOrders > 0
          ? {
              count: pendingOrders,
              label: tm("badgePendingOrders", { count: pendingOrders }),
              tone: "warning",
            }
          : undefined,
    },
    {
      href: "/member/investments",
      label: t("investments"),
      group: t("groupActivity"),
      locked: inactive && INACTIVE_LOCKED_NAV_HREFS.includes("/member/investments"),
      badge:
        pendingInvestments > 0
          ? {
              count: pendingInvestments,
              label: tm("badgePendingInvestments", { count: pendingInvestments }),
              tone: "warning",
            }
          : undefined,
    },
    { href: "/member/program", label: t("program"), group: t("groupProgram") },
    { href: "/member/company-info", label: t("companyInfo"), group: t("groupProgram") },
  ];

  return (
    <PanelShell
      links={links}
      primaryHrefs={[
        "/member/dashboard",
        "/member/wallet",
        "/member/team",
        "/member/profile",
      ]}
      avatar={{
        name: member?.fullName ?? session.user.name ?? "Member",
        image: member?.profileImage ?? null,
        memberId: session.user.memberId,
        role: session.user.role,
        status: member?.status ?? session.user.status,
      }}
    >
      <InactiveAccessGate
        status={member?.status ?? "INACTIVE"}
        note={member?.deactivationNote}
        availablePaisa={member?.wallet?.availablePaisa.toString() ?? "0"}
      >
        {children}
      </InactiveAccessGate>
    </PanelShell>
  );
}
