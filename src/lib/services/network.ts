import { Prisma, type PrismaClient } from "@/generated/prisma/client";
import {
  attachMemberRanks,
  getMemberRankSummaries,
  type MemberRankSummary,
} from "./member-rank-summary";
import { PLACEMENT_SLOTS, type PlacementSlot, isInPlacementSubtree } from "./placement";

export type NetworkView = "placement" | "sponsor";

type Client = PrismaClient | Prisma.TransactionClient;

export type NetworkNode = {
  id: string;
  memberId: string;
  fullName: string;
  profileImage: string | null;
  status: string;
  slot: PlacementSlot | null;
  placementChildren: number;
  directReferrals: number;
  rank: MemberRankSummary | null;
};

export type NetworkChildren = {
  nodes: NetworkNode[];
  slots: Array<{ slot: PlacementSlot; node: NetworkNode | null }>;
};

function toNode(member: {
  id: string;
  memberId: string;
  fullName: string;
  profileImage: string | null;
  status: string;
  placementSlot: number | null;
  _count: { placementChildren: number; sponsored: number };
}): NetworkNode {
  return {
    id: member.id,
    memberId: member.memberId,
    fullName: member.fullName,
    profileImage: member.profileImage,
    status: member.status,
    slot: member.placementSlot as PlacementSlot | null,
    placementChildren: member._count.placementChildren,
    directReferrals: member._count.sponsored,
    rank: null,
  };
}

const nodeSelect = {
  id: true,
  memberId: true,
  fullName: true,
  profileImage: true,
  status: true,
  placementSlot: true,
  _count: {
    select: {
      placementChildren: { where: { role: "MEMBER" } },
      sponsored: { where: { role: "MEMBER" } },
    },
  },
} as const;

/** True when candidateId is rootId or a direct-referral descendant of rootId. */
export async function isInSponsorSubtree(
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
      INNER JOIN tree t ON m."sponsorId" = t."id"
      WHERE m."role" = 'MEMBER'
    )
    SELECT EXISTS(SELECT 1 FROM tree WHERE "id" = ${candidateId}) AS found
  `;
  return rows[0]?.found === true;
}

export async function isNetworkNodeVisible(
  client: Client,
  viewerId: string,
  nodeId: string,
  view: NetworkView,
): Promise<boolean> {
  if (viewerId === nodeId) return true;
  return view === "placement"
    ? isInPlacementSubtree(client, viewerId, nodeId)
    : isInSponsorSubtree(client, viewerId, nodeId);
}

export async function getNetworkChildren(
  client: Client,
  view: NetworkView,
  nodeId: string,
): Promise<NetworkChildren> {
  if (view === "sponsor") {
    const children = await client.member.findMany({
      where: { sponsorId: nodeId, role: "MEMBER" },
      orderBy: { createdAt: "asc" },
      select: nodeSelect,
    });
    return { nodes: await attachMemberRanks(client, children.map(toNode)), slots: [] };
  }

  const children = await client.member.findMany({
    where: { placementParentId: nodeId, role: "MEMBER" },
    orderBy: { placementSlot: "asc" },
    select: nodeSelect,
  });
  const nodes = await attachMemberRanks(client, children.map(toNode));
  return {
    nodes,
    slots: PLACEMENT_SLOTS.map((slot) => ({
      slot,
      node: nodes.find((node) => node.slot === slot) ?? null,
    })),
  };
}

export async function getNetworkDetails(client: Client, memberId: string) {
  const member = await client.member.findUnique({
    where: { id: memberId, role: "MEMBER" },
    select: {
      id: true,
      memberId: true,
      fullName: true,
      profileImage: true,
      status: true,
      createdAt: true,
      placementSlot: true,
      sponsor: { select: { memberId: true, fullName: true } },
      placementParent: { select: { memberId: true, fullName: true } },
      _count: {
        select: {
          sponsored: { where: { role: "MEMBER" } },
          placementChildren: { where: { role: "MEMBER" } },
        },
      },
      placementChildren: {
        where: { placementSlot: { not: null }, role: "MEMBER" },
        select: { placementSlot: true },
      },
    },
  });
  if (!member) return null;

  const ranks = await getMemberRankSummaries(client, [memberId]);
  return {
    id: member.id,
    memberId: member.memberId,
    fullName: member.fullName,
    profileImage: member.profileImage,
    status: member.status,
    rank: ranks.get(memberId) ?? null,
    joinedAt: member.createdAt.toISOString(),
    placementSlot: member.placementSlot,
    occupiedSlots: member.placementChildren.length,
    directReferrals: member._count.sponsored,
    directPlacements: member._count.placementChildren,
    sponsor: member.sponsor,
    placementParent: member.placementParent,
  };
}

export async function searchNetwork(
  client: Client,
  viewerId: string,
  view: NetworkView,
  query: string,
  limit = 20,
) {
  const normalized = query.trim();
  if (!normalized) return [];

  const baseWhere = {
    OR: [
      { memberId: { contains: normalized, mode: "insensitive" as const } },
      { fullName: { contains: normalized, mode: "insensitive" as const } },
    ],
  };

  const candidates = await client.member.findMany({
    where: { ...baseWhere, role: "MEMBER" },
    take: limit * 4,
    select: nodeSelect,
  });

  const visible: NetworkNode[] = [];
  for (const candidate of candidates) {
    if (await isNetworkNodeVisible(client, viewerId, candidate.id, view)) {
      visible.push(toNode(candidate));
      if (visible.length >= limit) break;
    }
  }
  return attachMemberRanks(client, visible);
}
