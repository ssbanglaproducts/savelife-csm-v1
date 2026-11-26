import { describe, expect, it } from "vitest";
import type { Prisma } from "../../generated/prisma/client";
import { spToPaisa } from "../money";
import { DEFAULT_SALARY_PLAN, type SalaryPlan } from "../salary";
import { syncSalaryEntitlement } from "./salary-entitlements";

type Data = Record<string, unknown>;

type AchievementRow = {
  id: string;
  memberId: string;
  rankKey: string;
  rankSortOrder: number;
  achievedAt: Date;
};

type EntitlementRow = {
  id: string;
  memberId: string;
  rankKey: string;
  rankSortOrder: number;
  achievedAt: Date;
  weeksPaid: number;
  isActive: boolean;
};

type ChangeRow = {
  id: string;
  memberId: string;
  previousRankKey: string | null;
  previousRankSortOrder: number | null;
  rankKey: string;
  rankSortOrder: number;
  reason: string;
  changedAt: Date;
};

function applyUpdate(record: object, data: Data): void {
  const target = record as Data;
  for (const [field, value] of Object.entries(data)) {
    if (typeof value === "object" && value !== null && !(value instanceof Date)) {
      const operation = value as Data;
      const current = target[field];
      if (typeof current === "number" && typeof operation.increment === "number") {
        target[field] = current + operation.increment;
      } else {
        target[field] = value;
      }
    } else {
      target[field] = value;
    }
  }
}

class FakeEntitlementClient {
  readonly achievements: AchievementRow[] = [];
  readonly entitlements: EntitlementRow[] = [];
  readonly changes: ChangeRow[] = [];

  asClient(): Prisma.TransactionClient {
    return this as unknown as Prisma.TransactionClient;
  }

  addAchievement(
    rankKey: string,
    rankSortOrder: number,
    achievedAt: Date,
    memberId = "member-1",
  ): void {
    this.achievements.push({
      id: `achievement-${this.achievements.length + 1}`,
      memberId,
      rankKey,
      rankSortOrder,
      achievedAt,
    });
  }

  rankAchievement = {
    findFirst: async ({
      where,
    }: {
      where: { memberId: string; rankKey: { in: readonly string[] } };
    }) => {
      const matches = this.achievements
        .filter(
          (row) =>
            row.memberId === where.memberId && where.rankKey.in.includes(row.rankKey),
        )
        .sort((a, b) => {
          if (b.rankSortOrder !== a.rankSortOrder) return b.rankSortOrder - a.rankSortOrder;
          if (b.achievedAt.getTime() !== a.achievedAt.getTime()) {
            return b.achievedAt.getTime() - a.achievedAt.getTime();
          }
          return b.id.localeCompare(a.id);
        });
      const first = matches[0];
      if (!first) return null;
      return {
        rankKey: first.rankKey,
        rankSortOrder: first.rankSortOrder,
        achievedAt: first.achievedAt,
      };
    },
  };

  salaryEntitlement = {
    findUnique: async ({ where }: { where: { memberId: string } }) =>
      this.entitlements.find((row) => row.memberId === where.memberId) ?? null,
    update: async ({ where, data }: { where: { id: string }; data: Data }) => {
      const found = this.entitlements.find((row) => row.id === where.id);
      if (!found) throw new Error("entitlement not found");
      applyUpdate(found, data);
      return { ...found };
    },
    upsert: async ({
      create,
      update,
    }: {
      where: { memberId: string };
      create: EntitlementRow;
      update: Data;
    }) => {
      const existing = this.entitlements.find(
        (row) => row.memberId === create.memberId,
      );
      if (!existing) {
        this.entitlements.push({ ...create });
        return { ...create };
      }
      applyUpdate(existing, update);
      return { ...existing };
    },
  };

  salaryEntitlementChange = {
    create: async ({ data }: { data: ChangeRow }) => {
      this.changes.push({ ...data });
      return { ...data };
    },
  };
}

const achievedAt = new Date("2026-11-25T12:00:00.000Z");

describe("salary entitlement synchronization", () => {
  it("creates one entitlement and an immutable change for a salary rank", async () => {
    const db = new FakeEntitlementClient();
    db.addAchievement("R2", 2, achievedAt);

    const changed = await syncSalaryEntitlement(db.asClient(), {
      memberId: "member-1",
      rankKey: "R2",
      rankSortOrder: 2,
      achievedAt,
    });

    expect(changed).toBe(true);
    expect(db.entitlements).toHaveLength(1);
    expect(db.entitlements[0]).toMatchObject({
      rankKey: "R2",
      rankSortOrder: 2,
      weeksPaid: 0,
    });
    expect(db.changes).toHaveLength(1);
    expect(db.changes[0]).toMatchObject({
      previousRankKey: null,
      rankKey: "R2",
      reason: "ACHIEVEMENT",
    });
  });

  it("ignores a repeated or lower achievement", async () => {
    const db = new FakeEntitlementClient();
    db.addAchievement("R2", 2, achievedAt);
    db.addAchievement("R3", 3, achievedAt);
    await syncSalaryEntitlement(db.asClient(), {
      memberId: "member-1",
      rankKey: "R3",
      rankSortOrder: 3,
      achievedAt,
    });

    const repeated = await syncSalaryEntitlement(db.asClient(), {
      memberId: "member-1",
      rankKey: "R3",
      rankSortOrder: 3,
      achievedAt,
    });
    const lower = await syncSalaryEntitlement(db.asClient(), {
      memberId: "member-1",
      rankKey: "R2",
      rankSortOrder: 2,
      achievedAt,
    });

    expect(repeated).toBe(false);
    expect(lower).toBe(false);
    expect(db.entitlements).toHaveLength(1);
    expect(db.entitlements[0].rankKey).toBe("R3");
    expect(db.changes).toHaveLength(1);
  });

  it("replaces the previous entitlement and resets the successful-week count", async () => {
    const db = new FakeEntitlementClient();
    db.addAchievement("R2", 2, achievedAt);
    await syncSalaryEntitlement(db.asClient(), {
      memberId: "member-1",
      rankKey: "R2",
      rankSortOrder: 2,
      achievedAt,
    });
    db.addAchievement("R5", 5, new Date("2026-11-26T12:00:00.000Z"));
    db.entitlements[0].weeksPaid = 7;

    const changed = await syncSalaryEntitlement(db.asClient(), {
      memberId: "member-1",
      rankKey: "R5",
      rankSortOrder: 5,
      achievedAt: new Date("2026-11-26T12:00:00.000Z"),
      reason: "PROMOTION",
    });

    expect(changed).toBe(true);
    expect(db.entitlements).toHaveLength(1);
    expect(db.entitlements[0]).toMatchObject({ rankKey: "R5", weeksPaid: 0 });
    expect(db.changes).toHaveLength(2);
    expect(db.changes[1]).toMatchObject({
      previousRankKey: "R2",
      previousRankSortOrder: 2,
      rankKey: "R5",
      rankSortOrder: 5,
      reason: "PROMOTION",
    });
  });

  it("never creates a salary entitlement for R1", async () => {
    const db = new FakeEntitlementClient();
    db.addAchievement("R1", 1, achievedAt);

    const changed = await syncSalaryEntitlement(db.asClient(), {
      memberId: "member-1",
      rankKey: "R1",
      rankSortOrder: 1,
      achievedAt,
    });

    expect(changed).toBe(false);
    expect(db.entitlements).toEqual([]);
    expect(db.changes).toEqual([]);
  });

  it("follows the highest achieved rank even when a lower achievement triggers the sync", async () => {
    const db = new FakeEntitlementClient();
    db.addAchievement("R2", 2, achievedAt);
    db.addAchievement("R3", 3, achievedAt);
    db.addAchievement("R9", 9, achievedAt);
    db.entitlements.push({
      id: "salary-entitlement:member-1",
      memberId: "member-1",
      rankKey: "R2",
      rankSortOrder: 2,
      achievedAt,
      weeksPaid: 5,
      isActive: true,
    });

    const changed = await syncSalaryEntitlement(db.asClient(), {
      memberId: "member-1",
      rankKey: "R3",
      rankSortOrder: 3,
      achievedAt,
    });

    expect(changed).toBe(true);
    expect(db.entitlements[0]).toMatchObject({
      rankKey: "R9",
      rankSortOrder: 9,
      weeksPaid: 0,
    });
  });

  it("repairs a stale entitlement that is higher than the achieved rank", async () => {
    const db = new FakeEntitlementClient();
    db.addAchievement("R2", 2, achievedAt);
    db.addAchievement("R5", 5, achievedAt);
    db.entitlements.push({
      id: "salary-entitlement:member-1",
      memberId: "member-1",
      rankKey: "R9",
      rankSortOrder: 9,
      achievedAt,
      weeksPaid: 3,
      isActive: true,
    });

    const changed = await syncSalaryEntitlement(db.asClient(), {
      memberId: "member-1",
      rankKey: "R5",
      rankSortOrder: 5,
      achievedAt,
    });

    expect(changed).toBe(true);
    expect(db.entitlements[0]).toMatchObject({
      rankKey: "R5",
      rankSortOrder: 5,
      weeksPaid: 0,
    });
  });

  it("pays R1 when the active plan gives it both allocation and a weekly cap", async () => {
    const plan: SalaryPlan = {
      ...DEFAULT_SALARY_PLAN,
      configs: {
        ...DEFAULT_SALARY_PLAN.configs,
        R1: {
          ...DEFAULT_SALARY_PLAN.configs.R1,
          isEnabled: true,
          allocationBps: 100,
          maxWeeklySalaryPaisa: spToPaisa("1000"),
        },
      },
    };
    const db = new FakeEntitlementClient();
    db.addAchievement("R1", 1, achievedAt);

    const changed = await syncSalaryEntitlement(
      db.asClient(),
      { memberId: "member-1", rankKey: "R1", rankSortOrder: 1, achievedAt },
      plan,
    );

    expect(changed).toBe(true);
    expect(db.entitlements).toMatchObject([
      { rankKey: "R1", rankSortOrder: 1, weeksPaid: 0, isActive: true },
    ]);
  });

  it("marks an entitlement inactive instead of deleting it when its rank is disabled", async () => {
    const db = new FakeEntitlementClient();
    db.addAchievement("R2", 2, achievedAt);
    await syncSalaryEntitlement(db.asClient(), {
      memberId: "member-1",
      rankKey: "R2",
      rankSortOrder: 2,
      achievedAt,
    });
    db.entitlements[0].weeksPaid = 4;
    const disabledPlan: SalaryPlan = {
      ...DEFAULT_SALARY_PLAN,
      configs: {
        ...DEFAULT_SALARY_PLAN.configs,
        R2: { ...DEFAULT_SALARY_PLAN.configs.R2, allocationBps: 0 },
      },
    };

    const changed = await syncSalaryEntitlement(
      db.asClient(),
      {
        memberId: "member-1",
        rankKey: "R2",
        rankSortOrder: 2,
        achievedAt,
        reason: "PLAN_UPDATE",
      },
      disabledPlan,
    );
    expect(changed).toBe(true);
    expect(db.entitlements).toHaveLength(1);
    expect(db.entitlements[0]).toMatchObject({ rankKey: "R2", weeksPaid: 4, isActive: false });
    expect(db.changes.at(-1)).toMatchObject({ reason: "PLAN_UPDATE" });

    const repeated = await syncSalaryEntitlement(
      db.asClient(),
      { memberId: "member-1", rankKey: "R2", rankSortOrder: 2, achievedAt },
      disabledPlan,
    );
    expect(repeated).toBe(false);
    expect(db.entitlements).toHaveLength(1);
    expect(db.changes).toHaveLength(2);
  });

  it("reactivates an inactive entitlement with a fresh change id", async () => {
    const db = new FakeEntitlementClient();
    db.addAchievement("R2", 2, achievedAt);
    await syncSalaryEntitlement(db.asClient(), {
      memberId: "member-1",
      rankKey: "R2",
      rankSortOrder: 2,
      achievedAt,
    });
    db.entitlements[0].isActive = false;
    db.entitlements[0].weeksPaid = 4;

    const changed = await syncSalaryEntitlement(db.asClient(), {
      memberId: "member-1",
      rankKey: "R2",
      rankSortOrder: 2,
      achievedAt,
      reason: "PLAN_UPDATE",
    });

    expect(changed).toBe(true);
    expect(db.entitlements[0]).toMatchObject({ rankKey: "R2", weeksPaid: 0, isActive: true });
    expect(new Set(db.changes.map((row) => row.id)).size).toBe(db.changes.length);
  });
});
