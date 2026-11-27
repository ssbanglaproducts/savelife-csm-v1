import { describe, expect, it } from "vitest";
import {
  buildDailyMemberSeries,
  buildMonthlySeries,
  getTeamMemberDetails,
  getTeamOverview,
  serializeTeamOverview,
  type TeamSourceData,
} from "./team";

type FakeMember = {
  id: string;
  memberId: string;
  fullName: string;
  profileImage: string | null;
  status: string;
  role?: string;
  placementParentId: string | null;
  placementSlot: number | null;
  sponsorId: string | null;
  createdAt: Date;
};

type FakeInvestment = {
  memberId: string;
  amountPaisa: bigint;
  status: string;
  createdAt: Date;
};

type FakeReturn = {
  memberId: string;
  allocatedPaisa: bigint;
  distribution: { status: string; postedAt: Date | null; createdAt: Date };
};

type FakeReward = {
  beneficiaryId: string;
  amountPaisa: bigint;
  createdAt: Date;
};

type FakeRankAchievement = {
  memberId: string;
  rankKey: string;
  rankNameSnapshot: string;
  rankNameBnSnapshot: string | null;
  rankSortOrder: number;
  badgeImageUrl: string;
  achievedAt: Date;
};

const now = new Date("2026-11-15T12:00:00.000Z");

const members: FakeMember[] = [
  {
    id: "v",
    memberId: "SL000001",
    fullName: "Viewer",
    profileImage: null,
    status: "ACTIVE",
    placementParentId: null,
    placementSlot: null,
    sponsorId: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
  },
  {
    id: "a",
    memberId: "SL000010",
    fullName: "Member A",
    profileImage: null,
    status: "ACTIVE",
    placementParentId: "v",
    placementSlot: 1,
    sponsorId: "v",
    createdAt: new Date("2026-02-01T00:00:00.000Z"),
  },
  {
    id: "b",
    memberId: "SL000011",
    fullName: "Member B",
    profileImage: null,
    status: "INACTIVE",
    placementParentId: "v",
    placementSlot: 2,
    sponsorId: "v",
    createdAt: new Date("2026-11-05T00:00:00.000Z"),
  },
  {
    id: "a1",
    memberId: "SL000012",
    fullName: "Member A1",
    profileImage: null,
    status: "ACTIVE",
    placementParentId: "a",
    placementSlot: 1,
    sponsorId: "a",
    createdAt: new Date("2026-11-02T00:00:00.000Z"),
  },
  {
    id: "a2",
    memberId: "SL000013",
    fullName: "Member A2",
    profileImage: null,
    status: "SUSPENDED",
    placementParentId: "a",
    placementSlot: 2,
    sponsorId: "a",
    createdAt: new Date("2026-08-02T00:00:00.000Z"),
  },
  {
    id: "x",
    memberId: "SL000099",
    fullName: "Outsider",
    profileImage: null,
    status: "ACTIVE",
    placementParentId: null,
    placementSlot: null,
    sponsorId: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
  },
];

const investments: FakeInvestment[] = [
  { memberId: "a", amountPaisa: 100_000n, status: "ACTIVE", createdAt: new Date("2026-10-10") },
  { memberId: "a1", amountPaisa: 200_000n, status: "MATURED", createdAt: new Date("2026-11-03") },
  { memberId: "b", amountPaisa: 50_000n, status: "CLOSED", createdAt: new Date("2026-09-01") },
  { memberId: "b", amountPaisa: 999_999n, status: "PENDING", createdAt: new Date("2026-11-04") },
  { memberId: "a1", amountPaisa: 888_888n, status: "REJECTED", createdAt: new Date("2026-11-04") },
];

const returns: FakeReturn[] = [
  {
    memberId: "a",
    allocatedPaisa: 20_000n,
    distribution: { status: "POSTED", postedAt: new Date("2026-11-04"), createdAt: new Date("2026-11-04") },
  },
  {
    memberId: "a1",
    allocatedPaisa: 10_000n,
    distribution: { status: "POSTED", postedAt: new Date("2026-10-04"), createdAt: new Date("2026-10-04") },
  },
  {
    memberId: "b",
    allocatedPaisa: 99_999n,
    distribution: { status: "DRAFT", postedAt: null, createdAt: new Date("2026-11-04") },
  },
];

const rewards: FakeReward[] = [
  { beneficiaryId: "a", amountPaisa: 5_000n, createdAt: new Date("2026-11-06") },
  { beneficiaryId: "a1", amountPaisa: 2_500n, createdAt: new Date("2026-10-06") },
];

const rankAchievements: FakeRankAchievement[] = [
  {
    memberId: "a",
    rankKey: "R2",
    rankNameSnapshot: "2 Star",
    rankNameBnSnapshot: "২ স্টার",
    rankSortOrder: 2,
    badgeImageUrl: "/images/ranks/r2.svg",
    achievedAt: new Date("2026-11-01"),
  },
];

function byId(id: string, rows: FakeMember[] = members): FakeMember | undefined {
  return rows.find((member) => member.id === id);
}

function isMember(member: FakeMember | undefined): boolean {
  return (member?.role ?? "MEMBER") === "MEMBER";
}

function person(member: FakeMember) {
  return {
    id: member.id,
    memberId: member.memberId,
    fullName: member.fullName,
    profileImage: member.profileImage,
    status: member.status,
  };
}

function descendants(rootId: string, rows: FakeMember[] = members): string[] {
  const result: string[] = [];
  const queue = [rootId];
  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const member of rows) {
      if (member.placementParentId === current && isMember(member)) {
        result.push(member.id);
        queue.push(member.id);
      }
    }
  }
  return result;
}

function fakeClient(rows: FakeMember[] = members) {
  const client = {
    member: {
      findUnique: async ({
        where,
      }: {
        where: { id?: string; memberId?: string; role?: string };
      }) => {
        const member =
          (where.id ? byId(where.id, rows) : undefined) ??
          rows.find((item) => item.memberId === where.memberId);
        if (!member || !isMember(member)) return null;
        const sponsor = member.sponsorId ? byId(member.sponsorId, rows) : undefined;
        const parent = member.placementParentId ? byId(member.placementParentId, rows) : undefined;
        return {
          ...person(member),
          createdAt: member.createdAt,
          placementSlot: member.placementSlot,
          sponsor: sponsor ? { memberId: sponsor.memberId, fullName: sponsor.fullName } : null,
          placementParent: parent
            ? { memberId: parent.memberId, fullName: parent.fullName }
            : null,
          _count: {
            sponsored: rows.filter(
              (item) => item.sponsorId === member.id && isMember(item),
            ).length,
            placementChildren: rows.filter(
              (item) => item.placementParentId === member.id && isMember(item),
            ).length,
          },
          placementChildren: rows
            .filter((item) => item.placementParentId === member.id && isMember(item))
            .map((item) => ({ placementSlot: item.placementSlot })),
        };
      },
      findMany: async ({
        where,
      }: {
        where?: { id?: { in?: string[] }; placementParentId?: string; role?: string };
      }) => {
        if (where?.role && where.role !== "MEMBER") return [];
        const ids = where?.id?.in;
        if (ids) {
          return rows
            .filter((member) => ids.includes(member.id) && isMember(member))
            .map((member) => ({ ...person(member), createdAt: member.createdAt }));
        }
        if (where?.placementParentId) {
          return rows
            .filter(
              (member) =>
                member.placementParentId === where.placementParentId && isMember(member),
            )
            .map((member) => ({
              ...person(member),
              placementSlot: member.placementSlot,
              _count: {
                placementChildren: rows.filter(
                  (item) => item.placementParentId === member.id && isMember(item),
                ).length,
              },
            }));
        }
        return [];
      },
    },
    investment: {
      findMany: async ({
        where,
      }: {
        where: { memberId: { in: string[] }; status: { in: string[] } };
      }) =>
        investments.filter(
          (item) =>
            where.memberId.in.includes(item.memberId) && where.status.in.includes(item.status),
        ),
    },
    profitDistributionLine: {
      findMany: async ({ where }: { where: { memberId: { in: string[] } } }) =>
        returns.filter(
          (item) =>
            where.memberId.in.includes(item.memberId) && item.distribution.status === "POSTED",
        ),
    },
    affiliateReward: {
      findMany: async ({ where }: { where: { beneficiaryId: { in: string[] } } }) =>
        rewards.filter((item) => where.beneficiaryId.in.includes(item.beneficiaryId)),
    },
    rankAchievement: {
      findMany: async ({
        where,
      }: {
        where: { memberId: { in: string[] } };
        orderBy?: unknown;
        select?: unknown;
      }) =>
        rankAchievements.filter((item) => where.memberId.in.includes(item.memberId)),
    },
    $queryRaw: async (_sql: TemplateStringsArray, ...values: unknown[]) => {
      const sql = _sql.join(" ");
      if (sql.includes('ORDER BY p."depth" DESC')) {
        const rootId = String(values[0]);
        const viewerId = String(values[1]);
        if (!isMember(byId(rootId, rows))) return [];
        const path: Array<ReturnType<typeof person> & { depth: number }> = [];
        let current = byId(rootId, rows);
        let depth = 0;
        const seen = new Set<string>();
        while (current && isMember(current) && !seen.has(current.id)) {
          seen.add(current.id);
          path.push({ ...person(current), depth });
          if (current.id === viewerId) {
            return path.sort((left, right) => right.depth - left.depth);
          }
          current = current.placementParentId
            ? byId(current.placementParentId, rows)
            : undefined;
          depth += 1;
        }
        return [];
      }
      if (sql.includes('WHERE "depth" > 0')) {
        return descendants(String(values[0]), rows).map((id) => ({ id }));
      }
      const rootId = String(values[0]);
      const candidateId = String(values[1]);
      return [{
        found:
          isMember(byId(rootId, rows)) &&
          (descendants(rootId, rows).includes(candidateId) || rootId === candidateId),
      }];
    },
  };
  return client as unknown as Parameters<typeof getTeamOverview>[0];
}

describe("team dashboard service", () => {
  it("aggregates the viewer's placement team without mixing in sponsor relationships", async () => {
    const overview = await getTeamOverview(fakeClient(), "v", { now });
    expect(overview).not.toBeNull();
    if (!overview) return;

    expect(overview.scope.memberId).toBe("SL000001");
    expect(overview.breadcrumbs.map((item) => item.memberId)).toEqual(["SL000001"]);
    expect(overview.stats).toMatchObject({
      totalMembers: 4,
      activeMembers: 2,
      inactiveMembers: 2,
      newMembersThisMonth: 2,
      totalInvestmentPaisa: 350_000n,
      totalReturnsPaisa: 30_000n,
      totalAffiliateRewardsPaisa: 7_500n,
    });
    expect(overview.directory.map((row) => row.memberId)).toEqual(["SL000010", "SL000011"]);
    expect(overview.directory[0]).toMatchObject({
      teamMembers: 2,
      teamInvestmentPaisa: 200_000n,
      occupiedSlots: 2,
      availableSlots: 1,
    });
  });

  it("excludes staff accounts from team aggregates", async () => {
    const withStaff = members.map((member) =>
      member.id === "a1" ? { ...member, role: "STAFF" } : member,
    );
    const overview = await getTeamOverview(fakeClient(withStaff), "v", { now });

    expect(overview).not.toBeNull();
    if (!overview) return;
    expect(overview.stats.totalMembers).toBe(3);
    expect(overview.stats.activeMembers).toBe(1);
    expect(overview.stats.totalInvestmentPaisa).toBe(150_000n);
    expect(overview.directory.map((row) => row.memberId)).toEqual(["SL000010", "SL000011"]);
  });

  it("derives breadcrumbs and scoped stats when drilling into another member", async () => {
    const overview = await getTeamOverview(fakeClient(), "v", {
      rootMemberId: "SL000010",
      now,
    });
    expect(overview).not.toBeNull();
    if (!overview) return;

    expect(overview.scope.memberId).toBe("SL000010");
    expect(overview.breadcrumbs.map((item) => item.memberId)).toEqual([
      "SL000001",
      "SL000010",
    ]);
    expect(overview.stats.totalMembers).toBe(2);
    expect(overview.stats.activeMembers).toBe(1);
    expect(overview.stats.totalInvestmentPaisa).toBe(200_000n);
  });

  it("builds a full breadcrumb chain for a deeper team root", async () => {
    const overview = await getTeamOverview(fakeClient(), "v", {
      rootMemberId: "SL000012",
      now,
    });
    expect(overview?.breadcrumbs.map((item) => item.memberId)).toEqual([
      "SL000001",
      "SL000010",
      "SL000012",
    ]);
  });

  it("rejects a team root outside the viewer's placement subtree", async () => {
    const overview = await getTeamOverview(fakeClient(), "v", {
      rootMemberId: "SL000099",
      now,
    });
    expect(overview).toBeNull();
  });

  it("builds member details with sponsor, placement and aggregated team figures", async () => {
    const details = await getTeamMemberDetails(fakeClient(), "v", "SL000010", now);
    expect(details).not.toBeNull();
    if (!details) return;

    expect(details.rank?.rankKey).toBe("R2");
    expect(details.rank?.name).toBe("2 Star");
    expect(details.sponsor?.memberId).toBe("SL000001");
    expect(details.placementParent?.memberId).toBe("SL000001");
    expect(details.occupiedSlots).toBe(2);
    expect(details.teamMembers).toBe(2);
    expect(details.activeTeamMembers).toBe(1);
    expect(details.teamInvestmentPaisa).toBe(200_000n);
    expect(details.teamReturnsPaisa).toBe(10_000n);
    expect(details.teamAffiliateRewardsPaisa).toBe(2_500n);
  });

  it("does not expose details of a member outside the viewer's subtree", async () => {
    const details = await getTeamMemberDetails(fakeClient(), "v", "SL000099", now);
    expect(details).toBeNull();
  });

  it("serializes paisa values for client rendering", async () => {
    const overview = await getTeamOverview(fakeClient(), "v", { now });
    expect(overview).not.toBeNull();
    if (!overview) return;
    const dto = serializeTeamOverview(overview);
    expect(dto.stats.totalInvestmentPaisa).toBe("350000");
    expect(dto.directory[0]?.teamInvestmentPaisa).toBe("200000");
  });

  it("buckets current-month joins by UTC day", () => {
    const series = buildDailyMemberSeries(
      {
        members: [
          { id: "a", status: "ACTIVE", createdAt: new Date("2026-11-03T23:30:00.000Z") },
          { id: "b", status: "INACTIVE", createdAt: new Date("2026-11-03T01:00:00.000Z") },
          { id: "c", status: "ACTIVE", createdAt: new Date("2026-10-31T23:00:00.000Z") },
        ],
        investments: [],
        returns: [],
        rewards: [],
      } satisfies TeamSourceData,
      now,
    );

    expect(series).toHaveLength(30);
    expect(series[2]).toEqual({ day: 3, joins: 2 });
    expect(series.reduce((total, day) => total + day.joins, 0)).toBe(2);
  });

  it("keeps prior periods in the cumulative growth baseline", () => {
    const series = buildMonthlySeries(
      {
        members: [{ id: "m", status: "ACTIVE", createdAt: new Date("2026-01-01") }],
        investments: [{ amountPaisa: 10_000n, createdAt: new Date("2026-02-01") }],
        returns: [],
        rewards: [],
      } satisfies TeamSourceData,
      now,
    );
    expect(series.at(-1)?.cumulativeMembers).toBe(1);
    expect(series.at(-1)?.cumulativeInvestmentPaisa).toBe(10_000n);
  });
});
