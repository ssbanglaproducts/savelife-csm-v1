import bcrypt from "bcryptjs";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  adminFindUnique: vi.fn(),
  versionFindUnique: vi.fn(),
  versionFindFirst: vi.fn(),
  auditLogCreate: vi.fn(),
  createRankPlanVersion: vi.fn(),
  evaluateAllMembers: vi.fn(),
  ensureDefaultRankPlan: vi.fn(),
}));

vi.mock("@/auth", () => ({ auth: mocks.auth }));
vi.mock("@/lib/prisma", () => {
  const prisma = {
    member: { findUnique: mocks.adminFindUnique },
    rankPlanVersion: {
      findUnique: mocks.versionFindUnique,
      findFirst: mocks.versionFindFirst,
    },
    auditLog: { create: mocks.auditLogCreate },
    $transaction: async (fn: (tx: unknown) => Promise<unknown>) => fn(prisma),
  };
  return { prisma };
});
vi.mock("@/lib/services/rank-rewards", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/services/rank-rewards")>();
  return {
    ...actual,
    createRankPlanVersion: mocks.createRankPlanVersion,
    evaluateAllMembers: mocks.evaluateAllMembers,
    ensureDefaultRankPlan: mocks.ensureDefaultRankPlan,
  };
});

import { POST } from "./route";
import { paisaToSPInput } from "@/lib/money";
import { DEFAULT_RANK_PLAN, type RankDefinitionInput } from "@/lib/services/rank-rewards";

const ADMIN_ID = "admin-1";
const TOKEN = "22222222-2222-4222-8222-222222222222";
const PASSWORD = "Admin@123456";
const CREATED_AT = new Date("2026-11-01T06:00:00.000Z");

type StoredDefinition = {
  id: string;
  rankKey: RankDefinitionInput["rankKey"];
  sortOrder: number;
  name: string;
  nameBn: string | null;
  directTargetPaisa: bigint;
  team1TargetPaisa: bigint;
  team2TargetPaisa: bigint;
  team3TargetPaisa: bigint;
  rewardType: RankDefinitionInput["rewardType"];
  rewardSpPaisa: bigint | null;
  rewardLabel: string | null;
  rewardLabelBn: string | null;
  rewardDescription: string | null;
  rewardDescriptionBn: string | null;
  badgeImageUrl: string;
  rewardImageUrl: string | null;
};

type PayloadRank = {
  rankKey: RankDefinitionInput["rankKey"];
  sortOrder: number;
  name: string;
  nameBn: string | null;
  directTarget: string;
  team1Target: string;
  team2Target: string;
  team3Target: string;
  rewardType: RankDefinitionInput["rewardType"];
  rewardSp: string | null;
  rewardLabel: string | null;
  rewardLabelBn: string | null;
  rewardDescription: string | null;
  rewardDescriptionBn: string | null;
  badgeImageUrl: string;
  rewardImageUrl: string | null;
};

function payload(): PayloadRank[] {
  return DEFAULT_RANK_PLAN.map((rank) => ({
    rankKey: rank.rankKey,
    sortOrder: rank.sortOrder,
    name: rank.name,
    nameBn: rank.nameBn,
    directTarget: paisaToSPInput(rank.directTargetPaisa),
    team1Target: paisaToSPInput(rank.team1TargetPaisa),
    team2Target: paisaToSPInput(rank.team2TargetPaisa),
    team3Target: paisaToSPInput(rank.team3TargetPaisa),
    rewardType: rank.rewardType,
    rewardSp: rank.rewardSpPaisa ? paisaToSPInput(rank.rewardSpPaisa) : null,
    rewardLabel: rank.rewardLabel,
    rewardLabelBn: rank.rewardLabelBn,
    rewardDescription: null,
    rewardDescriptionBn: null,
    badgeImageUrl: rank.badgeImageUrl,
    rewardImageUrl: rank.rewardImageUrl,
  }));
}

function storedDefinition(rank: RankDefinitionInput): StoredDefinition {
  return {
    id: `definition-${rank.rankKey}`,
    rankKey: rank.rankKey,
    sortOrder: rank.sortOrder,
    name: rank.name,
    nameBn: rank.nameBn,
    directTargetPaisa: rank.directTargetPaisa,
    team1TargetPaisa: rank.team1TargetPaisa,
    team2TargetPaisa: rank.team2TargetPaisa,
    team3TargetPaisa: rank.team3TargetPaisa,
    rewardType: rank.rewardType,
    rewardSpPaisa: rank.rewardSpPaisa,
    rewardLabel: rank.rewardLabel,
    rewardLabelBn: rank.rewardLabelBn,
    rewardDescription: rank.rewardDescription ?? null,
    rewardDescriptionBn: rank.rewardDescriptionBn ?? null,
    badgeImageUrl: rank.badgeImageUrl,
    rewardImageUrl: rank.rewardImageUrl,
  };
}

function activeVersion() {
  return {
    id: "rank-plan-version:2",
    version: 2,
    isActive: true,
    effectiveFrom: CREATED_AT,
    activatedAt: CREATED_AT,
    note: null,
    approvedChanges: null,
    commitToken: null,
    createdById: ADMIN_ID,
    createdAt: CREATED_AT,
    definitions: DEFAULT_RANK_PLAN.map(storedDefinition),
    createdBy: { memberId: "SL000000", fullName: "System Admin" },
  };
}

function request(body: Record<string, unknown>): Request {
  return new Request("http://localhost/api/admin/rank-plan", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function body(overrides: Record<string, unknown> = {}) {
  return {
    adminPassword: PASSWORD,
    commitToken: TOKEN,
    ranks: payload(),
    ...overrides,
  };
}

describe("POST /api/admin/rank-plan", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    mocks.auth.mockResolvedValue({ user: { id: ADMIN_ID, role: "ADMIN" } });
    mocks.adminFindUnique.mockResolvedValue({
      passwordHash: await bcrypt.hash(PASSWORD, 4),
    });
    mocks.versionFindUnique.mockResolvedValue(null);
    mocks.versionFindFirst.mockResolvedValue(activeVersion());
    mocks.evaluateAllMembers.mockResolvedValue(0);
    mocks.auditLogCreate.mockResolvedValue(undefined);
    mocks.createRankPlanVersion.mockImplementation(
      async (_client: unknown, input: { ranks: readonly RankDefinitionInput[] }) => ({
        id: "rank-plan-version:3",
        version: 3,
        isActive: true,
        definitions: input.ranks.map((rank, index) => {
          const definition = storedDefinition(rank);
          return {
            ...definition,
            id: `new-definition-${index}`,
            directTarget: paisaToSPInput(BigInt(definition.directTargetPaisa)),
            team1Target: paisaToSPInput(BigInt(definition.team1TargetPaisa)),
            team2Target: paisaToSPInput(BigInt(definition.team2TargetPaisa)),
            team3Target: paisaToSPInput(BigInt(definition.team3TargetPaisa)),
            rewardSp: definition.rewardSpPaisa
              ? paisaToSPInput(BigInt(definition.rewardSpPaisa))
              : "",
          };
        }),
      }),
    );
  });

  it("rejects a wrong admin password without creating a version", async () => {
    const response = await POST(request(body({ adminPassword: "wrong-password" })));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({ error: "INVALID_ADMIN_PASSWORD" });
    expect(mocks.createRankPlanVersion).not.toHaveBeenCalled();
    expect(mocks.auditLogCreate).not.toHaveBeenCalled();
  });

  it("rejects invalid values before authorization", async () => {
    const ranks = payload();
    ranks[0].directTarget = "not-a-number";
    const response = await POST(request(body({ ranks })));

    expect(response.status).toBe(400);
    expect(mocks.adminFindUnique).not.toHaveBeenCalled();
    expect(mocks.createRankPlanVersion).not.toHaveBeenCalled();
  });

  it("blocks a repeated commit token", async () => {
    mocks.versionFindUnique.mockResolvedValue({
      ...activeVersion(),
      version: 3,
      commitToken: TOKEN,
      createdById: ADMIN_ID,
    });

    const response = await POST(request(body()));
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json).toMatchObject({ duplicate: true, version: 3 });
    expect(mocks.createRankPlanVersion).not.toHaveBeenCalled();
  });

  it("stores the reviewed diff, commit token, and physical reward description", async () => {
    const ranks = payload();
    ranks[0].name = "1 Star Elite";
    ranks[3].rewardDescription = "A new motorcycle";

    const response = await POST(request(body({ ranks })));
    const json = await response.json();

    expect(response.status).toBe(201);
    expect(json).toMatchObject({ duplicate: false, version: 3, changes: 2 });

    const input = mocks.createRankPlanVersion.mock.calls[0]?.[1] as {
      commitToken: string;
      approvedChanges: Array<{ settingKey: string; previous: string | null; next: string | null }>;
      ranks: readonly RankDefinitionInput[];
    };
    expect(input.commitToken).toBe(TOKEN);
    expect(input.approvedChanges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          rankKey: "R1",
          settingKey: "name",
          previous: "1 Star",
          next: "1 Star Elite",
        }),
        expect.objectContaining({
          rankKey: "R4",
          settingKey: "rewardDescription",
          previous: null,
          next: "A new motorcycle",
        }),
      ]),
    );
    expect(input.ranks[3]).toMatchObject({
      rankKey: "R4",
      rewardType: "PHYSICAL",
      rewardDescription: "A new motorcycle",
    });
  });
});
