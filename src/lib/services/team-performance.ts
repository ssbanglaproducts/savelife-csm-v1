import { Prisma, type PrismaClient } from "@/generated/prisma/client";
import type { Paisa } from "../money";
import {
  attachMemberRanks,
  type MemberRankSummary,
} from "./member-rank-summary";
import { getPlacementSlots, isInPlacementSubtree } from "./placement";
import { getPlacementDescendantIds } from "./team";

type Client = PrismaClient | Prisma.TransactionClient;

export type GrowthRange = "7d" | "30d" | "3m" | "6m" | "12m" | "all";

export const GROWTH_RANGES: GrowthRange[] = ["7d", "30d", "3m", "6m", "12m", "all"];

/** Two visible levels: the member's three legs and each leg's three slots. */
export const GENEALOGY_TREE_DEPTH = 2;

const QUALIFYING_ORDER_STATUSES = [
  "CONFIRMED",
  "PROCESSING",
  "SHIPPED",
  "OUT_FOR_DELIVERY",
  "PICKED_UP",
  "DELIVERED",
] as const;

const SP_CREDIT_TYPES = new Set([
  "ORDER_REFUND",
  "INVESTMENT_PRINCIPAL",
  "INSTALLMENT_PAYMENT",
  "PROFIT_DISTRIBUTION",
  "AFFILIATE_REWARD",
  "PRINCIPAL_RETURN",
  "ADMIN_ADJUSTMENT",
  "REWARD_COLLECTION",
  "MEMBER_TRANSFER_IN",
  "WALLET_TOP_UP",
]);

const EARNINGS_TYPES = new Set(["PROFIT_DISTRIBUTION", "AFFILIATE_REWARD"]);

export type TeamPersonSummary = {
  id: string;
  memberId: string;
  fullName: string;
  profileImage: string | null;
  status: string;
  placementSlot: number | null;
  rank: MemberRankSummary | null;
};

export interface GenealogyPerson extends TeamPersonSummary {
  slots: GenealogySlot[];
}

export interface GenealogySlot {
  slot: 1 | 2 | 3;
  occupied: boolean;
  member: GenealogyPerson | null;
}

export type GenealogyView = {
  member: GenealogyPerson;
  slots: GenealogySlot[];
};

export type LegPerformance = {
  slot: 1 | 2 | 3;
  totalMembers: number;
  activeMembers: number;
  inactiveMembers: number;
  newMembers: number;
  investmentPaisa: Paisa;
  spActivityPaisa: Paisa;
  refundPaisa: Paisa;
  newlyActivated: number;
};

export type GrowthPoint = {
  label: string;
  members: number;
  investmentPaisa: Paisa;
  spActivityPaisa: Paisa;
};

export type TeamActivity = {
  id: string;
  kind: "REGISTERED" | "ACTIVATED" | "PURCHASE" | "REFUND";
  memberId: string;
  fullName: string;
  amountPaisa: Paisa;
  occurredAt: string;
};

export type TeamPerformance = {
  overall: {
    totalMembers: number;
    activeMembers: number;
    inactiveMembers: number;
    newMembersThisMonth: number;
  };
  legs: LegPerformance[];
  growth: Record<GrowthRange, GrowthPoint[]>;
  investment: {
    totalPaisa: Paisa;
    refundPaisa: Paisa;
    legPaisa: [Paisa, Paisa, Paisa];
    thisMonthPaisa: Paisa;
    growthPercent: number;
  };
  sp: {
    totalPaisa: Paisa;
    legPaisa: [Paisa, Paisa, Paisa];
    monthlyPaisa: Paisa;
  };
  activation: {
    activeMembers: number;
    inactiveMembers: number;
    rate: number;
    newlyActivated: number;
    legs: LegPerformance[];
  };
  activity: TeamActivity[];
};

export type SerializedTeamActivity = Omit<TeamActivity, "amountPaisa"> & {
  amountPaisa: string;
};

export type IndividualPerformance = {
  member: TeamPersonSummary;
  totalTeamMembers: number;
  activeTeamMembers: number;
  investmentPaisa: Paisa;
  individualEarningsPaisa: Paisa;
};

type Bucket = { start: Date; end: Date; label: string };

function monthStart(date: Date, offset = 0): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + offset, 1));
}

function dayStart(date: Date, offset = 0): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + offset),
  );
}

function monthKey(date: Date): string {
  return date.toISOString().slice(0, 7);
}

function sum(values: Paisa[]): Paisa {
  return values.reduce((total, value) => total + value, 0n);
}

function growthPercent(points: GrowthPoint[]): number {
  const current = points.at(-1)?.investmentPaisa ?? 0n;
  const previous = points.at(-2)?.investmentPaisa ?? 0n;
  if (previous === 0n) return current > 0n ? 100 : 0;
  return Number(((current - previous) * 10000n) / previous) / 100;
}

function buildBuckets(range: GrowthRange, now: Date, earliest: Date): Bucket[] {
  const buckets: Bucket[] = [];

  if (range === "7d") {
    for (let offset = 6; offset >= 0; offset -= 1) {
      const start = dayStart(now, -offset);
      buckets.push({ start, end: dayStart(now, -offset + 1), label: start.toISOString().slice(0, 10) });
    }
    return buckets;
  }

  if (range === "30d") {
    for (let offset = 9; offset >= 0; offset -= 1) {
      const start = dayStart(now, -offset * 3 - 2);
      buckets.push({ start, end: dayStart(now, -offset * 3 + 1), label: start.toISOString().slice(0, 10) });
    }
    return buckets;
  }

  if (range === "all") {
    let cursor = monthStart(earliest);
    const final = monthStart(now);
    while (cursor <= final) {
      const next = monthStart(cursor, 1);
      buckets.push({ start: cursor, end: next, label: cursor.toISOString().slice(0, 7) });
      cursor = next;
    }
    return buckets;
  }

  const count = range === "3m" ? 3 : range === "6m" ? 6 : 12;
  for (let offset = count - 1; offset >= 0; offset -= 1) {
    const start = monthStart(now, -offset);
    buckets.push({
      start,
      end: monthStart(now, -offset + 1),
      label: start.toISOString().slice(0, 7),
    });
  }
  return buckets;
}

function inBucket(date: Date, bucket: Bucket): boolean {
  return date >= bucket.start && date < bucket.end;
}

function statusIsActive(status: string): boolean {
  return status === "ACTIVE";
}

type GenealogyDraft = Omit<TeamPersonSummary, "rank"> & {
  rank: null;
  slots: Array<{
    slot: 1 | 2 | 3;
    occupied: boolean;
    member: GenealogyDraft | null;
  }>;
};

/** Placement genealogy for any member inside the viewer's placement subtree. */
export async function getGenealogyView(
  client: Client,
  viewerId: string,
  targetId: string,
  depth = GENEALOGY_TREE_DEPTH,
): Promise<GenealogyView | null> {
  const allowed = targetId === viewerId || (await isInPlacementSubtree(client, viewerId, targetId));
  if (!allowed) return null;

  const member = await client.member.findUnique({
    where: { id: targetId, role: "MEMBER" },
    select: {
      id: true,
      memberId: true,
      fullName: true,
      profileImage: true,
      status: true,
      placementSlot: true,
    },
  });
  if (!member) return null;

  const root = {
    id: member.id,
    memberId: member.memberId,
    fullName: member.fullName,
    profileImage: member.profileImage,
    status: String(member.status),
    placementSlot: member.placementSlot,
  };
  const people: Array<Omit<TeamPersonSummary, "rank">> = [root];
  const safeDepth = Math.max(1, Math.min(depth, GENEALOGY_TREE_DEPTH));

  async function buildDraft(
    person: Omit<TeamPersonSummary, "rank">,
    remainingDepth: number,
  ): Promise<GenealogyDraft> {
    const draft: GenealogyDraft = { ...person, rank: null, slots: [] };
    if (remainingDepth <= 0) return draft;

    const slots = await getPlacementSlots(client, person.id);
    for (const slot of slots) {
      if (!slot.member) {
        draft.slots.push({ slot: slot.slot, occupied: false, member: null });
        continue;
      }

      const child = {
        id: slot.member.id,
        memberId: slot.member.memberId,
        fullName: slot.member.fullName,
        profileImage: slot.member.profileImage,
        status: String(slot.member.status),
        placementSlot: slot.slot,
      };
      people.push(child);
      draft.slots.push({
        slot: slot.slot,
        occupied: true,
        member: await buildDraft(child, remainingDepth - 1),
      });
    }
    return draft;
  }

  const draft = await buildDraft(root, safeDepth);
  const rankedPeople = await attachMemberRanks(client, people);
  const rankedById = new Map(rankedPeople.map((person) => [person.id, person]));

  function hydrate(node: GenealogyDraft): GenealogyPerson {
    const ranked = rankedById.get(node.id) ?? { ...node, rank: null };
    return {
      ...ranked,
      slots: node.slots.map((slot) => ({
        slot: slot.slot,
        occupied: slot.occupied,
        member: slot.member ? hydrate(slot.member) : null,
      })),
    };
  }

  const hydrated = hydrate(draft);
  return { member: hydrated, slots: hydrated.slots };
}

/** Minimal performance card shown after a press-and-hold on an occupied slot. */
export async function getIndividualPerformance(
  client: Client,
  viewerId: string,
  targetId: string,
  now: Date,
): Promise<IndividualPerformance | null> {
  const allowed = targetId === viewerId || (await isInPlacementSubtree(client, viewerId, targetId));
  if (!allowed) return null;

  const member = await client.member.findUnique({
    where: { id: targetId, role: "MEMBER" },
    select: {
      id: true,
      memberId: true,
      fullName: true,
      profileImage: true,
      status: true,
      placementSlot: true,
    },
  });
  if (!member) return null;

  const descendantIds = await getPlacementDescendantIds(client, targetId);
  const [orders, ledger] = await Promise.all([
    client.order.findMany({
      where: {
        memberId: { in: [targetId, ...descendantIds] },
        status: { in: [...QUALIFYING_ORDER_STATUSES] },
      },
      select: { totalPaisa: true },
    }),
    client.ledgerEntry.findMany({
      where: { memberId: targetId, direction: "CREDIT" },
      select: { amountPaisa: true, type: true, createdAt: true },
    }),
  ]);

  const teamMembers = await client.member.findMany({
    where: { id: { in: descendantIds }, role: "MEMBER" },
    select: { status: true, activationDate: true, createdAt: true },
  });

  void now;
  const [rankedMember] = await attachMemberRanks(client, [
    {
      id: member.id,
      memberId: member.memberId,
      fullName: member.fullName,
      profileImage: member.profileImage,
      status: String(member.status),
      placementSlot: member.placementSlot,
    },
  ]);
  return {
    member: rankedMember,
    totalTeamMembers: descendantIds.length,
    activeTeamMembers: teamMembers.filter((row) => statusIsActive(String(row.status))).length,
    investmentPaisa: sum(orders.map((order) => order.totalPaisa)),
    individualEarningsPaisa: sum(
      ledger
        .filter((entry) => EARNINGS_TYPES.has(String(entry.type)))
        .map((entry) => entry.amountPaisa),
    ),
  };
}

/** Full placement-team performance for the signed-in account. */
export async function getTeamPerformance(
  client: Client,
  viewerId: string,
  now: Date,
): Promise<TeamPerformance> {
  const descendantIds = await getPlacementDescendantIds(client, viewerId);
  const directChildren = await client.member.findMany({
    where: { placementParentId: viewerId, role: "MEMBER" },
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

  if (descendantIds.length === 0) {
    return emptyPerformance(await attachMemberRanks(client, directChildren));
  }

  const [members, orders, refundOrders, ledger] = await Promise.all([
    client.member.findMany({
      where: { id: { in: descendantIds }, role: "MEMBER" },
      select: {
        id: true,
        memberId: true,
        fullName: true,
        status: true,
        createdAt: true,
        activationDate: true,
      },
    }),
    client.order.findMany({
      where: {
        memberId: { in: descendantIds },
        status: { in: [...QUALIFYING_ORDER_STATUSES] },
      },
      select: { id: true, memberId: true, totalPaisa: true, placedAt: true, orderNumber: true },
    }),
    client.order.findMany({
      where: { memberId: { in: descendantIds }, status: "RETURNED" },
      select: { id: true, memberId: true, totalPaisa: true, placedAt: true, orderNumber: true },
    }),
    client.ledgerEntry.findMany({
      where: { memberId: { in: descendantIds } },
      select: { id: true, memberId: true, type: true, direction: true, amountPaisa: true, createdAt: true },
    }),
  ]);

  const memberById = new Map(members.map((member) => [member.id, member]));
  const legIds = new Map<1 | 2 | 3, Set<string>>();
  for (const child of directChildren) {
    if (child.placementSlot !== 1 && child.placementSlot !== 2 && child.placementSlot !== 3) continue;
    const ids = new Set<string>([child.id, ...(await getPlacementDescendantIds(client, child.id))]);
    legIds.set(child.placementSlot, ids);
  }

  const currentMonth = monthKey(now);
  const spCredits = ledger.filter(
    (entry) => String(entry.direction) === "CREDIT" && SP_CREDIT_TYPES.has(String(entry.type)),
  );
  const refundCredits = ledger.filter(
    (entry) => String(entry.direction) === "CREDIT" && String(entry.type) === "ORDER_REFUND",
  );

  function legStats(slot: 1 | 2 | 3): LegPerformance {
    const ids = legIds.get(slot) ?? new Set<string>();
    const legMembers = [...ids].map((id) => memberById.get(id)).filter(Boolean);
    const legOrders = orders.filter((order) => ids.has(order.memberId));
    const legSp = spCredits.filter((entry) => ids.has(entry.memberId));
    const legRefunds = refundCredits.filter((entry) => ids.has(entry.memberId));
    const active = legMembers.filter((member) => statusIsActive(String(member?.status))).length;
    return {
      slot,
      totalMembers: legMembers.length,
      activeMembers: active,
      inactiveMembers: legMembers.length - active,
      newMembers: legMembers.filter((member) => member && monthKey(member.createdAt) === currentMonth)
        .length,
      investmentPaisa: sum(legOrders.map((order) => order.totalPaisa)),
      spActivityPaisa: sum(legSp.map((entry) => entry.amountPaisa)),
      refundPaisa: sum(legRefunds.map((entry) => entry.amountPaisa)),
      newlyActivated: legMembers.filter(
        (member) => member?.activationDate && monthKey(member.activationDate) === currentMonth,
      ).length,
    };
  }

  const legs: LegPerformance[] = [legStats(1), legStats(2), legStats(3)];
  const active = members.filter((member) => statusIsActive(String(member.status))).length;
  const earliestCandidate = [
    ...members.map((member) => member.createdAt),
    ...orders.map((order) => order.placedAt),
    ...spCredits.map((entry) => entry.createdAt),
  ].sort((a, b) => a.getTime() - b.getTime())[0] ?? now;

  const growth = {} as Record<GrowthRange, GrowthPoint[]>;
  for (const range of GROWTH_RANGES) {
    const buckets = buildBuckets(range, now, earliestCandidate);
    const rangeStart = buckets[0]?.start ?? now;
    growth[range] = buckets.map((bucket) => {
      const joinedBefore = members.filter((member) => member.createdAt < bucket.start).length;
      return {
        label: bucket.label,
        members: joinedBefore,
        investmentPaisa: sum(
          orders
            .filter((order) => inBucket(order.placedAt, bucket))
            .map((order) => order.totalPaisa),
        ),
        spActivityPaisa: sum(
          spCredits.filter((entry) => inBucket(entry.createdAt, bucket)).map((entry) => entry.amountPaisa),
        ),
      };
    });
    void rangeStart;
  }

  const activity: TeamActivity[] = [
    ...members.map((member) => ({
      id: `register-${member.id}`,
      kind: "REGISTERED" as const,
      memberId: member.memberId,
      fullName: member.fullName,
      amountPaisa: 0n,
      occurredAt: member.createdAt.toISOString(),
    })),
    ...members
      .filter((member) => member.activationDate)
      .map((member) => ({
        id: `activate-${member.id}`,
        kind: "ACTIVATED" as const,
        memberId: member.memberId,
        fullName: member.fullName,
        amountPaisa: 0n,
        occurredAt: (member.activationDate as Date).toISOString(),
      })),
    ...orders.map((order) => ({
      id: `order-${order.id}`,
      kind: "PURCHASE" as const,
      memberId: memberById.get(order.memberId)?.memberId ?? "",
      fullName: memberById.get(order.memberId)?.fullName ?? "Member",
      amountPaisa: order.totalPaisa,
      occurredAt: order.placedAt.toISOString(),
    })),
    ...refundOrders.map((order) => ({
      id: `refund-${order.id}`,
      kind: "REFUND" as const,
      memberId: memberById.get(order.memberId)?.memberId ?? "",
      fullName: memberById.get(order.memberId)?.fullName ?? "Member",
      amountPaisa: order.totalPaisa,
      occurredAt: order.placedAt.toISOString(),
    })),
  ]
    .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))
    .slice(0, 12);

  const newlyActivated = members.filter(
    (member) => member.activationDate && monthKey(member.activationDate) === currentMonth,
  ).length;

  return {
    overall: {
      totalMembers: members.length,
      activeMembers: active,
      inactiveMembers: members.length - active,
      newMembersThisMonth: members.filter((member) => monthKey(member.createdAt) === currentMonth)
        .length,
    },
    legs,
    growth,
    investment: {
      totalPaisa: sum(orders.map((order) => order.totalPaisa)),
      refundPaisa: sum(refundCredits.map((entry) => entry.amountPaisa)),
      legPaisa: [legs[0].investmentPaisa, legs[1].investmentPaisa, legs[2].investmentPaisa],
      thisMonthPaisa: sum(
        orders
          .filter((order) => monthKey(order.placedAt) === currentMonth)
          .map((order) => order.totalPaisa),
      ),
      growthPercent: growthPercent(growth["12m"]),
    },
    sp: {
      totalPaisa: sum(spCredits.map((entry) => entry.amountPaisa)),
      legPaisa: [legs[0].spActivityPaisa, legs[1].spActivityPaisa, legs[2].spActivityPaisa],
      monthlyPaisa: sum(
        spCredits
          .filter((entry) => monthKey(entry.createdAt) === currentMonth)
          .map((entry) => entry.amountPaisa),
      ),
    },
    activation: {
      activeMembers: active,
      inactiveMembers: members.length - active,
      rate: members.length ? Math.round((active / members.length) * 1000) / 10 : 0,
      newlyActivated,
      legs,
    },
    activity,
  };
}

function emptyPerformance(children: TeamPersonSummary[]): TeamPerformance {
  const leg = (slot: 1 | 2 | 3): LegPerformance => ({
    slot,
    totalMembers: 0,
    activeMembers: 0,
    inactiveMembers: 0,
    newMembers: 0,
    investmentPaisa: 0n,
    spActivityPaisa: 0n,
    refundPaisa: 0n,
    newlyActivated: 0,
  });
  const legs = [leg(1), leg(2), leg(3)];
  void children;
  const growth = {} as Record<GrowthRange, GrowthPoint[]>;
  for (const range of GROWTH_RANGES) growth[range] = [];
  return {
    overall: {
      totalMembers: 0,
      activeMembers: 0,
      inactiveMembers: 0,
      newMembersThisMonth: 0,
    },
    legs,
    growth,
    investment: {
      totalPaisa: 0n,
      refundPaisa: 0n,
      legPaisa: [0n, 0n, 0n],
      thisMonthPaisa: 0n,
      growthPercent: 0,
    },
    sp: { totalPaisa: 0n, legPaisa: [0n, 0n, 0n], monthlyPaisa: 0n },
    activation: {
      activeMembers: 0,
      inactiveMembers: 0,
      rate: 0,
      newlyActivated: 0,
      legs,
    },
    activity: [],
  };
}

/* ---------- Serialized DTOs for client components ---------- */

type SerializedLeg = Omit<LegPerformance, "investmentPaisa" | "spActivityPaisa" | "refundPaisa"> & {
  investmentPaisa: string;
  spActivityPaisa: string;
  refundPaisa: string;
};

export type TeamPerformanceDto = {
  overall: TeamPerformance["overall"];
  legs: SerializedLeg[];
  growth: Record<GrowthRange, Array<Omit<GrowthPoint, "investmentPaisa" | "spActivityPaisa"> & {
    investmentPaisa: string;
    spActivityPaisa: string;
  }>>;
  investment: {
    totalPaisa: string;
    refundPaisa: string;
    legPaisa: [string, string, string];
    thisMonthPaisa: string;
    growthPercent: number;
  };
  sp: {
    totalPaisa: string;
    legPaisa: [string, string, string];
    monthlyPaisa: string;
  };
  activation: {
    activeMembers: number;
    inactiveMembers: number;
    rate: number;
    newlyActivated: number;
    legs: SerializedLeg[];
  };
  activity: SerializedTeamActivity[];
};

function serializeLeg(leg: LegPerformance): SerializedLeg {
  return {
    ...leg,
    investmentPaisa: leg.investmentPaisa.toString(),
    spActivityPaisa: leg.spActivityPaisa.toString(),
    refundPaisa: leg.refundPaisa.toString(),
  };
}

export function serializeTeamPerformance(data: TeamPerformance): TeamPerformanceDto {
  const growth = {} as TeamPerformanceDto["growth"];
  for (const range of GROWTH_RANGES) {
    growth[range] = data.growth[range].map((point) => ({
      ...point,
      investmentPaisa: point.investmentPaisa.toString(),
      spActivityPaisa: point.spActivityPaisa.toString(),
    }));
  }

  return {
    overall: data.overall,
    legs: data.legs.map(serializeLeg),
    growth,
    investment: {
      totalPaisa: data.investment.totalPaisa.toString(),
      refundPaisa: data.investment.refundPaisa.toString(),
      legPaisa: [
        data.investment.legPaisa[0].toString(),
        data.investment.legPaisa[1].toString(),
        data.investment.legPaisa[2].toString(),
      ],
      thisMonthPaisa: data.investment.thisMonthPaisa.toString(),
      growthPercent: data.investment.growthPercent,
    },
    sp: {
      totalPaisa: data.sp.totalPaisa.toString(),
      legPaisa: [
        data.sp.legPaisa[0].toString(),
        data.sp.legPaisa[1].toString(),
        data.sp.legPaisa[2].toString(),
      ],
      monthlyPaisa: data.sp.monthlyPaisa.toString(),
    },
    activation: {
      activeMembers: data.activation.activeMembers,
      inactiveMembers: data.activation.inactiveMembers,
      rate: data.activation.rate,
      newlyActivated: data.activation.newlyActivated,
      legs: data.activation.legs.map(serializeLeg),
    },
    activity: data.activity.map((item) => ({
      ...item,
      amountPaisa: item.amountPaisa.toString(),
    })),
  };
}

export type IndividualPerformanceDto = Omit<
  IndividualPerformance,
  "investmentPaisa" | "individualEarningsPaisa"
> & {
  investmentPaisa: string;
  individualEarningsPaisa: string;
};

export function serializeIndividualPerformance(
  data: IndividualPerformance,
): IndividualPerformanceDto {
  return {
    ...data,
    investmentPaisa: data.investmentPaisa.toString(),
    individualEarningsPaisa: data.individualEarningsPaisa.toString(),
  };
}

export { buildBuckets };
