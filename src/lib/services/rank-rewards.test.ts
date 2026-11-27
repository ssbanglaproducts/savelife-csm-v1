import { describe, expect, it } from "vitest";
import { spToPaisa } from "../money";
import {
  createRankPlanVersion,
  DEFAULT_RANK_PLAN,
  RANK_KEYS,
  evaluateMemberRanks,
  evaluateRankQualification,
  evaluateTeamSales,
  findQualifyingDirectInvestment,
  selectPrimaryMethod,
  teamDistributionQualified,
  type RankInvestment,
  type RankQualificationSource,
  type RankSlot,
} from "./rank-rewards";
import type { PrismaClient } from "../../generated/prisma/client";

function investment(
  id: string,
  amount: string,
  iso: string,
  referralId = `referral-${id}`,
): RankInvestment {
  return {
    id,
    investmentNumber: `INV-${id}`,
    referralId,
    referralMemberId: /^\d+$/.test(id) ? `SL${id.padStart(6, "0")}` : `SL-${id}`,
    referralName: `Member ${id}`,
    profileImage: null,
    amountPaisa: spToPaisa(amount),
    investedAt: new Date(iso),
  };
}

function source(
  direct: RankInvestment[] = [],
  teams: Partial<Record<RankSlot, RankInvestment[]>> = {},
): RankQualificationSource {
  return {
    directInvestments: direct,
    teamInvestments: { 1: teams[1] ?? [], 2: teams[2] ?? [], 3: teams[3] ?? [] },
  };
}

const oneStarTargets = {
  directTargetPaisa: spToPaisa("500000"),
  team1TargetPaisa: spToPaisa("200000"),
  team2TargetPaisa: spToPaisa("200000"),
  team3TargetPaisa: spToPaisa("100000"),
};

describe("Direct Sales qualification", () => {
  it("accepts one single investment that meets the target", () => {
    const match = findQualifyingDirectInvestment(
      [investment("c", "500000", "2026-01-03T00:00:00Z")],
      oneStarTargets.directTargetPaisa,
    );
    expect(match?.id).toBe("c");
  });

  it("never combines referrals or multiple investments", () => {
    const match = findQualifyingDirectInvestment(
      [
        investment("a", "300000", "2026-01-01T00:00:00Z"),
        investment("b", "200000", "2026-01-02T00:00:00Z"),
      ],
      oneStarTargets.directTargetPaisa,
    );
    expect(match).toBeNull();

    const combined = findQualifyingDirectInvestment(
      [
        investment("a", "300000", "2026-01-01T00:00:00Z"),
        investment("b", "200000", "2026-01-02T00:00:00Z"),
        investment("c", "500000", "2026-01-03T00:00:00Z"),
      ],
      oneStarTargets.directTargetPaisa,
    );
    expect(combined?.id).toBe("c");
  });

  it("does not depend on placement slot", () => {
    const match = findQualifyingDirectInvestment(
      [investment("slot3", "500000", "2026-01-01T00:00:00Z")],
      oneStarTargets.directTargetPaisa,
    );
    expect(match?.referralMemberId).toBe("SL-slot3");
  });
});

describe("Three-Team Sales qualification", () => {
  it("accepts each team meeting its own target", () => {
    const result = evaluateTeamSales(
      source(
        [],
        {
          1: [investment("a", "200000", "2026-01-01T00:00:00Z")],
          2: [investment("b", "200000", "2026-01-02T00:00:00Z")],
          3: [investment("c", "100000", "2026-01-03T00:00:00Z")],
        },
      ),
      oneStarTargets,
    );

    expect(result.qualified).toBe(true);
    expect(result.qualifyingAt?.toISOString()).toBe("2026-01-03T00:00:00.000Z");
    expect(result.teams.map((team) => team.qualified)).toEqual([true, true, true]);
  });

  it("rejects a combined total in one team", () => {
    const result = evaluateTeamSales(
      source([], {
        1: [investment("a", "500000", "2026-01-01T00:00:00Z")],
      }),
      oneStarTargets,
    );

    expect(result.qualified).toBe(false);
    expect(result.teams.map((team) => team.totalPaisa.toString())).toEqual([
      "50000000",
      "0",
      "0",
    ]);
  });

  it("accepts every interchangeable Rank 1 distribution from the chart", () => {
    const distributions: Array<[string, string, string]> = [
      ["100000", "200000", "200000"],
      ["200000", "100000", "200000"],
      ["200000", "200000", "100000"],
      ["250000", "200000", "100000"],
    ];
    for (const amounts of distributions) {
      const result = evaluateTeamSales(
        source(
          [],
          {
            1: [investment("a", amounts[0], "2026-01-01T00:00:00Z")],
            2: [investment("b", amounts[1], "2026-01-01T00:00:00Z")],
            3: [investment("c", amounts[2], "2026-01-01T00:00:00Z")],
          },
        ),
        oneStarTargets,
      );
      expect({ amounts, qualified: result.qualified }).toEqual({
        amounts,
        qualified: true,
      });
    }
  });

  it("rejects distributions where one team misses its required minimum", () => {
    const distributions: Array<[string, string, string]> = [
      ["300000", "150000", "100000"],
      ["200000", "200000", "50000"],
    ];
    for (const amounts of distributions) {
      const result = evaluateTeamSales(
        source(
          [],
          {
            1: [investment("a", amounts[0], "2026-01-01T00:00:00Z")],
            2: [investment("b", amounts[1], "2026-01-01T00:00:00Z")],
            3: [investment("c", amounts[2], "2026-01-01T00:00:00Z")],
          },
        ),
        oneStarTargets,
      );
      expect(result.qualified).toBe(false);
    }
  });

  it("uses each rank's own three targets regardless of team position", () => {
    const r8 = DEFAULT_RANK_PLAN.find((rank) => rank.rankKey === "R8")!;
    const r9 = DEFAULT_RANK_PLAN.find((rank) => rank.rankKey === "R9")!;

    const r8Qualified = evaluateTeamSales(
      source(
        [],
        {
          1: [investment("a", "400000000", "2026-01-01T00:00:00Z")],
          2: [investment("b", "600000000", "2026-01-01T00:00:00Z")],
          3: [investment("c", "500000000", "2026-01-01T00:00:00Z")],
        },
      ),
      r8,
    );
    expect(r8Qualified.qualified).toBe(true);
    expect(r8Qualified.requiredTargetsPaisa.map((target) => target.toString())).toEqual([
      "60000000000",
      "50000000000",
      "40000000000",
    ]);

    expect(
      evaluateTeamSales(
        source(
          [],
          {
            1: [investment("a", "600000000", "2026-01-01T00:00:00Z")],
            2: [investment("b", "600000000", "2026-01-01T00:00:00Z")],
            3: [investment("c", "300000000", "2026-01-01T00:00:00Z")],
          },
        ),
        r8,
      ).qualified,
    ).toBe(false);

    expect(
      evaluateTeamSales(
        source(
          [],
          {
            1: [investment("a", "500000000", "2026-01-01T00:00:00Z")],
            2: [investment("b", "500000000", "2026-01-01T00:00:00Z")],
            3: [investment("c", "1000000000", "2026-01-01T00:00:00Z")],
          },
        ),
        r9,
      ).qualified,
    ).toBe(true);
  });

  it("records the time when the whole distribution first becomes true", () => {
    const result = evaluateTeamSales(
      source(
        [],
        {
          1: [investment("low", "100000", "2026-01-01T00:00:00Z")],
          2: [investment("high", "200000", "2026-01-02T00:00:00Z")],
          3: [investment("high2", "200000", "2026-01-03T00:00:00Z")],
        },
      ),
      oneStarTargets,
    );

    expect(result.qualified).toBe(true);
    expect(result.qualifyingAt?.toISOString()).toBe("2026-01-03T00:00:00.000Z");
    expect(result.teams.map((team) => team.targetPaisa.toString())).toEqual([
      "10000000",
      "20000000",
      "20000000",
    ]);
  });

  it("compares three targets directly as an unordered set", () => {
    const targets = [
      spToPaisa("200000"),
      spToPaisa("200000"),
      spToPaisa("100000"),
    ];
    expect(
      teamDistributionQualified(
        [spToPaisa("100000"), spToPaisa("200000"), spToPaisa("250000")],
        targets,
      ),
    ).toBe(true);
    expect(
      teamDistributionQualified(
        [spToPaisa("300000"), spToPaisa("150000"), spToPaisa("100000")],
        targets,
      ),
    ).toBe(false);
  });
});

describe("Independent rank checks and method priority", () => {
  it("awards every rank whose targets are met, including lower ranks", () => {
    const qualified = DEFAULT_RANK_PLAN.filter((definition) => {
      const result = evaluateRankQualification(
        definition,
        source([investment("direct", "4000000", "2026-01-01T00:00:00Z")]),
      );
      return result.primaryMethod !== null;
    });

    expect(qualified.map((definition) => definition.rankKey)).toEqual(["R1", "R2", "R3"]);
  });

  it("qualifies every rank when the highest direct target is met", () => {
    const qualified = DEFAULT_RANK_PLAN.filter((definition) => {
      const result = evaluateRankQualification(
        definition,
        source([investment("direct", "1000000000", "2026-01-01T00:00:00Z")]),
      );
      return result.primaryMethod !== null;
    });

    expect(qualified.map((definition) => definition.rankKey)).toEqual([...RANK_KEYS]);
  });

  it("qualifies every rank when all three team targets are met", () => {
    const teamSource = source(
      [],
      {
        1: [investment("team1", "1000000000", "2026-01-01T00:00:00Z")],
        2: [investment("team2", "500000000", "2026-01-01T00:00:00Z")],
        3: [investment("team3", "500000000", "2026-01-01T00:00:00Z")],
      },
    );
    const qualified = DEFAULT_RANK_PLAN.filter((definition) => {
      const result = evaluateRankQualification(definition, teamSource);
      return result.primaryMethod === "TEAM_SALES";
    });

    expect(qualified.map((definition) => definition.rankKey)).toEqual([...RANK_KEYS]);
  });

  it("uses the earliest method as primary and records the other as alternate", () => {
    const both = evaluateRankQualification(
      oneStarTargets,
      source(
        [investment("direct", "500000", "2026-01-02T00:00:00Z")],
        {
          1: [investment("a", "200000", "2026-01-01T00:00:00Z")],
          2: [investment("b", "200000", "2026-01-01T00:00:00Z")],
          3: [investment("c", "100000", "2026-01-01T00:00:00Z")],
        },
      ),
    );

    expect(both.primaryMethod).toBe("TEAM_SALES");
    expect(both.secondaryMethod).toBe("DIRECT_SALES");
  });

  it("selects Direct Sales on a same-time tie", () => {
    const at = "2026-01-01T00:00:00Z";
    expect(
      selectPrimaryMethod(new Date(at), new Date(at)),
    ).toEqual({ primaryMethod: "DIRECT_SALES", secondaryMethod: "TEAM_SALES" });
  });
});

describe("member-only rank evaluation", () => {
  it("does not evaluate staff accounts", async () => {
    const client = {
      member: {
        findFirst: async ({ where }: { where: { id: string; role?: string } }) =>
          where.role === "MEMBER" && where.id === "real-member" ? { id: "real-member" } : null,
      },
    } as unknown as PrismaClient;

    expect(await evaluateMemberRanks(client, "staff-member")).toEqual([]);
  });
});

describe("Official plan values", () => {
  it("stores the exact initial chart in SP paisa", () => {
    expect(
      DEFAULT_RANK_PLAN.map((rank) => [
        rank.rankKey,
        rank.directTargetPaisa.toString(),
        rank.team1TargetPaisa.toString(),
        rank.team2TargetPaisa.toString(),
        rank.team3TargetPaisa.toString(),
        rank.rewardSpPaisa?.toString() ?? null,
        rank.rewardLabel,
      ]),
    ).toEqual([
      ["R1", "50000000", "20000000", "20000000", "10000000", "1000000", null],
      ["R2", "150000000", "80000000", "80000000", "40000000", "2000000", null],
      ["R3", "400000000", "250000000", "250000000", "100000000", "5000000", null],
      ["R4", "1000000000", "600000000", "600000000", "300000000", null, "Motorcycle"],
      ["R5", "2500000000", "2000000000", "2000000000", "1000000000", "50000000", null],
      ["R6", "7000000000", "10000000000", "10000000000", "8000000000", null, "Luxury Car"],
      ["R7", "20000000000", "30000000000", "30000000000", "20000000000", null, "World Tour"],
      ["R8", "50000000000", "60000000000", "50000000000", "40000000000", null, "Flat"],
      ["R9", "100000000000", "100000000000", "50000000000", "50000000000", null, "Duplex House"],
    ]);
  });

  it("creates a new plan version without rewriting the old one", async () => {
    const oldDefinition = { ...DEFAULT_RANK_PLAN[0], name: "1 Star" };
    type CreateArgs = {
      data: {
        version: number;
        commitToken: string | null;
        approvedChanges: unknown;
        definitions: {
          create: Array<{ name: string; rewardDescription: string | null; rewardDescriptionBn: string | null }>;
        };
      };
    };
    let deactivate: unknown;
    const createCalls: CreateArgs[] = [];

    const client = {
      $transaction: async (fn: (tx: PrismaClient) => Promise<unknown>) => fn(client as PrismaClient),
      rankPlanVersion: {
        findFirst: async () => ({ version: 1 }),
        updateMany: async (args: unknown) => {
          deactivate = args;
        },
        create: async (args: CreateArgs) => {
          createCalls.push(args);
          return {
            id: "version-2",
            version: 2,
            isActive: true,
            definitions: args.data.definitions.create.map((rank, index) => ({
              ...rank,
              id: `definition-${index}`,
            })),
          };
        },
      },
      auditLog: { create: async () => undefined },
    } as unknown as PrismaClient;

    const updated = DEFAULT_RANK_PLAN.map((rank, index) =>
      index === 0
        ? { ...rank, name: "1 Star Gold", rewardDescription: "Gold badge", rewardDescriptionBn: "সোনালি ব্যাজ" }
        : rank,
    );
    const approvedChanges = [{ id: "R1:name", rankKey: "R1", settingKey: "name", previous: "1 Star", next: "1 Star Gold" }];
    const created = await createRankPlanVersion(client, {
      ranks: updated,
      actorId: "admin-id",
      commitToken: "token-2",
      approvedChanges,
    });

    expect(deactivate).toEqual({ where: { isActive: true }, data: { isActive: false } });
    expect(createCalls[0]?.data.version).toBe(2);
    expect(createCalls[0]?.data.commitToken).toBe("token-2");
    expect(createCalls[0]?.data.approvedChanges).toEqual(approvedChanges);
    expect(createCalls[0]?.data.definitions.create[0]).toMatchObject({
      name: "1 Star Gold",
      rewardDescription: "Gold badge",
      rewardDescriptionBn: "সোনালি ব্যাজ",
    });
    expect(oldDefinition.name).toBe("1 Star");
    expect(created.version).toBe(2);
  });
});
