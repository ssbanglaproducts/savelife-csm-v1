import { getLocale, getTranslations } from "next-intl/server";
import { Users } from "lucide-react";
import { LedgerEntryType, WalletCategory } from "@/generated/prisma/client";
import { auth } from "@/auth";
import { redirect } from "@/i18n/navigation";
import { AdminPageIntro, AdminSection, formatDate } from "@/components/admin/admin-ui";
import { MemberTable, type MemberRow } from "@/components/admin/member-table";
import { formatSP } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import { localizedRankName } from "@/lib/rank-label";
import { getMemberRankSummaries } from "@/lib/services/member-rank-summary";
import {
  buildMemberLevelStats,
  type RewardStatRow,
  type UplineStatRow,
} from "@/lib/services/member-stats";

export const dynamic = "force-dynamic";

const REWARD_CATEGORIES = [
  WalletCategory.PROFIT,
  WalletCategory.AFFILIATE,
  WalletCategory.RANK_REWARD,
  WalletCategory.SALARY,
  WalletCategory.ROI_COMMISSION,
];

const REWARD_CREDIT_TYPES = [
  LedgerEntryType.PROFIT_DISTRIBUTION,
  LedgerEntryType.AFFILIATE_REWARD,
  LedgerEntryType.RANK_REWARD_CREDIT,
  LedgerEntryType.SALARY_PAYMENT,
  LedgerEntryType.ROI_COMMISSION_CREDIT,
];

export default async function AdminMembersPage() {
  const [session, locale, tn, ta, tm] = await Promise.all([
    auth(),
    getLocale(),
    getTranslations("nav"),
    getTranslations("adminPanel"),
    getTranslations("memberPanel"),
  ]);
  if (session?.user?.role !== "ADMIN") redirect({ href: "/admin-login", locale });

  const members = await prisma.member.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      memberId: true,
      fullName: true,
      email: true,
      phone: true,
      profileImage: true,
      status: true,
      createdAt: true,
      deactivationNote: true,
    },
  });

  const memberIds = members.map((member) => member.id);
  const [uplineRows, rewardRows, rankSummaries, investedRows, earnedRows, walletRows] =
    await Promise.all([
      prisma.upline.findMany({
        where: { uplineId: { in: memberIds }, level: { in: [1, 2, 3] } },
        select: {
          uplineId: true,
          level: true,
          member: { select: { investments: { select: { amountPaisa: true } } } },
        },
      }),
      prisma.affiliateReward.groupBy({
        by: ["beneficiaryId", "level"],
        where: { beneficiaryId: { in: memberIds }, level: { in: [1, 2, 3] } },
        _sum: { amountPaisa: true },
      }),
      getMemberRankSummaries(prisma, memberIds),
      prisma.investment.groupBy({
        by: ["memberId"],
        where: { memberId: { in: memberIds } },
        _sum: { amountPaisa: true },
      }),
      prisma.ledgerEntry.groupBy({
        by: ["memberId"],
        where: {
          memberId: { in: memberIds },
          direction: "CREDIT",
          category: { in: REWARD_CATEGORIES },
          type: { in: REWARD_CREDIT_TYPES },
        },
        _sum: { amountPaisa: true },
      }),
      prisma.wallet.findMany({
        where: { memberId: { in: memberIds } },
        select: {
          memberId: true,
          availablePaisa: true,
          pendingPaisa: true,
          investmentPaisa: true,
          profitPaisa: true,
          affiliatePaisa: true,
          rankRewardPaisa: true,
          salaryPaisa: true,
          roiPaisa: true,
        },
      }),
    ]);

  const uplines: UplineStatRow[] = uplineRows.map((row) => ({
    uplineId: row.uplineId,
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
  const investedByMember = new Map(
    investedRows.map((row) => [row.memberId, row._sum.amountPaisa ?? 0n]),
  );
  const earnedByMember = new Map(
    earnedRows.map((row) => [row.memberId, row._sum.amountPaisa ?? 0n]),
  );
  const walletByMember = new Map(walletRows.map((wallet) => [wallet.memberId, wallet]));

  const rows: MemberRow[] = members.map((member) => {
    const { levels, teamSize } = buildMemberLevelStats(member.id, uplines, rewards);
    const rank = rankSummaries.get(member.id);
    const wallet = walletByMember.get(member.id);
    const walletTooltip = wallet
      ? [
          `${tm("availableBalance")}: ${formatSP(wallet.availablePaisa)}`,
          `${tm("pending")}: ${formatSP(wallet.pendingPaisa)}`,
          `${tm("investment")}: ${formatSP(wallet.investmentPaisa)}`,
          `${tm("profit")}: ${formatSP(wallet.profitPaisa)}`,
          `${tm("affiliate")}: ${formatSP(wallet.affiliatePaisa)}`,
          `${tm("rankReward")}: ${formatSP(wallet.rankRewardPaisa)}`,
          `${tm("salary")}: ${formatSP(wallet.salaryPaisa)}`,
          `${tm("roiCommission")}: ${formatSP(wallet.roiPaisa)}`,
        ].join("\n")
      : `${tm("availableBalance")}: 0 SP`;

    return {
      id: member.id,
      memberId: member.memberId,
      name: member.fullName,
      email: member.email,
      phone: member.phone,
      profileImage: member.profileImage,
      status: member.status,
      rank: rank ? localizedRankName(rank, locale) : tm("noRankYet"),
      rankKey: rank?.rankKey ?? null,
      rankName: rank ? localizedRankName(rank, locale) : tm("noRankYet"),
      rankBadge: rank?.badgeImageUrl ?? null,
      invested: formatSP(investedByMember.get(member.id) ?? 0n),
      earned: formatSP(earnedByMember.get(member.id) ?? 0n),
      walletBalance: formatSP(wallet?.availablePaisa ?? 0n),
      walletTooltip,
      joined: formatDate(member.createdAt, locale),
      note: member.deactivationNote,
      levels: levels.map((level) => ({
        level: level.level,
        count: level.count,
        earned: formatSP(level.rewardPaisa),
        invested: formatSP(level.investedPaisa),
      })) as MemberRow["levels"],
      teamSize,
    };
  });

  return (
    <div className="space-y-8 animate-rise">
      <AdminPageIntro
        eyebrow={tn("admin")}
        title={ta("membersTitle")}
        intro={ta("membersIntro")}
        icon={<Users className="size-3.5" aria-hidden="true" />}
      />
      <AdminSection id="members" title={ta("overview")}>
        <MemberTable rows={rows} />
      </AdminSection>
    </div>
  );
}
