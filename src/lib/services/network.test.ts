import { describe, expect, it } from "vitest";
import { isInPlacementSubtree } from "./placement";
import { isInSponsorSubtree } from "./network";

type FakeMember = {
  id: string;
  placementParentId: string | null;
  sponsorParentId: string | null;
};

type SubtreeClient = Parameters<typeof isInPlacementSubtree>[0];

function fakeClient(members: FakeMember[]): SubtreeClient {
  return {
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
  } as unknown as SubtreeClient;
}

const members: FakeMember[] = [
  { id: "a", placementParentId: null, sponsorParentId: null },
  { id: "c", placementParentId: null, sponsorParentId: "a" },
  { id: "f", placementParentId: "a", sponsorParentId: null },
  { id: "h", placementParentId: "f", sponsorParentId: "c" },
];

describe("separate sponsor and placement trees", () => {
  it("puts a member in its sponsor tree and placement tree independently", async () => {
    const client = fakeClient(members);

    expect(await isInSponsorSubtree(client, "c", "h")).toBe(true);
    expect(await isInPlacementSubtree(client, "f", "h")).toBe(true);
    expect(await isInPlacementSubtree(client, "c", "h")).toBe(false);
  });

  it("walks unlimited placement depth", async () => {
    const deep = [
      ...members,
      { id: "d1", placementParentId: "h", sponsorParentId: null },
      { id: "d2", placementParentId: "d1", sponsorParentId: null },
      { id: "d3", placementParentId: "d2", sponsorParentId: null },
    ];
    const client = fakeClient(deep);

    expect(await isInPlacementSubtree(client, "a", "d3")).toBe(true);
  });
});
