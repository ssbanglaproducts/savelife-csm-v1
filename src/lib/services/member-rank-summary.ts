import { Prisma, type PrismaClient } from "@/generated/prisma/client";
import { resolveRankBadgeImageUrl } from "../rank-art";

type Client = PrismaClient | Prisma.TransactionClient;

/** Highest achieved rank for a member, snapshotted exactly as earned. */
export type MemberRankSummary = {
  rankKey: string;
  name: string;
  nameBn: string | null;
  badgeImageUrl: string;
  achievedAt: string;
};

/** Loads the highest rank for many members with one query. */
export async function getMemberRankSummaries(
  client: Client,
  memberIds: readonly string[],
): Promise<Map<string, MemberRankSummary>> {
  const ids = [...new Set(memberIds)];
  if (ids.length === 0) return new Map();

  const rows = await client.rankAchievement.findMany({
    where: { memberId: { in: ids } },
    orderBy: [{ rankSortOrder: "desc" }, { achievedAt: "desc" }],
    select: {
      memberId: true,
      rankKey: true,
      rankNameSnapshot: true,
      rankNameBnSnapshot: true,
      badgeImageUrl: true,
      achievedAt: true,
    },
  });

  const byMember = new Map<string, MemberRankSummary>();
  for (const row of rows) {
    if (byMember.has(row.memberId)) continue;
    byMember.set(row.memberId, {
      rankKey: row.rankKey,
      name: row.rankNameSnapshot,
      nameBn: row.rankNameBnSnapshot,
      badgeImageUrl: resolveRankBadgeImageUrl(row.badgeImageUrl, row.rankKey),
      achievedAt: row.achievedAt.toISOString(),
    });
  }
  return byMember;
}

export async function attachMemberRanks<T extends { id: string }>(
  client: Client,
  people: readonly T[],
): Promise<Array<T & { rank: MemberRankSummary | null }>> {
  const ranks = await getMemberRankSummaries(
    client,
    people.map((person) => person.id),
  );
  return people.map((person) => ({ ...person, rank: ranks.get(person.id) ?? null }));
}
