import { Prisma, type PrismaClient } from "@/generated/prisma/client";
import {
  DEFAULT_RANK_REWARD_IMAGES,
  defaultRankRewardImage,
  rankBadgeSrc,
  resolveRankBadgeImageUrl,
} from "../rank-art";
import { requireMemberId } from "../member-id";
import { spToPaisa, type Paisa } from "../money";
import { adjustWalletField, isUniqueViolation, makeKey, recordLedgerEntry } from "./ledger";
import { getPlacementDescendantIds, TEAM_INVESTMENT_STATUSES } from "./team";
import {
  findHighestSalaryAchievement,
  syncSalaryEntitlement,
} from "./salary-entitlements";
import { getActiveSalaryPlan } from "./salary-plan";

type Client = PrismaClient | Prisma.TransactionClient;

export const RANK_KEYS = ["R1", "R2", "R3", "R4", "R5", "R6", "R7", "R8", "R9"] as const;
export type RankKey = (typeof RANK_KEYS)[number];

export type RankDefinitionInput = {
  rankKey: RankKey;
  sortOrder: number;
  name: string;
  nameBn: string | null;
  directTargetPaisa: Paisa;
  team1TargetPaisa: Paisa;
  team2TargetPaisa: Paisa;
  team3TargetPaisa: Paisa;
  rewardType: "SP" | "PHYSICAL";
  rewardSpPaisa: Paisa | null;
  rewardLabel: string | null;
  rewardLabelBn: string | null;
  rewardDescription?: string | null;
  rewardDescriptionBn?: string | null;
  badgeImageUrl: string;
  rewardImageUrl: string | null;
};

/** The official initial plan. Values are SP (paisa), never BDT. */
const BASE_RANK_PLAN: readonly Omit<RankDefinitionInput, "badgeImageUrl">[] = [
  {
    rankKey: "R1",
    sortOrder: 1,
    name: "1 Star",
    nameBn: "১ স্টার",
    directTargetPaisa: spToPaisa("500000"),
    team1TargetPaisa: spToPaisa("200000"),
    team2TargetPaisa: spToPaisa("200000"),
    team3TargetPaisa: spToPaisa("100000"),
    rewardType: "SP",
    rewardSpPaisa: spToPaisa("10000"),
    rewardLabel: null,
    rewardLabelBn: null,
    rewardImageUrl: null,
  },
  {
    rankKey: "R2",
    sortOrder: 2,
    name: "2 Star",
    nameBn: "২ স্টার",
    directTargetPaisa: spToPaisa("1500000"),
    team1TargetPaisa: spToPaisa("800000"),
    team2TargetPaisa: spToPaisa("800000"),
    team3TargetPaisa: spToPaisa("400000"),
    rewardType: "SP",
    rewardSpPaisa: spToPaisa("20000"),
    rewardLabel: null,
    rewardLabelBn: null,
    rewardImageUrl: null,
  },
  {
    rankKey: "R3",
    sortOrder: 3,
    name: "3 Star",
    nameBn: "৩ স্টার",
    directTargetPaisa: spToPaisa("4000000"),
    team1TargetPaisa: spToPaisa("2500000"),
    team2TargetPaisa: spToPaisa("2500000"),
    team3TargetPaisa: spToPaisa("1000000"),
    rewardType: "SP",
    rewardSpPaisa: spToPaisa("50000"),
    rewardLabel: null,
    rewardLabelBn: null,
    rewardImageUrl: null,
  },
  {
    rankKey: "R4",
    sortOrder: 4,
    name: "4 Star",
    nameBn: "৪ স্টার",
    directTargetPaisa: spToPaisa("10000000"),
    team1TargetPaisa: spToPaisa("6000000"),
    team2TargetPaisa: spToPaisa("6000000"),
    team3TargetPaisa: spToPaisa("3000000"),
    rewardType: "PHYSICAL",
    rewardSpPaisa: null,
    rewardLabel: "Motorcycle",
    rewardLabelBn: "মোটরসাইকেল",
    rewardImageUrl: DEFAULT_RANK_REWARD_IMAGES.R4,
  },
  {
    rankKey: "R5",
    sortOrder: 5,
    name: "5 Star",
    nameBn: "৫ স্টার",
    directTargetPaisa: spToPaisa("25000000"),
    team1TargetPaisa: spToPaisa("20000000"),
    team2TargetPaisa: spToPaisa("20000000"),
    team3TargetPaisa: spToPaisa("10000000"),
    rewardType: "SP",
    rewardSpPaisa: spToPaisa("500000"),
    rewardLabel: null,
    rewardLabelBn: null,
    rewardImageUrl: null,
  },
  {
    rankKey: "R6",
    sortOrder: 6,
    name: "6 Star",
    nameBn: "৬ স্টার",
    directTargetPaisa: spToPaisa("70000000"),
    team1TargetPaisa: spToPaisa("100000000"),
    team2TargetPaisa: spToPaisa("100000000"),
    team3TargetPaisa: spToPaisa("80000000"),
    rewardType: "PHYSICAL",
    rewardSpPaisa: null,
    rewardLabel: "Luxury Car",
    rewardLabelBn: "বিলাসবহুল গাড়ি",
    rewardImageUrl: DEFAULT_RANK_REWARD_IMAGES.R6,
  },
  {
    rankKey: "R7",
    sortOrder: 7,
    name: "7 Star",
    nameBn: "৭ স্টার",
    directTargetPaisa: spToPaisa("200000000"),
    team1TargetPaisa: spToPaisa("300000000"),
    team2TargetPaisa: spToPaisa("300000000"),
    team3TargetPaisa: spToPaisa("200000000"),
    rewardType: "PHYSICAL",
    rewardSpPaisa: null,
    rewardLabel: "World Tour",
    rewardLabelBn: "বিশ্ব ভ্রমণ",
    rewardImageUrl: DEFAULT_RANK_REWARD_IMAGES.R7,
  },
  {
    rankKey: "R8",
    sortOrder: 8,
    name: "Board Member",
    nameBn: "বোর্ড সদস্য",
    directTargetPaisa: spToPaisa("500000000"),
    team1TargetPaisa: spToPaisa("600000000"),
    team2TargetPaisa: spToPaisa("500000000"),
    team3TargetPaisa: spToPaisa("400000000"),
    rewardType: "PHYSICAL",
    rewardSpPaisa: null,
    rewardLabel: "Flat",
    rewardLabelBn: "ফ্ল্যাট",
    rewardImageUrl: DEFAULT_RANK_REWARD_IMAGES.R8,
  },
  {
    rankKey: "R9",
    sortOrder: 9,
    name: "Vice Chairman",
    nameBn: "ভাইস চেয়ারম্যান",
    directTargetPaisa: spToPaisa("1000000000"),
    team1TargetPaisa: spToPaisa("1000000000"),
    team2TargetPaisa: spToPaisa("500000000"),
    team3TargetPaisa: spToPaisa("500000000"),
    rewardType: "PHYSICAL",
    rewardSpPaisa: null,
    rewardLabel: "Duplex House",
    rewardLabelBn: "ডুপ্লেক্স বাড়ি",
    rewardImageUrl: DEFAULT_RANK_REWARD_IMAGES.R9,
  },
];

/** The official plan always carries the generated badge for its stable rank key. */
export const DEFAULT_RANK_PLAN: readonly RankDefinitionInput[] = BASE_RANK_PLAN.map((rank) => ({
  ...rank,
  badgeImageUrl: rankBadgeSrc(rank.rankKey),
}));

/** Physical rewards always carry their official cutout in every snapshot. */
function rewardImageFor(definition: {
  rankKey: string;
  rewardType: string;
  rewardImageUrl: string | null;
}): string | null {
  if (definition.rewardType !== "PHYSICAL") return null;
  return definition.rewardImageUrl ?? defaultRankRewardImage(definition.rankKey);
}

/** Badges are snapshotted so later uploads never rewrite achieved ranks. */
function badgeImageFor(definition: {
  rankKey: string;
  badgeImageUrl: string | null;
}): string {
  return resolveRankBadgeImageUrl(definition.badgeImageUrl, definition.rankKey);
}

export type RankInvestment = {
  id: string;
  investmentNumber: string;
  referralId: string;
  referralMemberId: string;
  referralName: string;
  profileImage: string | null;
  amountPaisa: Paisa;
  investedAt: Date;
};

export type RankSlot = 1 | 2 | 3;

export type RankQualificationSource = {
  directInvestments: RankInvestment[];
  teamInvestments: Record<RankSlot, RankInvestment[]>;
};

export type TeamSlotResult = {
  slot: RankSlot;
  targetPaisa: Paisa;
  totalPaisa: Paisa;
  qualifyingAt: Date | null;
  qualified: boolean;
};

export type TeamEvaluationResult = {
  qualified: boolean;
  qualifyingAt: Date | null;
  teams: TeamSlotResult[];
  /** The rank's three targets, sorted highest to lowest. They are not tied to slots. */
  requiredTargetsPaisa: [Paisa, Paisa, Paisa];
};

export type RankTargetInput = {
  directTargetPaisa: Paisa;
  team1TargetPaisa: Paisa;
  team2TargetPaisa: Paisa;
  team3TargetPaisa: Paisa;
};

export type RankQualificationResult = {
  directInvestment: RankInvestment | null;
  team: TeamEvaluationResult;
  primaryMethod: "DIRECT_SALES" | "TEAM_SALES" | null;
  secondaryMethod: "DIRECT_SALES" | "TEAM_SALES" | null;
};

/**
 * Direct Sales never combines referrals or investments. The best single
 * personally sponsored investment is the only evidence considered.
 */
export function findQualifyingDirectInvestment(
  investments: readonly RankInvestment[],
  targetPaisa: Paisa,
): RankInvestment | null {
  const best = [...investments].sort((a, b) => {
    if (a.amountPaisa !== b.amountPaisa) return a.amountPaisa > b.amountPaisa ? -1 : 1;
    return a.investedAt.getTime() - b.investedAt.getTime();
  })[0];
  return best && best.amountPaisa >= targetPaisa ? best : null;
}

function comparePaisaDesc(a: Paisa, b: Paisa): number {
  if (a === b) return 0;
  return a > b ? -1 : 1;
}

function sortedTeamTargets(targets: RankTargetInput): [Paisa, Paisa, Paisa] {
  return [
    targets.team1TargetPaisa,
    targets.team2TargetPaisa,
    targets.team3TargetPaisa,
  ].sort(comparePaisaDesc) as [Paisa, Paisa, Paisa];
}

/**
 * Team targets are a set, not slot assignments. Sort both sides highest to
 * lowest so every required minimum is carried by a different, real team.
 * Extra investment in one team can never replace another team's minimum.
 */
export function teamDistributionQualified(
  totals: readonly Paisa[],
  targets: readonly Paisa[],
): boolean {
  if (totals.length !== 3 || targets.length !== 3) return false;
  const orderedTotals = [...totals].sort(comparePaisaDesc);
  const orderedTargets = [...targets].sort(comparePaisaDesc);
  return orderedTotals.every((total, index) => total >= orderedTargets[index]);
}

/**
 * Evaluates all three teams together. Targets may be met by any team; the
 * strongest team carries the largest target, the next strongest the next
 * largest, and so on. The qualifying time is when that whole distribution
 * first existed, not when any one fixed slot reached a fixed number.
 */
export function evaluateTeamSales(
  source: RankQualificationSource,
  targets: RankTargetInput,
): TeamEvaluationResult {
  const requiredTargetsPaisa = sortedTeamTargets(targets);
  const investmentsBySlot = ([1, 2, 3] as const).map((slot) =>
    [...source.teamInvestments[slot]].sort(
      (a, b) =>
        a.investedAt.getTime() - b.investedAt.getTime() || a.id.localeCompare(b.id),
    ),
  );
  const finalTotals = investmentsBySlot.map((investments) =>
    investments.reduce((total, investment) => total + investment.amountPaisa, 0n),
  );

  // Match final team totals to targets for display/evidence only. Qualification
  // itself uses the sorted comparison below and never depends on this mapping.
  const slotOrder = ([1, 2, 3] as const)
    .map((slot, index) => ({ slot, total: finalTotals[index] }))
    .sort((a, b) => comparePaisaDesc(a.total, b.total) || a.slot - b.slot);
  const matchedTargetBySlot: Record<RankSlot, Paisa> = { 1: 0n, 2: 0n, 3: 0n };
  slotOrder.forEach((entry, index) => {
    matchedTargetBySlot[entry.slot] = requiredTargetsPaisa[index];
  });

  const teams = ([1, 2, 3] as const).map((slot): TeamSlotResult => {
    const investments = investmentsBySlot[slot - 1];
    const targetPaisa = matchedTargetBySlot[slot];
    let totalPaisa = 0n;
    let qualifyingAt: Date | null = null;
    for (const investment of investments) {
      totalPaisa += investment.amountPaisa;
      if (qualifyingAt === null && totalPaisa >= targetPaisa) {
        qualifyingAt = investment.investedAt;
      }
    }
    return {
      slot,
      targetPaisa,
      totalPaisa,
      qualifyingAt,
      qualified: qualifyingAt !== null,
    };
  });

  const events = investmentsBySlot
    .flatMap((investments, index) =>
      investments.map((investment) => ({
        at: investment.investedAt.getTime(),
        slot: (index + 1) as RankSlot,
        amountPaisa: investment.amountPaisa,
      })),
    )
    .sort((a, b) => a.at - b.at || a.slot - b.slot);

  const runningTotals: [Paisa, Paisa, Paisa] = [0n, 0n, 0n];
  let qualifyingAt: Date | null = null;
  for (let index = 0; index < events.length; ) {
    const at = events[index].at;
    while (index < events.length && events[index].at === at) {
      runningTotals[events[index].slot - 1] += events[index].amountPaisa;
      index += 1;
    }
    if (teamDistributionQualified(runningTotals, requiredTargetsPaisa)) {
      qualifyingAt = new Date(at);
      break;
    }
  }

  return {
    qualified: qualifyingAt !== null,
    qualifyingAt,
    teams,
    requiredTargetsPaisa,
  };
}

/**
 * Earliest qualifying method is primary. A same-evaluation tie deliberately
 * selects Direct Sales, which is evaluated first.
 */
export function selectPrimaryMethod(
  directAt: Date | null,
  teamAt: Date | null,
): Pick<RankQualificationResult, "primaryMethod" | "secondaryMethod"> {
  if (directAt && teamAt) {
    return directAt.getTime() <= teamAt.getTime()
      ? { primaryMethod: "DIRECT_SALES", secondaryMethod: "TEAM_SALES" }
      : { primaryMethod: "TEAM_SALES", secondaryMethod: "DIRECT_SALES" };
  }
  if (directAt) return { primaryMethod: "DIRECT_SALES", secondaryMethod: null };
  if (teamAt) return { primaryMethod: "TEAM_SALES", secondaryMethod: null };
  return { primaryMethod: null, secondaryMethod: null };
}

export function evaluateRankQualification(
  targets: RankTargetInput,
  source: RankQualificationSource,
): RankQualificationResult {
  const directInvestment = findQualifyingDirectInvestment(
    source.directInvestments,
    targets.directTargetPaisa,
  );
  const team = evaluateTeamSales(source, targets);
  const selection = selectPrimaryMethod(
    directInvestment?.investedAt ?? null,
    team.qualifyingAt,
  );
  return { directInvestment, team, ...selection };
}

function investmentDate(value: {
  verifiedAt: Date | null;
  startDate: Date | null;
  createdAt: Date;
}): Date {
  return value.verifiedAt ?? value.startDate ?? value.createdAt;
}

async function loadQualificationSource(
  client: Client,
  memberId: string,
): Promise<RankQualificationSource> {
  const sponsored = await client.member.findMany({
    where: { sponsorId: memberId, role: "MEMBER" },
    select: {
      id: true,
      memberId: true,
      fullName: true,
      profileImage: true,
      investments: {
        where: { status: { in: [...TEAM_INVESTMENT_STATUSES] } },
        select: {
          id: true,
          investmentNumber: true,
          amountPaisa: true,
          verifiedAt: true,
          startDate: true,
          createdAt: true,
        },
      },
    },
  });

  const directInvestments: RankInvestment[] = sponsored.flatMap((referral) =>
    referral.investments.map((investment) => ({
      id: investment.id,
      investmentNumber: investment.investmentNumber,
      referralId: referral.id,
      referralMemberId: requireMemberId(referral),
      referralName: referral.fullName,
      profileImage: referral.profileImage,
      amountPaisa: investment.amountPaisa,
      investedAt: investmentDate(investment),
    })),
  );

  const children = await client.member.findMany({
    where: {
      placementParentId: memberId,
      placementSlot: { in: [1, 2, 3] },
      role: "MEMBER",
    },
    select: { id: true, placementSlot: true },
  });

  const teamInvestments: Record<RankSlot, RankInvestment[]> = { 1: [], 2: [], 3: [] };
  const ownerByMemberId = new Map<
    string,
    { slot: RankSlot; name: string; memberId: string; profileImage: string | null }
  >();
  const allTeamMemberIds = new Set<string>();

  for (const child of children) {
    if (child.placementSlot !== 1 && child.placementSlot !== 2 && child.placementSlot !== 3) {
      continue;
    }
    const slot = child.placementSlot as RankSlot;
    const descendantIds = await getPlacementDescendantIds(client, child.id);
    const memberRows = await client.member.findMany({
      where: { id: { in: [child.id, ...descendantIds] }, role: "MEMBER" },
      select: { id: true, memberId: true, fullName: true, profileImage: true },
    });
    for (const row of memberRows) {
      ownerByMemberId.set(row.id, {
        slot,
        name: row.fullName,
        memberId: requireMemberId(row),
        profileImage: row.profileImage,
      });
      allTeamMemberIds.add(row.id);
    }
  }

  if (allTeamMemberIds.size > 0) {
    const investments = await client.investment.findMany({
      where: {
        memberId: { in: [...allTeamMemberIds] },
        status: { in: [...TEAM_INVESTMENT_STATUSES] },
      },
      select: {
        id: true,
        investmentNumber: true,
        memberId: true,
        amountPaisa: true,
        verifiedAt: true,
        startDate: true,
        createdAt: true,
      },
    });
    for (const investment of investments) {
      const owner = ownerByMemberId.get(investment.memberId);
      if (!owner) continue;
      teamInvestments[owner.slot].push({
        id: investment.id,
        investmentNumber: investment.investmentNumber,
        referralId: investment.memberId,
        referralMemberId: owner.memberId,
        referralName: owner.name,
        profileImage: owner.profileImage,
        amountPaisa: investment.amountPaisa,
        investedAt: investmentDate(investment),
      });
    }
  }

  return { directInvestments, teamInvestments };
}

async function runInTransaction<T>(
  client: Client,
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  if ("$transaction" in client && typeof client.$transaction === "function") {
    return client.$transaction(fn);
  }
  return fn(client as Prisma.TransactionClient);
}

type PlanWithDefinitions = Prisma.RankPlanVersionGetPayload<{
  include: { definitions: true };
}>;

const planInclude = {
  definitions: { orderBy: { sortOrder: "asc" as const } },
} satisfies Prisma.RankPlanVersionInclude;

/** Creates version 1 once using the exact official chart. */
export async function ensureDefaultRankPlan(client: Client): Promise<PlanWithDefinitions> {
  const active = await client.rankPlanVersion.findFirst({
    where: { isActive: true },
    orderBy: { version: "desc" },
    include: planInclude,
  });
  if (active && active.definitions.length === RANK_KEYS.length) return active;

  const latest = await client.rankPlanVersion.findFirst({
    orderBy: { version: "desc" },
    select: { id: true },
  });
  if (latest) {
    await client.rankPlanVersion.updateMany({ data: { isActive: false } });
    return client.rankPlanVersion.update({
      where: { id: latest.id },
      data: { isActive: true, activatedAt: new Date() },
      include: planInclude,
    });
  }

  try {
    return await client.rankPlanVersion.create({
      data: {
        version: 1,
        isActive: true,
        effectiveFrom: new Date(),
        activatedAt: new Date(),
        note: "Official initial rank plan",
        definitions: {
          create: DEFAULT_RANK_PLAN.map((rank) => ({ ...rank })),
        },
      },
      include: planInclude,
    });
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
    const existing = await client.rankPlanVersion.findFirst({
      where: { isActive: true },
      orderBy: { version: "desc" },
      include: planInclude,
    });
    if (!existing) throw error;
    return existing;
  }
}

export async function getActiveRankPlan(client: Client): Promise<PlanWithDefinitions> {
  return ensureDefaultRankPlan(client);
}

export async function createRankPlanVersion(
  client: Client,
  input: {
    ranks: readonly RankDefinitionInput[];
    note?: string | null;
    actorId?: string | null;
    commitToken?: string | null;
    approvedChanges?: Prisma.InputJsonValue | null;
  },
): Promise<PlanWithDefinitions> {
  return runInTransaction(client, async (tx) => {
    const latest = await tx.rankPlanVersion.findFirst({
      orderBy: { version: "desc" },
      select: { version: true },
    });
    const version = (latest?.version ?? 0) + 1;
    await tx.rankPlanVersion.updateMany({ where: { isActive: true }, data: { isActive: false } });
    const created = await tx.rankPlanVersion.create({
      data: {
        version,
        isActive: true,
        effectiveFrom: new Date(),
        activatedAt: new Date(),
        note: input.note ?? null,
        approvedChanges: input.approvedChanges ?? Prisma.JsonNull,
        commitToken: input.commitToken ?? null,
        createdById: input.actorId ?? null,
        definitions: {
          create: input.ranks.map((rank) => ({
            ...rank,
            rewardDescription: rank.rewardDescription ?? null,
            rewardDescriptionBn: rank.rewardDescriptionBn ?? null,
          })),
        },
      },
      include: planInclude,
    });
    await tx.auditLog.create({
      data: {
        actorId: input.actorId ?? null,
        actorRole: input.actorId ? "ADMIN" : null,
        action: "RANK_PLAN_VERSION_CREATED",
        entityType: "RankPlanVersion",
        entityId: created.id,
        after: {
          version: created.version,
          rankCount: created.definitions.length,
          approvedChanges: (input.approvedChanges ?? []) as Prisma.InputJsonValue,
        },
      },
    });
    return created;
  });
}

function evidenceForDirect(investment: RankInvestment | null) {
  if (!investment) return Prisma.JsonNull;
  return {
    referralMemberId: investment.referralMemberId,
    referralName: investment.referralName,
    investmentId: investment.id,
    investmentNumber: investment.investmentNumber,
    amountPaisa: investment.amountPaisa.toString(),
    investedAt: investment.investedAt.toISOString(),
  } satisfies Prisma.InputJsonValue;
}

function evidenceForTeam(result: TeamEvaluationResult) {
  return {
    team1Paisa: result.teams[0].totalPaisa.toString(),
    team2Paisa: result.teams[1].totalPaisa.toString(),
    team3Paisa: result.teams[2].totalPaisa.toString(),
    qualifyingAt: result.qualifyingAt?.toISOString() ?? null,
    requiredTargetsPaisa: result.requiredTargetsPaisa.map((target) => target.toString()),
    teams: result.teams.map((team) => ({
      slot: team.slot,
      targetPaisa: team.targetPaisa.toString(),
      totalPaisa: team.totalPaisa.toString(),
      qualifyingAt: team.qualifyingAt?.toISOString() ?? null,
    })),
  } satisfies Prisma.InputJsonValue;
}

type AchievementWithPlan = Prisma.RankAchievementGetPayload<{
  include: { planVersion: { select: { version: true } } };
}>;

/** Evaluates every rank independently; all newly qualified ranks are awarded. */
export async function evaluateMemberRanks(
  client: PrismaClient,
  memberId: string,
): Promise<AchievementWithPlan[]> {
  // Rank achievements and their rewards are member-only. A staff or admin
  // account must never be evaluated even when called from an admin job.
  const eligible = await client.member.findFirst({
    where: { id: memberId, role: "MEMBER" },
    select: { id: true },
  });
  if (!eligible) return [];

  const salaryPlan = await getActiveSalaryPlan(client);

  // Reconcile existing data before evaluating new ranks, including members who
  // have already achieved every rank and would otherwise return early.
  await runInTransaction(client, async (tx) => {
    const highest = await findHighestSalaryAchievement(tx, memberId, salaryPlan);
    if (!highest) return;
    await syncSalaryEntitlement(
      tx,
      {
        memberId,
        rankKey: highest.rankKey,
        rankSortOrder: highest.rankSortOrder,
        achievedAt: highest.achievedAt,
        reason: "ALIGNMENT",
      },
      salaryPlan,
    );
  });

  const plan = await ensureDefaultRankPlan(client);
  const existing = await client.rankAchievement.findMany({
    where: { memberId },
    select: { rankKey: true },
  });
  const achievedKeys = new Set(existing.map((row) => row.rankKey));
  if (achievedKeys.size >= plan.definitions.length) return [];

  const source = await loadQualificationSource(client, memberId);
  const created: AchievementWithPlan[] = [];

  for (const definition of plan.definitions) {
    if (achievedKeys.has(definition.rankKey)) continue;
    const result = evaluateRankQualification(definition, source);
    if (!result.primaryMethod) continue;

    const rewardPaisa = definition.rewardSpPaisa ?? 0n;
    const isSpReward = definition.rewardType === "SP";
    let achievement: AchievementWithPlan;
    try {
      achievement = await runInTransaction(client, async (tx) => {
      const now = new Date();
      const row = await tx.rankAchievement.create({
        data: {
          memberId,
          planVersionId: plan.id,
          rankKey: definition.rankKey,
          rankNameSnapshot: definition.name,
          rankNameBnSnapshot: definition.nameBn,
          rankSortOrder: definition.sortOrder,
          achievedAt: now,
          primaryMethod: result.primaryMethod!,
          secondaryMethod: result.secondaryMethod,
          directEvidence: evidenceForDirect(result.directInvestment),
          teamEvidence: evidenceForTeam(result.team),
          targetsSnapshot: {
            directTargetPaisa: definition.directTargetPaisa.toString(),
            team1TargetPaisa: definition.team1TargetPaisa.toString(),
            team2TargetPaisa: definition.team2TargetPaisa.toString(),
            team3TargetPaisa: definition.team3TargetPaisa.toString(),
          } satisfies Prisma.InputJsonValue,
          rewardType: definition.rewardType,
          rewardSpPaisa: isSpReward ? rewardPaisa : null,
          rewardLabel: isSpReward ? null : definition.rewardLabel,
          rewardLabelBn: isSpReward ? null : definition.rewardLabelBn,
          rewardDescriptionSnapshot: isSpReward ? null : definition.rewardDescription,
          rewardDescriptionBnSnapshot: isSpReward ? null : definition.rewardDescriptionBn,
          badgeImageUrl: badgeImageFor(definition),
          rewardImageUrl: rewardImageFor(definition),
          rewardStatus: isSpReward && rewardPaisa > 0n ? "ACHIEVED" : "PENDING",
        },
      });

      // syncSalaryEntitlement reads the member's highest achieved rank inside
      // this transaction, so the entitlement can never drift from it.
      await syncSalaryEntitlement(
        tx,
        {
          memberId,
          rankKey: row.rankKey,
          rankSortOrder: row.rankSortOrder,
          achievedAt: row.achievedAt,
        },
        salaryPlan,
      );

      if (isSpReward && rewardPaisa > 0n) {
        await tx.wallet.upsert({
          where: { memberId },
          create: { memberId },
          update: {},
        });
        const balance = await adjustWalletField(tx, memberId, "rankRewardPaisa", rewardPaisa, "CREDIT");
        const idempotencyKey = makeKey("rank-reward", row.id, "credit");
        await recordLedgerEntry(tx, {
          walletId: balance.walletId,
          memberId,
          category: "RANK_REWARD",
          direction: "CREDIT",
          amountPaisa: rewardPaisa,
          balanceAfterPaisa: balance.balanceAfterPaisa,
          type: "RANK_REWARD_CREDIT",
          idempotencyKey,
          referenceType: "RankAchievement",
          referenceId: row.id,
          description: `Rank reward: ${definition.name}`,
          createdBy: undefined,
        });
        await tx.rankRewardEvent.create({
          data: {
            achievementId: row.id,
            type: "SP_CREDIT",
            amountPaisa: rewardPaisa,
            referenceType: "LedgerEntry",
            referenceId: idempotencyKey,
          },
        });
        await tx.rankAchievement.update({
          where: { id: row.id },
          data: { walletCreditedAt: now },
        });
      }

      await tx.auditLog.create({
        data: {
          actorId: null,
          actorRole: null,
          action: "RANK_ACHIEVED",
          entityType: "RankAchievement",
          entityId: row.id,
          after: {
            memberId,
            rankKey: row.rankKey,
            rankName: row.rankNameSnapshot,
            primaryMethod: row.primaryMethod,
            secondaryMethod: row.secondaryMethod,
            rewardType: row.rewardType,
            rewardStatus: isSpReward && rewardPaisa > 0n ? "ACHIEVED" : "PENDING",
          },
        },
      });

      return tx.rankAchievement.findUniqueOrThrow({
        where: { id: row.id },
        include: { planVersion: { select: { version: true } } },
      });
      });
    } catch (error) {
      // Another evaluation may have awarded this rank concurrently. It is
      // already immutable, so there is nothing left to do for this rank.
      if (!isUniqueViolation(error)) throw error;
      continue;
    }
    created.push(achievement);
    achievedKeys.add(definition.rankKey);
  }

  return created;
}

/** An approved investment can affect the investor, sponsor and placement uplines. */
export async function getRankEvaluationMemberIdsForInvestment(
  client: PrismaClient,
  investmentId: string,
): Promise<string[]> {
  const investment = await client.investment.findUnique({
    where: { id: investmentId },
    select: { memberId: true },
  });
  if (!investment) return [];

  const member = await client.member.findUnique({
    where: { id: investment.memberId, role: "MEMBER" },
    select: { sponsorId: true, placementParentId: true },
  });
  if (!member) return [];

  const ids = new Set<string>([investment.memberId]);
  if (member.sponsorId) {
    const sponsor = await client.member.findUnique({
      where: { id: member.sponsorId, role: "MEMBER" },
      select: { id: true },
    });
    if (sponsor) ids.add(member.sponsorId);
  }

  let parentId = member.placementParentId;
  let depth = 0;
  while (parentId && depth < 100) {
    const parent = await client.member.findUnique({
      where: { id: parentId, role: "MEMBER" },
      select: { placementParentId: true },
    });
    if (!parent) break;
    ids.add(parentId);
    parentId = parent.placementParentId;
    depth += 1;
  }
  return [...ids];
}

export async function evaluateRanksForInvestment(
  client: PrismaClient,
  investmentId: string,
): Promise<number> {
  const memberIds = await getRankEvaluationMemberIdsForInvestment(client, investmentId);
  let count = 0;
  for (const memberId of memberIds) {
    const created = await evaluateMemberRanks(client, memberId);
    count += created.length;
  }
  return count;
}

export async function evaluateAllMembers(client: PrismaClient): Promise<number> {
  const members = await client.member.findMany({
    where: { role: "MEMBER" },
    select: { id: true },
  });
  let count = 0;
  for (const member of members) {
    count += (await evaluateMemberRanks(client, member.id)).length;
  }
  return count;
}

export async function markPhysicalRewardCollected(
  client: PrismaClient,
  achievementId: string,
  actorId: string,
  note?: string | null,
): Promise<AchievementWithPlan | null> {
  return client.$transaction(async (tx) => {
    const achievement = await tx.rankAchievement.findUnique({
      where: { id: achievementId },
      select: { rewardType: true, rewardStatus: true },
    });
    if (!achievement || achievement.rewardType !== "PHYSICAL") return null;
    if (achievement.rewardStatus === "ACHIEVED") {
      return tx.rankAchievement.findUniqueOrThrow({
        where: { id: achievementId },
        include: { planVersion: { select: { version: true } } },
      });
    }

    await tx.rankAchievement.update({
      where: { id: achievementId },
      data: {
        rewardStatus: "ACHIEVED",
        physicalCollectedAt: new Date(),
        physicalCollectedById: actorId,
        note: note ?? null,
      },
    });
    await tx.rankRewardEvent.create({
      data: {
        achievementId,
        type: "PHYSICAL_COLLECTION",
        referenceType: "Member",
        referenceId: actorId,
        actorId,
        note: note ?? null,
      },
    });
    await tx.auditLog.create({
      data: {
        actorId,
        actorRole: "ADMIN",
        action: "RANK_PHYSICAL_REWARD_COLLECTED",
        entityType: "RankAchievement",
        entityId: achievementId,
        after: { rewardStatus: "ACHIEVED", collectedBy: actorId },
      },
    });
    return tx.rankAchievement.findUniqueOrThrow({
      where: { id: achievementId },
      include: { planVersion: { select: { version: true } } },
    });
  });
}

/* ---------- Serialized DTOs for pages and APIs ---------- */

export type RankRowDto = {
  rankKey: RankKey;
  sortOrder: number;
  name: string;
  nameBn: string | null;
  directTargetPaisa: string;
  team1TargetPaisa: string;
  team2TargetPaisa: string;
  team3TargetPaisa: string;
  /** The same three targets sorted highest to lowest, for slot-free display. */
  teamTargetsPaisa: [string, string, string];
  rewardType: "SP" | "PHYSICAL";
  rewardSpPaisa: string | null;
  rewardLabel: string | null;
  rewardLabelBn: string | null;
  badgeImageUrl: string;
  rewardImageUrl: string | null;
  status: "NOT_ACHIEVED" | "PENDING" | "ACHIEVED";
  directQualified: boolean;
  teamQualified: boolean;
  directProgressPaisa: string;
  teamProgressPaisa: [string, string, string];
  primaryMethod: "DIRECT_SALES" | "TEAM_SALES" | null;
  secondaryMethod: "DIRECT_SALES" | "TEAM_SALES" | null;
  achievedAt: string | null;
};

export type RankHistoryDto = {
  id: string;
  rankKey: string;
  rankName: string;
  rankNameBn: string | null;
  sortOrder: number;
  planVersion: number;
  achievedAt: string;
  primaryMethod: string;
  secondaryMethod: string | null;
  rewardType: "SP" | "PHYSICAL";
  rewardSpPaisa: string | null;
  rewardLabel: string | null;
  rewardLabelBn: string | null;
  badgeImageUrl: string;
  rewardImageUrl: string | null;
  rewardStatus: "PENDING" | "ACHIEVED";
  directEvidence: Prisma.JsonValue | null;
  teamEvidence: Prisma.JsonValue | null;
  targetsSnapshot: Prisma.JsonValue;
};

export type RankRewardDto = {
  type: "SP" | "PHYSICAL";
  amountPaisa: string | null;
  label: string | null;
  labelBn: string | null;
  imageUrl: string | null;
};

export type NextRankDto = {
  rankKey: RankKey;
  sortOrder: number;
  name: string;
  nameBn: string | null;
  badgeImageUrl: string;
  reward: RankRewardDto;
  directTargetPaisa: string;
  /** Sorted highest to lowest; no target is tied to a team slot. */
  teamTargetsPaisa: [string, string, string];
  teamTotalsPaisa: [string, string, string];
  teamQualified: boolean;
  directQualified: boolean;
};

export type MemberRankDto = {
  planVersion: number;
  generatedAt: string;
  currentRank: {
    rankKey: string;
    name: string;
    nameBn: string | null;
    rewardType: "SP" | "PHYSICAL";
    rewardLabel: string | null;
    rewardLabelBn: string | null;
    badgeImageUrl: string;
    rewardImageUrl: string | null;
    reward: RankRewardDto;
    status: "PENDING" | "ACHIEVED";
    achievedAt: string;
  } | null;
  /** The lowest unachieved rank; all overview progress belongs to this rank. */
  nextRank: NextRankDto | null;
  progress: {
    bestDirectInvestment: {
      referralMemberId: string;
      referralName: string;
      profileImage: string | null;
      investmentNumber: string;
      amountPaisa: string;
      investedAt: string;
    } | null;
    teamTotals: [string, string, string];
  };
  ranks: RankRowDto[];
  history: RankHistoryDto[];
};

function evidenceRecord(value: Prisma.JsonValue | null): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const result: Record<string, string> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (typeof entry === "string") result[key] = entry;
    else if (entry === null) result[key] = "";
  }
  return result;
}

export async function getMemberRankData(
  client: PrismaClient,
  memberId: string,
): Promise<MemberRankDto> {
  const plan = await ensureDefaultRankPlan(client);
  const [source, achievements] = await Promise.all([
    loadQualificationSource(client, memberId),
    client.rankAchievement.findMany({
      where: { memberId },
      orderBy: { rankSortOrder: "asc" },
      include: { planVersion: { select: { version: true } } },
    }),
  ]);

  const achievementByKey = new Map(achievements.map((row) => [row.rankKey, row]));
  const bestDirect = findQualifyingDirectInvestment(source.directInvestments, 0n);
  const teamTotals = ([1, 2, 3] as const).map((slot) =>
    source.teamInvestments[slot].reduce((total, investment) => total + investment.amountPaisa, 0n),
  ) as [Paisa, Paisa, Paisa];

  const ranks: RankRowDto[] = plan.definitions.map((definition) => {
    const evaluation = evaluateRankQualification(definition, source);
    const achievement = achievementByKey.get(definition.rankKey);
    return {
      rankKey: definition.rankKey as RankKey,
      sortOrder: definition.sortOrder,
      name: definition.name,
      nameBn: definition.nameBn,
      directTargetPaisa: definition.directTargetPaisa.toString(),
      team1TargetPaisa: definition.team1TargetPaisa.toString(),
      team2TargetPaisa: definition.team2TargetPaisa.toString(),
      team3TargetPaisa: definition.team3TargetPaisa.toString(),
      teamTargetsPaisa: evaluation.team.requiredTargetsPaisa.map((target) =>
        target.toString(),
      ) as [string, string, string],
      rewardType: definition.rewardType as "SP" | "PHYSICAL",
      rewardSpPaisa: definition.rewardSpPaisa?.toString() ?? null,
      rewardLabel: definition.rewardLabel,
      rewardLabelBn: definition.rewardLabelBn,
      badgeImageUrl: badgeImageFor(definition),
      rewardImageUrl: rewardImageFor(definition),
      status: achievement?.rewardStatus ?? "NOT_ACHIEVED",
      directQualified: evaluation.directInvestment !== null,
      teamQualified: evaluation.team.qualified,
      directProgressPaisa: (evaluation.directInvestment?.amountPaisa ?? 0n).toString(),
      teamProgressPaisa: [
        evaluation.team.teams[0].totalPaisa.toString(),
        evaluation.team.teams[1].totalPaisa.toString(),
        evaluation.team.teams[2].totalPaisa.toString(),
      ],
      primaryMethod: achievement?.primaryMethod ?? null,
      secondaryMethod: achievement?.secondaryMethod ?? null,
      achievedAt: achievement?.achievedAt.toISOString() ?? null,
    };
  });

  const current = achievements.at(-1) ?? null;
  const nextDefinition =
    plan.definitions.find((definition) => !achievementByKey.has(definition.rankKey)) ?? null;
  const nextEvaluation = nextDefinition
    ? evaluateRankQualification(nextDefinition, source)
    : null;
  const nextRank: NextRankDto | null =
    nextDefinition && nextEvaluation
      ? {
          rankKey: nextDefinition.rankKey as RankKey,
          sortOrder: nextDefinition.sortOrder,
          name: nextDefinition.name,
          nameBn: nextDefinition.nameBn,
          badgeImageUrl: badgeImageFor(nextDefinition),
          reward: {
            type: nextDefinition.rewardType as "SP" | "PHYSICAL",
            amountPaisa: nextDefinition.rewardSpPaisa?.toString() ?? null,
            label: nextDefinition.rewardLabel,
            labelBn: nextDefinition.rewardLabelBn,
            imageUrl: rewardImageFor(nextDefinition),
          },
          directTargetPaisa: nextDefinition.directTargetPaisa.toString(),
          teamTargetsPaisa: nextEvaluation.team.requiredTargetsPaisa.map((target) =>
            target.toString(),
          ) as [string, string, string],
          teamTotalsPaisa: nextEvaluation.team.teams.map((team) =>
            team.totalPaisa.toString(),
          ) as [string, string, string],
          teamQualified: nextEvaluation.team.qualified,
          directQualified: nextEvaluation.directInvestment !== null,
        }
      : null;

  return {
    planVersion: plan.version,
    generatedAt: new Date().toISOString(),
    currentRank: current
      ? {
          rankKey: current.rankKey,
          name: current.rankNameSnapshot,
          nameBn: current.rankNameBnSnapshot,
          rewardType: current.rewardType as "SP" | "PHYSICAL",
          rewardLabel: current.rewardLabel,
          rewardLabelBn: current.rewardLabelBn,
          badgeImageUrl: badgeImageFor(current),
          rewardImageUrl: rewardImageFor(current),
          reward: {
            type: current.rewardType as "SP" | "PHYSICAL",
            amountPaisa: current.rewardSpPaisa?.toString() ?? null,
            label: current.rewardLabel,
            labelBn: current.rewardLabelBn,
            imageUrl: rewardImageFor(current),
          },
          status: current.rewardStatus as "PENDING" | "ACHIEVED",
          achievedAt: current.achievedAt.toISOString(),
        }
      : null,
    nextRank,
    progress: {
      bestDirectInvestment: bestDirect
        ? {
            referralMemberId: bestDirect.referralMemberId,
            referralName: bestDirect.referralName,
            profileImage: bestDirect.profileImage,
            investmentNumber: bestDirect.investmentNumber,
            amountPaisa: bestDirect.amountPaisa.toString(),
            investedAt: bestDirect.investedAt.toISOString(),
          }
        : null,
      teamTotals: [teamTotals[0].toString(), teamTotals[1].toString(), teamTotals[2].toString()],
    },
    ranks,
    history: achievements.map((row) => ({
      id: row.id,
      rankKey: row.rankKey,
      rankName: row.rankNameSnapshot,
      rankNameBn: row.rankNameBnSnapshot,
      sortOrder: row.rankSortOrder,
      planVersion: row.planVersion.version,
      achievedAt: row.achievedAt.toISOString(),
      primaryMethod: String(row.primaryMethod),
      secondaryMethod: row.secondaryMethod ? String(row.secondaryMethod) : null,
      rewardType: row.rewardType as "SP" | "PHYSICAL",
      rewardSpPaisa: row.rewardSpPaisa?.toString() ?? null,
      rewardLabel: row.rewardLabel,
      rewardLabelBn: row.rewardLabelBn,
      badgeImageUrl: badgeImageFor(row),
      rewardImageUrl: rewardImageFor(row),
      rewardStatus: row.rewardStatus as "PENDING" | "ACHIEVED",
      directEvidence: row.directEvidence,
      teamEvidence: row.teamEvidence,
      targetsSnapshot: row.targetsSnapshot,
    })),
  };
}

export function serializeEvidence(value: Prisma.JsonValue | null): Record<string, string> {
  return evidenceRecord(value);
}
