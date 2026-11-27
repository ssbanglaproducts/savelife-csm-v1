import { getAdminAccess, hasAdminPermission } from "@/lib/admin-access";
import { getLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { prisma } from "@/lib/prisma";
import { resolveRankBadgeImageUrl } from "@/lib/rank-art";
import {
  SALARY_RANK_CONFIG,
  SALARY_RANK_KEYS,
  isSalaryRankEnabled,
  isSalaryRankKey,
  type SalaryRankKey,
} from "@/lib/salary";
import { ensureDefaultRankPlan } from "@/lib/services/rank-rewards";
import { getActiveSalaryPlan } from "@/lib/services/salary-plan";
import {
  RankMemberList,
  type RankMemberView,
  type RankOption,
} from "./rank-member-list";

type Achievement = {
  readonly id: string;
  readonly rankKey: string;
  readonly rankSortOrder: number;
  readonly achievedAt: Date;
};

function isHigher(candidate: Achievement, current: Achievement | null): boolean {
  if (!current) return true;
  if (candidate.rankSortOrder !== current.rankSortOrder) {
    return candidate.rankSortOrder > current.rankSortOrder;
  }
  if (candidate.achievedAt.getTime() !== current.achievedAt.getTime()) {
    return candidate.achievedAt.getTime() > current.achievedAt.getTime();
  }
  return candidate.id > current.id;
}

export async function RankMembersContent({ rankKey }: { rankKey?: SalaryRankKey } = {}) {
  const [session, locale] = await Promise.all([getAdminAccess(), getLocale()]);
  if (!session || !hasAdminPermission(session, "ranks.view")) redirect({ href: "/admin-login", locale });

  await ensureDefaultRankPlan(prisma);
  const salaryPlan = await getActiveSalaryPlan(prisma);
  const [members, definitions] = await Promise.all([
    prisma.member.findMany({
      where: { role: "MEMBER" },
      orderBy: { memberId: "asc" },
      select: {
        id: true,
        memberId: true,
        fullName: true,
        phone: true,
        profileImage: true,
        status: true,
        rankAchievements: {
          select: {
            id: true,
            rankKey: true,
            rankSortOrder: true,
            achievedAt: true,
          },
        },
        salaryEntitlement: {
          select: { isActive: true, rankKey: true, weeksPaid: true },
        },
      },
    }),
    prisma.rankDefinition.findMany({
      where: { planVersion: { isActive: true } },
      select: { rankKey: true, name: true, nameBn: true, badgeImageUrl: true },
    }),
  ]);

  const names = new Map<string, string>();
  const badges = new Map<string, string | null>();
  for (const definition of definitions) {
    names.set(
      definition.rankKey,
      locale === "bn" ? definition.nameBn ?? definition.name : definition.name,
    );
    badges.set(definition.rankKey, definition.badgeImageUrl);
  }

  const rows: readonly RankMemberView[] = members.map((member) => {
    let highest: Achievement | null = null;
    for (const achievement of member.rankAchievements) {
      if (isHigher(achievement, highest)) highest = achievement;
    }

    const rankKey = highest && isSalaryRankKey(highest.rankKey) ? highest.rankKey : null;
    const entitlement = member.salaryEntitlement;
    const rankEntitlement = entitlement?.rankKey === rankKey ? entitlement : null;

    return {
      id: member.id,
      memberDisplayId: member.memberId,
      memberName: member.fullName,
      phone: member.phone,
      profileImageUrl: member.profileImage,
      active: member.status === "ACTIVE",
      rankKey,
      salaryEligible: Boolean(
        rankKey &&
          rankEntitlement?.isActive &&
          isSalaryRankEnabled(salaryPlan.configs[rankKey]),
      ),
      weeksPaid: rankEntitlement?.weeksPaid ?? 0,
      achievedAt: highest ? highest.achievedAt.toISOString() : null,
    };
  });

  const ranks: readonly RankOption[] = SALARY_RANK_KEYS.map((rankKey) => {
    const fallback = SALARY_RANK_CONFIG[rankKey];
    const rankRows = rows.filter((row) => row.rankKey === rankKey);
    return {
      rankKey,
      name: names.get(rankKey) ?? (locale === "bn" ? fallback.defaultNameBn : fallback.defaultName),
      badgeUrl: resolveRankBadgeImageUrl(badges.get(rankKey) ?? null, rankKey),
      count: rankRows.length,
      activeCount: rankRows.filter((row) => row.active).length,
      inactiveCount: rankRows.filter((row) => !row.active).length,
    };
  });

  const maxWeeksByRank = Object.fromEntries(
    SALARY_RANK_KEYS.map((rankKey) => [rankKey, salaryPlan.configs[rankKey].maxWeeks]),
  ) as Record<SalaryRankKey, number | null>;

  return (
    <RankMemberList
      ranks={ranks}
      members={rows}
      maxWeeksByRank={maxWeeksByRank}
      fixedRank={rankKey ?? null}
    />
  );
}
