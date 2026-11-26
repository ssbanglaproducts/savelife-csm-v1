import { describe, expect, it } from "vitest";
import { isPlacementConflictError, isPlacementSlot, validatePlacementSelection } from "./placement";

type FakeMember = {
  id: string;
  memberId: string;
  fullName: string;
  status: string;
  placementParentId: string | null;
  placementSlot: number | null;
  sponsorParentId: string | null;
};

type PlacementClient = Parameters<typeof validatePlacementSelection>[0];

function fakeClient(members: FakeMember[]): PlacementClient {
  const byId = new Map(members.map((member) => [member.id, member]));

  return {
    member: {
      findUnique: async ({ where }: { where: { id: string } }) => byId.get(where.id) ?? null,
      findMany: async ({
        where,
      }: {
        where: { placementParentId?: string | null; sponsorId?: string | null };
      }) =>
        members
          .filter((member) => member.placementParentId === where.placementParentId)
          .map((member) => ({ ...member })),
    },
    $queryRaw: async (_sql: TemplateStringsArray, ...values: unknown[]) => {
      const sql = _sql.join("");
      const rootId = String(values[0]);
      const candidateId = String(values[1]);
      const field = sql.includes('"sponsorId"') ? "sponsorParentId" : "placementParentId";
      const queue = [rootId];
      const seen = new Set<string>();

      while (queue.length > 0) {
        const current = queue.shift()!;
        if (current === candidateId) return [{ found: true }];
        if (seen.has(current)) continue;
        seen.add(current);

        for (const member of members) {
          if (member[field] === current) queue.push(member.id);
        }
      }

      return [{ found: false }];
    },
  } as unknown as PlacementClient;
}

const members: FakeMember[] = [
  {
    id: "s",
    memberId: "SL000010",
    fullName: "Sponsor",
    status: "ACTIVE",
    placementParentId: null,
    placementSlot: null,
    sponsorParentId: null,
  },
  {
    id: "f",
    memberId: "SL000016",
    fullName: "Placement Parent",
    status: "ACTIVE",
    placementParentId: "s",
    placementSlot: 1,
    sponsorParentId: null,
  },
  {
    id: "h",
    memberId: "SL000017",
    fullName: "Occupant",
    status: "ACTIVE",
    placementParentId: "f",
    placementSlot: 2,
    sponsorParentId: "s",
  },
  {
    id: "u",
    memberId: "SL000099",
    fullName: "Unrelated",
    status: "ACTIVE",
    placementParentId: null,
    placementSlot: null,
    sponsorParentId: null,
  },
];

describe("placement slots", () => {
  it("accepts only slots 1, 2 and 3", () => {
    expect(isPlacementSlot(1)).toBe(true);
    expect(isPlacementSlot(2)).toBe(true);
    expect(isPlacementSlot(3)).toBe(true);
    expect(isPlacementSlot(0)).toBe(false);
    expect(isPlacementSlot(4)).toBe(false);
    expect(isPlacementSlot("2")).toBe(false);
  });

  it("allows a placement parent that is in the sponsor's placement downline", async () => {
    const result = await validatePlacementSelection(fakeClient(members), {
      sponsorId: "s",
      placementMemberId: "f",
      placementSlot: 3,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.parent.memberId).toBe("SL000016");
      expect(result.slots.map((slot) => slot.slot)).toEqual([1, 2, 3]);
      expect(result.slots.find((slot) => slot.slot === 2)?.occupied).toBe(true);
      expect(result.slots.find((slot) => slot.slot === 3)?.occupied).toBe(false);
    }
  });

  it("rejects a placement member outside the sponsor network", async () => {
    const result = await validatePlacementSelection(fakeClient(members), {
      sponsorId: "s",
      placementMemberId: "u",
      placementSlot: 1,
    });

    expect(result).toEqual({ ok: false, error: "PLACEMENT_OUTSIDE_SPONSOR_NETWORK" });
  });

  it("rejects inactive placement parents", async () => {
    const inactive = members.map((member) =>
      member.id === "f" ? { ...member, status: "SUSPENDED" } : member,
    );
    const result = await validatePlacementSelection(fakeClient(inactive), {
      sponsorId: "s",
      placementMemberId: "f",
      placementSlot: 1,
    });

    expect(result).toEqual({ ok: false, error: "PLACEMENT_INACTIVE" });
  });

  it("rejects an occupied slot", async () => {
    const result = await validatePlacementSelection(fakeClient(members), {
      sponsorId: "s",
      placementMemberId: "f",
      placementSlot: 2,
    });

    expect(result).toEqual({ ok: false, error: "PLACEMENT_SLOT_UNAVAILABLE" });
  });

  it("rejects an invalid slot before looking up the member", async () => {
    const result = await validatePlacementSelection(fakeClient(members), {
      sponsorId: "s",
      placementMemberId: "f",
      placementSlot: 9,
    });

    expect(result).toEqual({ ok: false, error: "PLACEMENT_SLOT_INVALID" });
  });

  it("recognises a unique-index conflict on the placement slot", () => {
    expect(
      isPlacementConflictError({
        code: "P2002",
        meta: { target: ["Member_placementParentId_placementSlot_key"] },
      }),
    ).toBe(true);
    expect(isPlacementConflictError({ code: "P2002", meta: { target: ["Member_email_key"] } })).toBe(
      false,
    );
  });
});
