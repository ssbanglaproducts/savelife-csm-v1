import { describe, expect, it } from "vitest";
import type { PrismaClient } from "../../generated/prisma/client";
import { buildBuckets, GROWTH_RANGES, getGenealogyView } from "./team-performance";

const now = new Date("2026-11-24T12:00:00.000Z");
const earliest = new Date("2025-06-10T09:00:00.000Z");

describe("team growth buckets", () => {
  it("covers every supported filter", () => {
    for (const range of GROWTH_RANGES) {
      expect(buildBuckets(range, now, earliest).length).toBeGreaterThan(0);
    }
  });

  it("builds daily buckets for the short ranges", () => {
    expect(buildBuckets("7d", now, earliest)).toHaveLength(7);
    expect(buildBuckets("30d", now, earliest)).toHaveLength(10);
    expect(buildBuckets("7d", now, earliest)[0]?.label).toBe("2026-11-18");
  });

  it("builds monthly buckets for the long ranges", () => {
    expect(buildBuckets("3m", now, earliest)).toHaveLength(3);
    expect(buildBuckets("6m", now, earliest)).toHaveLength(6);
    expect(buildBuckets("12m", now, earliest)).toHaveLength(12);
    expect(buildBuckets("12m", now, earliest).at(-1)?.label).toBe("2026-11");
  });

  it("builds all-time buckets from the earliest activity", () => {
    const buckets = buildBuckets("all", now, earliest);
    expect(buckets[0]?.label).toBe("2025-06");
    expect(buckets.at(-1)?.label).toBe("2026-11");
  });
});

describe("genealogy tree", () => {
  type MemberRow = {
    id: string;
    memberId: string;
    fullName: string;
    profileImage: string | null;
    status: string;
    role?: string;
    placementSlot: number | null;
    placementParentId: string | null;
  };

  function fakeGenealogyClient(staffIds: readonly string[] = []): PrismaClient {
    const rows = new Map<string, MemberRow>([
      ["root", { id: "root", memberId: "SLROOT", fullName: "Root", profileImage: null, status: "ACTIVE", placementSlot: null, placementParentId: null }],
      ["a", { id: "a", memberId: "SLA", fullName: "Leg A", profileImage: null, status: "ACTIVE", placementSlot: 1, placementParentId: "root" }],
      ["a1", { id: "a1", memberId: "SLA1", fullName: "A1", profileImage: null, status: "ACTIVE", placementSlot: 1, placementParentId: "a" }],
      ["a2", { id: "a2", memberId: "SLA2", fullName: "A2", profileImage: null, status: "INACTIVE", placementSlot: 2, placementParentId: "a" }],
    ]);
    for (const id of staffIds) {
      const row = rows.get(id);
      if (row) row.role = "STAFF";
    }

    return {
      $queryRaw: async () => [{ found: true }],
      member: {
        findUnique: async ({ where }: { where: { id: string; role?: string } }) => {
          const row = rows.get(where.id);
          if (!row) return null;
          if ((where.role ?? "MEMBER") !== (row.role ?? "MEMBER")) return null;
          return row;
        },
        findMany: async ({ where }: { where: { placementParentId: string; role?: string } }) =>
          [...rows.values()]
            .filter(
              (row) =>
                row.placementParentId === where.placementParentId &&
                (where.role ?? "MEMBER") === (row.role ?? "MEMBER"),
            )
            .sort((left, right) => (left.placementSlot ?? 0) - (right.placementSlot ?? 0)),
      },
      rankAchievement: { findMany: async () => [] },
    } as unknown as PrismaClient;
  }

  it("returns three child slots beneath each occupied leg", async () => {
    const view = await getGenealogyView(fakeGenealogyClient(), "viewer", "root");

    expect(view?.slots).toHaveLength(3);
    expect(view?.slots.map((slot) => slot.occupied)).toEqual([true, false, false]);
    expect(view?.slots[0]?.member?.slots).toHaveLength(3);
    expect(view?.slots[0]?.member?.slots.map((slot) => slot.member?.memberId)).toEqual([
      "SLA1",
      "SLA2",
      undefined,
    ]);
    expect(view?.slots[1]?.member).toBeNull();
  });

  it("does not descend further than the requested depth", async () => {
    const view = await getGenealogyView(fakeGenealogyClient(), "viewer", "root", 1);

    expect(view?.slots[0]?.member?.slots).toHaveLength(0);
  });

  it("hides staff-only genealogy targets", async () => {
    const view = await getGenealogyView(fakeGenealogyClient(["root"]), "viewer", "root");

    expect(view).toBeNull();
  });
});
