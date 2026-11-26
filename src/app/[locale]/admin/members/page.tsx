import { getLocale, getTranslations } from "next-intl/server";
import { Users } from "lucide-react";
import { auth } from "@/auth";
import { redirect } from "@/i18n/navigation";
import { AdminPageIntro, AdminSection, formatDate } from "@/components/admin/admin-ui";
import { MemberTable, type MemberRow } from "@/components/admin/member-table";
import { formatSP } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import {
  buildMemberLevelStats,
  type RewardStatRow,
  type UplineStatRow,
} from "@/lib/services/member-stats";

export const dynamic = "force-dynamic";

export default async function AdminMembersPage() {
  const [session, locale, tn, ta] = await Promise.all([
    auth(),
    getLocale(),
    getTranslations("nav"),
    getTranslations("adminPanel"),
  ]);
  if (session?.user?.role !== "ADMIN") redirect({ href: "/login", locale });

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
  const [uplineRows, rewardRows] = await Promise.all([
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
  ]);

  const uplines: UplineStatRow[] = uplineRows.map((row) => ({
    uplineId: row.uplineId,
    level: row.level,
    investedPaisa: row.member.investments.reduce((total, investment) => total + investment.amountPaisa, 0n),
  }));
  const rewards: RewardStatRow[] = rewardRows.map((row) => ({
    beneficiaryId: row.beneficiaryId,
    level: row.level,
    amountPaisa: row._sum.amountPaisa ?? 0n,
  }));

  const rows: MemberRow[] = members.map((member) => {
    const { levels, teamSize } = buildMemberLevelStats(member.id, uplines, rewards);
    return {
      id: member.id,
      memberId: member.memberId,
      name: member.fullName,
      email: member.email,
      phone: member.phone,
      profileImage: member.profileImage,
      status: member.status,
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
