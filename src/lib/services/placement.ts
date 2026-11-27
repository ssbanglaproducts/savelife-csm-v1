import { Prisma, type PrismaClient } from "@/generated/prisma/client";

export const PLACEMENT_SLOTS = [1, 2, 3] as const;
export type PlacementSlot = (typeof PLACEMENT_SLOTS)[number];

export type PlacementErrorCode =
  | "PLACEMENT_NOT_FOUND"
  | "PLACEMENT_NOT_ELIGIBLE"
  | "PLACEMENT_INACTIVE"
  | "PLACEMENT_OUTSIDE_SPONSOR_NETWORK"
  | "PLACEMENT_SLOT_INVALID"
  | "PLACEMENT_SLOT_UNAVAILABLE"
  | "PLACEMENT_CYCLE";

export type PlacementSlotInfo = {
  slot: PlacementSlot;
  occupied: boolean;
  member: {
    id: string;
    memberId: string;
    fullName: string;
    profileImage: string | null;
    status: string;
  } | null;
};

export type PlacementMemberInfo = {
  id: string;
  memberId: string;
  fullName: string;
  profileImage: string | null;
  status: string;
};

type Client = PrismaClient | Prisma.TransactionClient;

export function isPlacementSlot(value: unknown): value is PlacementSlot {
  return value === 1 || value === 2 || value === 3;
}

/** Returns exactly three slots so the UI can always render a complete row. */
export async function getPlacementSlots(
  client: Client,
  parentId: string,
): Promise<PlacementSlotInfo[]> {
  const children = await client.member.findMany({
    where: { placementParentId: parentId, role: "MEMBER" },
    orderBy: { placementSlot: "asc" },
    select: {
      id: true,
      memberId: true,
      fullName: true,
      profileImage: true,
      status: true,
      placementSlot: true,
    },
  });

  return PLACEMENT_SLOTS.map((slot) => {
    const child = children.find((row) => row.placementSlot === slot);
    return {
      slot,
      occupied: Boolean(child),
      member: child
        ? {
            id: child.id,
            memberId: child.memberId,
            fullName: child.fullName,
            profileImage: child.profileImage,
            status: child.status,
          }
        : null,
    };
  });
}

/** True when candidateId is rootId itself or anywhere below rootId by placement. */
export async function isInPlacementSubtree(
  client: Client,
  rootId: string,
  candidateId: string,
): Promise<boolean> {
  if (rootId === candidateId) return true;

  const rows = await client.$queryRaw<Array<{ found: boolean }>>`
    WITH RECURSIVE tree(id) AS (
      SELECT "id" FROM "Member" WHERE "id" = ${rootId} AND "role" = 'MEMBER'
      UNION ALL
      SELECT m."id"
      FROM "Member" m
      INNER JOIN tree t ON m."placementParentId" = t."id"
      WHERE m."role" = 'MEMBER'
    )
    SELECT EXISTS(SELECT 1 FROM tree WHERE "id" = ${candidateId}) AS found
  `;

  return rows[0]?.found === true;
}

export type PlacementSelectionInput = {
  sponsorId: string;
  placementMemberId: string;
  placementSlot: number;
};

export type PlacementSelectionResult =
  | { ok: true; parent: PlacementMemberInfo; slots: PlacementSlotInfo[] }
  | { ok: false; error: PlacementErrorCode };

/**
 * A placement parent must be the sponsor or inside the sponsor's placement
 * downline, ACTIVE, and have the requested slot free. Sponsor identity is never
 * changed by placement decisions.
 */
export async function validatePlacementSelection(
  client: Client,
  { sponsorId, placementMemberId, placementSlot }: PlacementSelectionInput,
): Promise<PlacementSelectionResult> {
  if (!isPlacementSlot(placementSlot)) {
    return { ok: false, error: "PLACEMENT_SLOT_INVALID" };
  }

  const parent = await client.member.findUnique({
    where: { id: placementMemberId },
    select: {
      id: true,
      memberId: true,
      fullName: true,
      profileImage: true,
      status: true,
      role: true,
    },
  });

  if (!parent) return { ok: false, error: "PLACEMENT_NOT_FOUND" };
  if (parent.role !== "MEMBER") return { ok: false, error: "PLACEMENT_NOT_ELIGIBLE" };
  if (parent.status !== "ACTIVE") return { ok: false, error: "PLACEMENT_INACTIVE" };

  const inSponsorNetwork = await isInPlacementSubtree(client, sponsorId, parent.id);
  if (!inSponsorNetwork) {
    return { ok: false, error: "PLACEMENT_OUTSIDE_SPONSOR_NETWORK" };
  }

  const slots = await getPlacementSlots(client, parent.id);
  if (slots.find((row) => row.slot === placementSlot)?.occupied) {
    return { ok: false, error: "PLACEMENT_SLOT_UNAVAILABLE" };
  }

  return { ok: true, parent, slots };
}

/** Caller must revalidate before calling; the DB unique index is the race guard. */
export async function assignPlacement(
  client: Client,
  memberId: string,
  parentId: string,
  slot: PlacementSlot,
): Promise<void> {
  await client.member.update({
    where: { id: memberId },
    data: { placementParentId: parentId, placementSlot: slot },
  });
}

export function isPlacementConflictError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    String(error.code) === "P2002" &&
    "meta" in error &&
    JSON.stringify((error as { meta?: unknown }).meta).includes("placementParentId")
  );
}
