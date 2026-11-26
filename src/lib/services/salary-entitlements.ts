import { randomUUID } from "node:crypto";
import type { Prisma } from "../../generated/prisma/client";
import {
  DEFAULT_SALARY_PLAN,
  enabledSalaryRankKeys,
  isSalaryRankKey,
  type SalaryPlan,
} from "../salary";

type HighestAchievement = {
  rankKey: string;
  rankSortOrder: number;
  achievedAt: Date;
};

/**
 * The salary entitlement always follows the highest achieved rank that is
 * payable in the active salary plan. Rank keys with a 0% allocation or a 0
 * weekly cap are excluded even when they have achievements.
 */
export async function findHighestSalaryAchievement(
  client: Prisma.TransactionClient,
  memberId: string,
  plan: SalaryPlan = DEFAULT_SALARY_PLAN,
): Promise<HighestAchievement | null> {
  const payableKeys = enabledSalaryRankKeys(plan);
  if (payableKeys.length === 0) return null;

  return client.rankAchievement.findFirst({
    where: { memberId, rankKey: { in: [...payableKeys] } },
    orderBy: [{ rankSortOrder: "desc" }, { achievedAt: "desc" }, { id: "desc" }],
    select: { rankKey: true, rankSortOrder: true, achievedAt: true },
  });
}

/**
 * Keeps one salary entitlement row per member. Achievements are awarded for
 * every qualifying rank, but salary follows only the current plan's highest
 * payable rank. A promotion replaces the previous rank and restarts weeks.
 */
export async function syncSalaryEntitlement(
  client: Prisma.TransactionClient,
  input: {
    memberId: string;
    rankKey: string;
    rankSortOrder: number;
    achievedAt: Date;
    reason?: string;
  },
  plan: SalaryPlan = DEFAULT_SALARY_PLAN,
): Promise<boolean> {
  const target = await findHighestSalaryAchievement(client, input.memberId, plan);
  const current = await client.salaryEntitlement.findUnique({
    where: { memberId: input.memberId },
    select: {
      id: true,
      rankKey: true,
      rankSortOrder: true,
      isActive: true,
    },
  });

  if (!target || !isSalaryRankKey(target.rankKey)) {
    if (!current?.isActive) return false;

    const reason = input.reason ?? "DISABLED";
    await client.salaryEntitlementChange.create({
      data: {
        id: `salary-entitlement-change:${current.id}:disabled:${reason}:${randomUUID()}`,
        memberId: input.memberId,
        previousRankKey: current.rankKey,
        previousRankSortOrder: current.rankSortOrder,
        rankKey: current.rankKey,
        rankSortOrder: current.rankSortOrder,
        reason,
        changedAt: new Date(),
      },
    });
    await client.salaryEntitlement.update({
      where: { id: current.id },
      data: { isActive: false },
    });
    return true;
  }

  if (
    current &&
    current.isActive &&
    current.rankKey === target.rankKey &&
    current.rankSortOrder === target.rankSortOrder
  ) {
    return false;
  }

  if (current) {
    await client.salaryEntitlementChange.create({
      data: {
        id: `salary-entitlement-change:${current.id}:${target.rankKey}:${target.achievedAt.toISOString()}:${randomUUID()}`,
        memberId: input.memberId,
        previousRankKey: current.rankKey,
        previousRankSortOrder: current.rankSortOrder,
        rankKey: target.rankKey,
        rankSortOrder: target.rankSortOrder,
        reason: input.reason ?? "PROMOTION",
        changedAt: target.achievedAt,
      },
    });
    await client.salaryEntitlement.update({
      where: { id: current.id },
      data: {
        rankKey: target.rankKey,
        rankSortOrder: target.rankSortOrder,
        achievedAt: target.achievedAt,
        weeksPaid: 0,
        isActive: true,
      },
    });
    return true;
  }

  const created = await client.salaryEntitlement.upsert({
    where: { memberId: input.memberId },
    create: {
      id: `salary-entitlement:${input.memberId}`,
      memberId: input.memberId,
      rankKey: target.rankKey,
      rankSortOrder: target.rankSortOrder,
      achievedAt: target.achievedAt,
      weeksPaid: 0,
      isActive: true,
    },
    update: {},
  });

  if (created.id === `salary-entitlement:${input.memberId}`) {
    await client.salaryEntitlementChange.create({
      data: {
        id: `salary-entitlement-change:${created.id}:${randomUUID()}`,
        memberId: input.memberId,
        previousRankKey: null,
        previousRankSortOrder: null,
        rankKey: target.rankKey,
        rankSortOrder: target.rankSortOrder,
        reason: input.reason ?? "ACHIEVEMENT",
        changedAt: target.achievedAt,
      },
    });
  }

  return created.id === `salary-entitlement:${input.memberId}`;
}
