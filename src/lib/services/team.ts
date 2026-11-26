import { Prisma, type PrismaClient } from "@/generated/prisma/client";
import { getNetworkDetails } from "./network";
import { isInPlacementSubtree } from "./placement";
import type { Paisa } from "../money";

type Client = PrismaClient | Prisma.TransactionClient;

/** Capital that has actually been placed, not applications or rejected plans. */
export const TEAM_INVESTMENT_STATUSES = ["ACTIVE", "MATURED", "CLOSED"] as const;

export type TeamPerson = {
  id: string;
  memberId: string;
  fullName: string;
  profileImage: string | null;
  status: string;
};

export type TeamStats = {
  totalMembers: number;
  activeMembers: number;
  inactiveMembers: number;
  newMembersThisMonth: number;
  totalInvestmentPaisa: Paisa;
  totalReturnsPaisa: Paisa;
  totalAffiliateRewardsPaisa: Paisa;
};

export type TeamMonth = {
  month: string;
  newMembers: number;
  cumulativeMembers: number;
  investmentPaisa: Paisa;
  cumulativeInvestmentPaisa: Paisa;
  returnsPaisa: Paisa;
  affiliateRewardsPaisa: Paisa;
};

export type TeamDay = {
  day: number;
  joins: number;
};

export type TeamDirectoryRow = TeamPerson & {
  slot: number | null;
  teamMembers: number;
  teamInvestmentPaisa: Paisa;
  directPlacements: number;
  occupiedSlots: number;
  availableSlots: number;
};

export type TeamMemberDetails = NonNullable<Awaited<ReturnType<typeof getNetworkDetails>>> & {
  profileImage: string | null;
  teamMembers: number;
  activeTeamMembers: number;
  teamInvestmentPaisa: Paisa;
  teamReturnsPaisa: Paisa;
  teamAffiliateRewardsPaisa: Paisa;
};

export type TeamOverview = {
  scope: TeamPerson;
  breadcrumbs: TeamPerson[];
  stats: TeamStats;
  series: TeamMonth[];
  dailyMembers: TeamDay[];
  directory: TeamDirectoryRow[];
};

const personSelect = {
  id: true,
  memberId: true,
  fullName: true,
  profileImage: true,
  status: true,
} as const;

function monthKey(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function recentMonthKeys(now: Date, count = 12): string[] {
  const keys: string[] = [];
  for (let index = count - 1; index >= 0; index -= 1) {
    const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - index, 1));
    keys.push(monthKey(date));
  }
  return keys;
}

function sum(values: readonly Paisa[]): Paisa {
  return values.reduce((total, value) => total + value, 0n);
}

/** Daily join counts for the current UTC month, matching monthKey() above. */
export function buildDailyMemberSeries(
  data: TeamSourceData,
  now: Date,
): TeamDay[] {
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const buckets = Array.from({ length: daysInMonth }, (_, index) => ({
    day: index + 1,
    joins: 0,
  }));

  for (const member of data.members) {
    if (member.createdAt.getUTCFullYear() !== year) continue;
    if (member.createdAt.getUTCMonth() !== month) continue;
    const day = member.createdAt.getUTCDate();
    if (buckets[day - 1]) buckets[day - 1]!.joins += 1;
  }

  return buckets;
}

/** Breadcrumb path from the viewer down to root, or [] when root is outside the viewer. */
export async function getPlacementPath(
  client: Client,
  rootId: string,
  viewerId: string,
): Promise<TeamPerson[]> {
  const rows = await client.$queryRaw<
    Array<TeamPerson & { depth: number }>
  >`
    WITH RECURSIVE path("id", "parentId", "depth") AS (
      SELECT "id", "placementParentId", 0
      FROM "Member"
      WHERE "id" = ${rootId}
      UNION
      SELECT m."id", m."placementParentId", p."depth" + 1
      FROM "Member" m
      INNER JOIN path p ON m."id" = p."parentId"
    )
    SELECT m."id", m."memberId", m."fullName", m."profileImage", m."status", p."depth"
    FROM path p
    INNER JOIN "Member" m ON m."id" = p."id"
    WHERE EXISTS (SELECT 1 FROM path p2 WHERE p2."id" = ${viewerId})
    ORDER BY p."depth" DESC
  `;

  return rows.map(({ id, memberId, fullName, profileImage, status }) => ({
    id,
    memberId,
    fullName,
    profileImage,
    status,
  }));
}

/** All placement descendants of root, excluding root itself. */
export async function getPlacementDescendantIds(client: Client, rootId: string): Promise<string[]> {
  const rows = await client.$queryRaw<Array<{ id: string }>>`
    WITH RECURSIVE tree("id", "depth") AS (
      SELECT "id", 0
      FROM "Member"
      WHERE "id" = ${rootId}
      UNION
      SELECT m."id", t."depth" + 1
      FROM "Member" m
      INNER JOIN tree t ON m."placementParentId" = t."id"
    )
    SELECT "id" FROM tree WHERE "depth" > 0
  `;
  return rows.map((row) => row.id);
}

export type TeamSourceData = {
  members: Array<{ id: string; status: string; createdAt: Date }>;
  investments: Array<{ amountPaisa: Paisa; createdAt: Date }>;
  returns: Array<{ allocatedPaisa: Paisa; occurredAt: Date }>;
  rewards: Array<{ amountPaisa: Paisa; createdAt: Date }>;
};

async function getTeamSourceData(client: Client, rootId: string): Promise<TeamSourceData> {
  const ids = await getPlacementDescendantIds(client, rootId);
  if (ids.length === 0) {
    return { members: [], investments: [], returns: [], rewards: [] };
  }

  const [members, investments, returns, rewards] = await Promise.all([
    client.member.findMany({
      where: { id: { in: ids } },
      select: { id: true, status: true, createdAt: true },
    }),
    client.investment.findMany({
      where: {
        memberId: { in: ids },
        status: { in: [...TEAM_INVESTMENT_STATUSES] },
      },
      select: { amountPaisa: true, createdAt: true },
    }),
    client.profitDistributionLine.findMany({
      where: { memberId: { in: ids }, distribution: { status: "POSTED" } },
      select: {
        allocatedPaisa: true,
        distribution: { select: { postedAt: true, createdAt: true } },
      },
    }),
    client.affiliateReward.findMany({
      where: { beneficiaryId: { in: ids } },
      select: { amountPaisa: true, createdAt: true },
    }),
  ]);

  return {
    members,
    investments,
    returns: returns.map((line) => ({
      allocatedPaisa: line.allocatedPaisa,
      occurredAt: line.distribution.postedAt ?? line.distribution.createdAt ?? new Date(0),
    })),
    rewards,
  };
}

export function buildMonthlySeries(data: TeamSourceData, now: Date): TeamMonth[] {
  const keys = recentMonthKeys(now);
  const firstKey = keys[0]!;
  const buckets = new Map(
    keys.map((month) => [
      month,
      {
        month,
        newMembers: 0,
        investmentPaisa: 0n,
        returnsPaisa: 0n,
        affiliateRewardsPaisa: 0n,
      },
    ]),
  );

  let memberBaseline = 0;
  let investmentBaseline = 0n;

  function add<T>(
    date: Date,
    amount: T,
    field: "newMembers" | "investmentPaisa" | "returnsPaisa" | "affiliateRewardsPaisa",
  ): void {
    const key = monthKey(date);
    if (key < firstKey) {
      if (field === "newMembers") memberBaseline += Number(amount);
      if (field === "investmentPaisa") investmentBaseline += amount as Paisa;
      return;
    }
    const bucket = buckets.get(key);
    if (!bucket) return;
    if (field === "newMembers") bucket.newMembers += Number(amount);
    else bucket[field] += amount as Paisa;
  }

  for (const member of data.members) add(member.createdAt, 1, "newMembers");
  for (const investment of data.investments) {
    add(investment.createdAt, investment.amountPaisa, "investmentPaisa");
  }
  for (const line of data.returns) add(line.occurredAt, line.allocatedPaisa, "returnsPaisa");
  for (const reward of data.rewards) add(reward.createdAt, reward.amountPaisa, "affiliateRewardsPaisa");

  let cumulativeMembers = memberBaseline;
  let cumulativeInvestment = investmentBaseline;

  return keys.map((month) => {
    const bucket = buckets.get(month)!;
    cumulativeMembers += bucket.newMembers;
    cumulativeInvestment += bucket.investmentPaisa;
    return {
      month,
      newMembers: bucket.newMembers,
      cumulativeMembers,
      investmentPaisa: bucket.investmentPaisa,
      cumulativeInvestmentPaisa: cumulativeInvestment,
      returnsPaisa: bucket.returnsPaisa,
      affiliateRewardsPaisa: bucket.affiliateRewardsPaisa,
    };
  });
}

function summarizeTeam(
  data: TeamSourceData,
  now: Date,
): { stats: TeamStats; series: TeamMonth[]; dailyMembers: TeamDay[] } {
  const currentMonth = monthKey(now);
  const active = data.members.filter((member) => member.status === "ACTIVE").length;

  return {
    stats: {
      totalMembers: data.members.length,
      activeMembers: active,
      inactiveMembers: data.members.length - active,
      newMembersThisMonth: data.members.filter((member) => monthKey(member.createdAt) === currentMonth)
        .length,
      totalInvestmentPaisa: sum(data.investments.map((item) => item.amountPaisa)),
      totalReturnsPaisa: sum(data.returns.map((item) => item.allocatedPaisa)),
      totalAffiliateRewardsPaisa: sum(data.rewards.map((item) => item.amountPaisa)),
    },
    series: buildMonthlySeries(data, now),
    dailyMembers: buildDailyMemberSeries(data, now),
  };
}

export async function getTeamOverview(
  client: Client,
  viewerId: string,
  options: { rootMemberId?: string | null; now?: Date } = {},
): Promise<TeamOverview | null> {
  const now = options.now ?? new Date();
  const viewer = await client.member.findUnique({ where: { id: viewerId }, select: personSelect });
  if (!viewer) return null;

  let scope = viewer;
  let breadcrumbs: TeamPerson[] = [viewer];
  const requested = options.rootMemberId?.trim();
  if (requested && requested !== viewer.memberId) {
    const candidate = await client.member.findUnique({
      where: { memberId: requested },
      select: personSelect,
    });
    if (!candidate) return null;
    const path = await getPlacementPath(client, candidate.id, viewer.id);
    if (path.length === 0) return null;
    scope = candidate;
    breadcrumbs = path;
  }

  const source = await getTeamSourceData(client, scope.id);
  const { stats, series, dailyMembers } = summarizeTeam(source, now);

  const children = await client.member.findMany({
    where: { placementParentId: scope.id },
    orderBy: [{ placementSlot: "asc" }, { createdAt: "asc" }],
    select: {
      ...personSelect,
      placementSlot: true,
      _count: { select: { placementChildren: true } },
    },
  });

  const directory: TeamDirectoryRow[] = [];
  for (const child of children) {
    const childSource = await getTeamSourceData(client, child.id);
    const childStats = summarizeTeam(childSource, now).stats;
    const occupied = Math.min(3, child._count.placementChildren);
    directory.push({
      id: child.id,
      memberId: child.memberId,
      fullName: child.fullName,
      profileImage: child.profileImage,
      status: child.status,
      slot: child.placementSlot,
      teamMembers: childStats.totalMembers,
      teamInvestmentPaisa: childStats.totalInvestmentPaisa,
      directPlacements: child._count.placementChildren,
      occupiedSlots: occupied,
      availableSlots: 3 - occupied,
    });
  }

  return { scope, breadcrumbs, stats, series, dailyMembers, directory };
}

export async function getTeamMemberDetails(
  client: Client,
  viewerId: string,
  memberPublicId: string,
  now: Date = new Date(),
): Promise<TeamMemberDetails | null> {
  const member = await client.member.findUnique({
    where: { memberId: memberPublicId },
    select: personSelect,
  });
  if (!member) return null;
  if (!(await isInPlacementSubtree(client, viewerId, member.id))) return null;

  const [base, source] = await Promise.all([
    getNetworkDetails(client, member.id),
    getTeamSourceData(client, member.id),
  ]);
  if (!base) return null;
  const { stats } = summarizeTeam(source, now);

  return {
    ...base,
    profileImage: member.profileImage,
    teamMembers: stats.totalMembers,
    activeTeamMembers: stats.activeMembers,
    teamInvestmentPaisa: stats.totalInvestmentPaisa,
    teamReturnsPaisa: stats.totalReturnsPaisa,
    teamAffiliateRewardsPaisa: stats.totalAffiliateRewardsPaisa,
  };
}

type SerializedMonth = Omit<
  TeamMonth,
  "investmentPaisa" | "cumulativeInvestmentPaisa" | "returnsPaisa" | "affiliateRewardsPaisa"
> & {
  investmentPaisa: string;
  cumulativeInvestmentPaisa: string;
  returnsPaisa: string;
  affiliateRewardsPaisa: string;
};

export type TeamOverviewDto = {
  scope: TeamPerson;
  breadcrumbs: TeamPerson[];
  stats: Omit<TeamStats, "totalInvestmentPaisa" | "totalReturnsPaisa" | "totalAffiliateRewardsPaisa"> & {
    totalInvestmentPaisa: string;
    totalReturnsPaisa: string;
    totalAffiliateRewardsPaisa: string;
  };
  series: SerializedMonth[];
  directory: Array<
    Omit<TeamDirectoryRow, "teamInvestmentPaisa"> & { teamInvestmentPaisa: string }
  >;
  details: (Omit<TeamMemberDetails, "teamInvestmentPaisa" | "teamReturnsPaisa" | "teamAffiliateRewardsPaisa"> & {
    teamInvestmentPaisa: string;
    teamReturnsPaisa: string;
    teamAffiliateRewardsPaisa: string;
  }) | null;
};

export function serializeTeamOverview(
  overview: TeamOverview,
  details: TeamMemberDetails | null = null,
): TeamOverviewDto {
  const serializeMoney = (value: Paisa): string => value.toString();

  return {
    scope: overview.scope,
    breadcrumbs: overview.breadcrumbs,
    stats: {
      ...overview.stats,
      totalInvestmentPaisa: serializeMoney(overview.stats.totalInvestmentPaisa),
      totalReturnsPaisa: serializeMoney(overview.stats.totalReturnsPaisa),
      totalAffiliateRewardsPaisa: serializeMoney(overview.stats.totalAffiliateRewardsPaisa),
    },
    series: overview.series.map((month) => ({
      ...month,
      investmentPaisa: serializeMoney(month.investmentPaisa),
      cumulativeInvestmentPaisa: serializeMoney(month.cumulativeInvestmentPaisa),
      returnsPaisa: serializeMoney(month.returnsPaisa),
      affiliateRewardsPaisa: serializeMoney(month.affiliateRewardsPaisa),
    })),
    directory: overview.directory.map((row) => ({
      ...row,
      teamInvestmentPaisa: serializeMoney(row.teamInvestmentPaisa),
    })),
    details: details
      ? {
          ...details,
          teamInvestmentPaisa: serializeMoney(details.teamInvestmentPaisa),
          teamReturnsPaisa: serializeMoney(details.teamReturnsPaisa),
          teamAffiliateRewardsPaisa: serializeMoney(details.teamAffiliateRewardsPaisa),
        }
      : null,
  };
}
