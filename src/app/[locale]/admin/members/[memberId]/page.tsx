import type { ReactNode } from "react";
import { getLocale, getTranslations } from "next-intl/server";
import { ArrowLeft, Users } from "lucide-react";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import {
  AdminPageIntro,
  AdminSection,
  AdminTable,
  EmptyState,
  StatusBadge,
  adminStatusKey,
  formatDate,
  memberStatusKey,
  statusTone,
} from "@/components/admin/admin-ui";
import { MemberDetailActions, MemberAvatar } from "@/components/admin/member-actions";
import { PlacementMoveForm } from "@/components/admin/placement-move-form";
import type { InvestmentLedgerEntry } from "@/components/admin/investment-cards";
import { LedgerActivityList } from "@/components/admin/ledger-list";
import { buttonVariants } from "@/components/ui/button";
import { CopyableMemberId } from "@/components/ui/copyable-member-id";
import { StatCard } from "@/components/ui/stat-card";
import { Link, redirect } from "@/i18n/navigation";
import { formatSP, formatTaka } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import {
  buildMemberLevelStats,
  type RewardStatRow,
  type UplineStatRow,
} from "@/lib/services/member-stats";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AdminMemberDetailPage({
  params,
}: {
  params: Promise<{ memberId: string }>;
}) {
  const [session, locale, tn, ta, tc, tm] = await Promise.all([
    auth(),
    getLocale(),
    getTranslations("nav"),
    getTranslations("adminPanel"),
    getTranslations("common"),
    getTranslations("memberPanel"),
  ]);
  if (session?.user?.role !== "ADMIN") redirect({ href: "/login", locale });

  const { memberId } = await params;
  const member = await prisma.member.findUnique({
    where: { memberId },
    include: {
      wallet: true,
      sponsor: { select: { id: true, memberId: true, fullName: true } },
      placementParent: { select: { id: true, memberId: true, fullName: true } },
      uplines: {
        orderBy: { level: "asc" },
        include: { upline: { select: { id: true, memberId: true, fullName: true } } },
      },
      addresses: { orderBy: { isDefault: "desc" }, take: 1 },
      orders: {
        orderBy: { placedAt: "desc" },
        take: 5,
        select: { id: true, orderNumber: true, status: true, totalPaisa: true, placedAt: true },
      },
      investments: {
        orderBy: { createdAt: "desc" },
        take: 5,
        select: {
          id: true,
          investmentNumber: true,
          type: true,
          status: true,
          amountPaisa: true,
          createdAt: true,
        },
      },
      withdrawals: {
        orderBy: { requestedAt: "desc" },
        take: 5,
        select: {
          id: true,
          requestNumber: true,
          status: true,
          amountPaisa: true,
          requestedAt: true,
        },
      },
      ledgerEntries: {
        orderBy: { createdAt: "desc" },
        take: 10,
        include: { installment: { select: { periodNo: true } } },
      },
      auditLogs: {
        orderBy: { createdAt: "desc" },
        take: 10,
        select: {
          id: true,
          action: true,
          entityType: true,
          entityId: true,
          createdAt: true,
          actor: { select: { fullName: true, memberId: true } },
        },
      },
    },
  });
  if (!member) notFound();

  const [uplineRows, rewardRows] = await Promise.all([
    prisma.upline.findMany({
      where: { uplineId: member.id, level: { in: [1, 2, 3] } },
      select: {
        level: true,
        member: { select: { investments: { select: { amountPaisa: true } } } },
      },
    }),
    prisma.affiliateReward.groupBy({
      by: ["beneficiaryId", "level"],
      where: { beneficiaryId: member.id, level: { in: [1, 2, 3] } },
      _sum: { amountPaisa: true },
    }),
  ]);

  const uplines: UplineStatRow[] = uplineRows.map((row) => ({
    uplineId: member.id,
    level: row.level,
    investedPaisa: row.member.investments.reduce(
      (total, investment) => total + investment.amountPaisa,
      0n,
    ),
  }));
  const rewards: RewardStatRow[] = rewardRows.map((row) => ({
    beneficiaryId: row.beneficiaryId,
    level: row.level,
    amountPaisa: row._sum.amountPaisa ?? 0n,
  }));
  const { levels, teamSize } = buildMemberLevelStats(member.id, uplines, rewards);
  const address = member.addresses[0];

  function recordStatus(status: string): string {
    return status === "ACTIVE" ? tm("active") : ta(adminStatusKey(status));
  }

  function ledgerType(type: string): string {
    switch (type) {
      case "INVESTMENT_PRINCIPAL":
        return tm("investmentPrincipal");
      case "INSTALLMENT_PAYMENT":
        return tm("installmentPayment");
      case "PROFIT_DISTRIBUTION":
        return tm("profitDistribution");
      case "AFFILIATE_REWARD":
        return tm("affiliateReward");
      case "PRINCIPAL_RETURN":
        return tm("principalReturn");
      case "BALANCE_TRANSFER":
        return tm("balanceTransfer");
      case "WITHDRAWAL":
        return tm("withdrawalPayout");
      case "WITHDRAWAL_FEE":
        return tm("withdrawalFee");
      case "ADMIN_ADJUSTMENT":
        return tm("adminAdjustment");
      case "ROI_COMMISSION_CREDIT":
        return tm("roiCommissionCredit");
      case "ORDER_REFUND":
        return tm("orderRefund");
      default:
        return type;
    }
  }

  const ledgerEntries: InvestmentLedgerEntry[] = member.ledgerEntries.map((entry) => ({
    id: entry.id,
    date: formatDate(entry.createdAt, locale),
    typeLabel: ledgerType(entry.type),
    direction: tm(entry.direction === "CREDIT" ? "directionIn" : "directionOut"),
    directionType: entry.direction === "CREDIT" ? "CREDIT" : "DEBIT",
    amount: formatSP(entry.amountPaisa),
    balanceAfter: formatSP(entry.balanceAfterPaisa),
    description: entry.description || "—",
    reference:
      [entry.referenceType, entry.referenceId].filter(Boolean).join(": ") ||
      (entry.installment ? `Installment #${entry.installment.periodNo}` : "—"),
  }));

  return (
    <div className="space-y-8 animate-rise">
      <AdminPageIntro
        eyebrow={tn("admin")}
        title={member.fullName}
        intro={`${member.memberId} · ${tm(memberStatusKey(member.status))}`}
        icon={<Users className="size-3.5" aria-hidden="true" />}
      />

      <Link
        href="/admin/members"
        className={cn(buttonVariants({ variant: "outline" }), "w-fit")}
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        {ta("backToMembers")}
      </Link>

      <AdminSection id="member-actions" title={ta("actions")}>
        <div className="glass rounded-2xl p-5 sm:p-6">
          <MemberDetailActions
            member={{
              id: member.id,
              memberId: member.memberId,
              name: member.fullName,
              status: member.status,
            }}
          />
        </div>
      </AdminSection>

      <AdminSection id="member-profile" title={ta("profile")}>
        <div className="glass space-y-6 rounded-2xl p-5 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <MemberAvatar name={member.fullName} src={member.profileImage} size="lg" />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="truncate font-display text-2xl font-bold">{member.fullName}</h2>
                <StatusBadge
                  tone={statusTone(member.status)}
                  label={tm(memberStatusKey(member.status))}
                />
              </div>
              <div className="mt-1.5">
                <CopyableMemberId memberId={member.memberId} compact />
              </div>
            </div>
          </div>

          <div className="grid gap-x-8 gap-y-5 sm:grid-cols-2 xl:grid-cols-4">
            <DetailField label={ta("email")}>
              <a href={`mailto:${member.email}`} className="break-all hover:text-primary">
                {member.email}
              </a>
            </DetailField>
            <DetailField label={ta("phone")}>
              <a href={`tel:${member.phone}`} className="hover:text-primary">
                {member.phone}
              </a>
            </DetailField>
            <DetailField label={ta("joined")} value={formatDate(member.createdAt, locale)} />
            <DetailField
              label={ta("activatedAt")}
              value={member.activationDate ? formatDate(member.activationDate, locale) : "—"}
            />
            <DetailField
              label={ta("role")}
              value={member.role === "ADMIN" ? ta("roleAdmin") : ta("roleMember")}
            />
            <DetailField
              label={ta("sponsor")}
              value={
                member.sponsor
                  ? `${member.sponsor.fullName} (${member.sponsor.memberId})`
                  : "—"
              }
            />
            <DetailField
              label={ta("address")}
              value={
                address
                  ? [address.fullName, address.street, address.city, address.district, address.postalCode]
                      .filter(Boolean)
                      .join(", ")
                  : "—"
              }
            />
          </div>

          {member.status === "SUSPENDED" && member.deactivationNote ? (
            <p className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm">
              <span className="font-semibold">{ta("note")}: </span>
              {member.deactivationNote}
            </p>
          ) : null}
        </div>
      </AdminSection>

      <AdminSection id="member-wallet" title={ta("walletBalances")}>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
          <StatCard label={ta("available")} value={formatSP(member.wallet?.availablePaisa ?? 0n)} />
          <StatCard label={ta("pending")} value={formatSP(member.wallet?.pendingPaisa ?? 0n)} />
          <StatCard label={ta("investment")} value={formatSP(member.wallet?.investmentPaisa ?? 0n)} />
          <StatCard label={ta("profit")} value={formatSP(member.wallet?.profitPaisa ?? 0n)} />
          <StatCard label={ta("affiliate")} value={formatSP(member.wallet?.affiliatePaisa ?? 0n)} />
          <StatCard label={ta("roiCommission")} value={formatSP(member.wallet?.roiPaisa ?? 0n)} />
        </div>
      </AdminSection>

      <AdminSection id="member-placement" title={ta("placementParent")}>
        <div className="glass rounded-2xl p-5 sm:p-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <DetailField
              label={ta("placementParent")}
              value={
                member.placementParent
                  ? `${member.placementParent.fullName} (${member.placementParent.memberId})`
                  : "—"
              }
            />
            <DetailField
              label={ta("placementSlot")}
              value={member.placementSlot ? `${tm("slot")} ${member.placementSlot}` : "—"}
            />
          </div>
          <PlacementMoveForm
            memberId={member.id}
            currentParentId={member.placementParent?.memberId ?? null}
            currentSlot={member.placementSlot}
          />
        </div>
      </AdminSection>

      <AdminSection id="member-team" title={ta("downlineDetails")}>
        <div className="glass rounded-2xl p-5 sm:p-6">
          <div className="grid gap-4 xl:grid-cols-4">
            <StatCard label={ta("teamSize")} value={teamSize} />
            {levels.map((level) => (
              <StatCard
                key={level.level}
                label={ta(`level${level.level}`)}
                value={level.count}
                hint={`${ta("earned")} ${formatSP(level.rewardPaisa)} · ${ta("invested")} ${formatSP(
                  level.investedPaisa,
                )}`}
              />
            ))}
          </div>

          <h3 className="mt-7 font-display text-base font-bold">{ta("uplineChain")}</h3>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {[1, 2, 3].map((level) => {
              const upline = member.uplines.find((row) => row.level === level);
              return (
                <div key={level} className="rounded-xl border border-border p-4">
                  <p className="text-xs text-muted-foreground">{ta(`level${level}`)}</p>
                  {upline ? (
                    <Link
                      href={`/admin/members/${upline.upline.memberId}`}
                      className="mt-1 block break-words text-sm font-semibold hover:text-primary focus-visible:rounded focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {upline.upline.fullName}
                      <span className="mt-1 block font-mono text-[11px] text-muted-foreground">
                        {upline.upline.memberId}
                      </span>
                    </Link>
                  ) : (
                    <p className="mt-1 text-sm text-muted-foreground">—</p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </AdminSection>

      <AdminSection id="member-investments" title={ta("recentInvestments")}>
        {member.investments.length === 0 ? (
          <EmptyState message={ta("noInvestments")} />
        ) : (
          <AdminTable
            caption={ta("recentInvestments")}
            headers={[
              ta("investmentNumber"),
              ta("investmentType"),
              tc("status"),
              ta("amountSP"),
              ta("applied"),
            ]}
          >
            {member.investments.map((investment) => (
              <tr key={investment.id} className="align-top">
                <td className="whitespace-nowrap px-4 py-3 font-mono text-xs">
                  <Link
                    href={`/admin/investments/${investment.id}`}
                    className="font-semibold text-primary hover:underline focus-visible:rounded focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {investment.investmentNumber}
                  </Link>
                </td>
                <td className="px-4 py-3 text-xs">
                  {tm(investment.type === "INSTALLMENT" ? "installment" : "profitOnly")}
                </td>
                <td className="px-4 py-3">
                  <StatusBadge
                    tone={statusTone(investment.status)}
                    label={recordStatus(investment.status)}
                  />
                </td>
                <td className="whitespace-nowrap px-4 py-3 font-semibold tabular-nums">
                  {formatSP(investment.amountPaisa)}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground">
                  {formatDate(investment.createdAt, locale)}
                </td>
              </tr>
            ))}
          </AdminTable>
        )}
      </AdminSection>

      <AdminSection id="member-orders" title={ta("recentOrders")}>
        {member.orders.length === 0 ? (
          <EmptyState message={ta("noOrders")} />
        ) : (
          <AdminTable
            caption={ta("recentOrders")}
            headers={[ta("orderNumber"), tc("status"), ta("amountSP"), ta("placedAt")]}
          >
            {member.orders.map((order) => (
              <tr key={order.id} className="align-top">
                <td className="whitespace-nowrap px-4 py-3 font-mono text-xs">
                  <Link
                    href={`/orders/${order.orderNumber}`}
                    className="font-semibold text-primary hover:underline focus-visible:rounded focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {order.orderNumber}
                  </Link>
                </td>
                <td className="px-4 py-3">
                  <StatusBadge
                    tone={statusTone(order.status)}
                    label={recordStatus(order.status)}
                  />
                </td>
                <td className="whitespace-nowrap px-4 py-3 font-semibold tabular-nums">
                  {formatTaka(order.totalPaisa, locale)}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground">
                  {formatDate(order.placedAt, locale)}
                </td>
              </tr>
            ))}
          </AdminTable>
        )}
      </AdminSection>

      <AdminSection id="member-withdrawals" title={ta("recentWithdrawals")}>
        {member.withdrawals.length === 0 ? (
          <EmptyState message={ta("noWithdrawals")} />
        ) : (
          <AdminTable
            caption={ta("recentWithdrawals")}
            headers={[ta("requestNumber"), tc("status"), ta("amountSP"), ta("requestedAt")]}
          >
            {member.withdrawals.map((withdrawal) => (
              <tr key={withdrawal.id} className="align-top">
                <td className="whitespace-nowrap px-4 py-3 font-mono text-xs">
                  {withdrawal.requestNumber}
                </td>
                <td className="px-4 py-3">
                  <StatusBadge
                    tone={statusTone(withdrawal.status)}
                    label={recordStatus(withdrawal.status)}
                  />
                </td>
                <td className="whitespace-nowrap px-4 py-3 font-semibold tabular-nums">
                  {formatSP(withdrawal.amountPaisa)}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground">
                  {formatDate(withdrawal.requestedAt, locale)}
                </td>
              </tr>
            ))}
          </AdminTable>
        )}
      </AdminSection>

      <AdminSection id="member-ledger" title={ta("ledgerActivity")}>
        <LedgerActivityList entries={ledgerEntries} />
      </AdminSection>

      <AdminSection id="member-audit" title={ta("auditTrail")}>
        {member.auditLogs.length === 0 ? (
          <EmptyState message={ta("noActivity")} />
        ) : (
          <ul className="glass divide-y divide-border rounded-2xl">
            {member.auditLogs.map((log) => (
              <li key={log.id} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="text-sm font-semibold">{log.action}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {log.entityType}
                    {log.entityId ? ` · ${log.entityId}` : ""}
                    {log.actor ? ` · ${log.actor.fullName} (${log.actor.memberId})` : " · System"}
                  </p>
                </div>
                <p className="shrink-0 text-xs text-muted-foreground">
                  {formatDate(log.createdAt, locale)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </AdminSection>
    </div>
  );
}

function DetailField({
  label,
  value,
  children,
}: {
  label: string;
  value?: string;
  children?: ReactNode;
}) {
  return (
    <div className="min-w-0">
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="mt-1 break-words text-sm font-semibold">{children ?? value ?? "—"}</div>
    </div>
  );
}
