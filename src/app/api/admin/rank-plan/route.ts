import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import type { Prisma } from "@/generated/prisma/client";
import { buildRankPlanDiff } from "@/lib/rank-plan-diff";
import { definitionToDto, type RankPlanDefinitionDto } from "@/lib/rank-plan-dto";
import {
  defaultRankRewardImage,
  isAllowedRankBadgeImageUrl,
  isAllowedRankRewardImageUrl,
  rankBadgeSrc,
} from "@/lib/rank-art";
import { spToPaisa } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import { isUniqueViolation } from "@/lib/services/ledger";
import {
  createRankPlanVersion,
  ensureDefaultRankPlan,
  evaluateAllMembers,
  RANK_KEYS,
  type RankDefinitionInput,
} from "@/lib/services/rank-rewards";

export const dynamic = "force-dynamic";

const amount = z.string().trim().regex(/^\d+(\.\d{1,2})?$/);
const optionalText = z.string().trim().max(300).optional().nullable();
const rankKey = z.enum(RANK_KEYS);

const schema = z.object({
  note: z.string().trim().max(500).optional().nullable(),
  adminPassword: z.string().min(1).max(200),
  commitToken: z.string().uuid(),
  ranks: z
    .array(
      z.object({
        rankKey,
        sortOrder: z.number().int().min(1).max(9),
        name: z.string().trim().min(1).max(80),
        nameBn: z.string().trim().max(80).optional().nullable(),
        directTarget: amount,
        team1Target: amount,
        team2Target: amount,
        team3Target: amount,
        rewardType: z.enum(["SP", "PHYSICAL"]),
        rewardSp: amount.optional().nullable(),
        rewardLabel: z.string().trim().max(80).optional().nullable(),
        rewardLabelBn: z.string().trim().max(80).optional().nullable(),
        rewardDescription: optionalText,
        rewardDescriptionBn: optionalText,
        badgeImageUrl: z.string().trim().max(300).optional().nullable(),
        rewardImageUrl: z.string().trim().max(300).optional().nullable(),
      }),
    )
    .length(9),
});

const planInclude = {
  definitions: { orderBy: { sortOrder: "asc" as const } },
  createdBy: { select: { memberId: true, fullName: true } },
} satisfies Prisma.RankPlanVersionInclude;

export async function GET() {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  await ensureDefaultRankPlan(prisma);
  const [versions, achievements] = await Promise.all([
    prisma.rankPlanVersion.findMany({
      orderBy: { version: "desc" },
      include: planInclude,
    }),
    prisma.rankAchievement.findMany({
      orderBy: { achievedAt: "desc" },
      include: {
        member: { select: { memberId: true, fullName: true } },
        planVersion: { select: { version: true } },
      },
    }),
  ]);

  const serializedVersions = versions.map((version) => ({
    ...version,
    definitions: version.definitions.map((definition) => ({
      ...definition,
      directTargetPaisa: definition.directTargetPaisa.toString(),
      team1TargetPaisa: definition.team1TargetPaisa.toString(),
      team2TargetPaisa: definition.team2TargetPaisa.toString(),
      team3TargetPaisa: definition.team3TargetPaisa.toString(),
      rewardSpPaisa: definition.rewardSpPaisa?.toString() ?? null,
    })),
  }));
  const serializedAchievements = achievements.map((achievement) => ({
    ...achievement,
    rewardSpPaisa: achievement.rewardSpPaisa?.toString() ?? null,
  }));

  return NextResponse.json({ versions: serializedVersions, achievements: serializedAchievements });
}

export async function POST(request: Request) {
  const session = await auth();
  if (session?.user?.role !== "ADMIN" || !session.user.id) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Please check the rank values" }, { status: 400 });
  }

  const keys = parsed.data.ranks.map((rank) => rank.rankKey);
  const orders = parsed.data.ranks.map((rank) => rank.sortOrder);
  if (
    new Set(keys).size !== RANK_KEYS.length ||
    new Set(orders).size !== RANK_KEYS.length ||
    keys.some((key) => !RANK_KEYS.includes(key))
  ) {
    return NextResponse.json({ error: "Invalid rank keys" }, { status: 400 });
  }

  const invalidReward = parsed.data.ranks.some((rank) =>
    rank.rewardType === "SP" ? !rank.rewardSp : !rank.rewardLabel,
  );
  const invalidImage = parsed.data.ranks.some(
    (rank) =>
      (rank.rewardType === "PHYSICAL" &&
        Boolean(rank.rewardImageUrl) &&
        !isAllowedRankRewardImageUrl(rank.rewardImageUrl)) ||
      (Boolean(rank.badgeImageUrl) && !isAllowedRankBadgeImageUrl(rank.badgeImageUrl)),
  );
  if (invalidReward || invalidImage) {
    return NextResponse.json({ error: "Invalid rank artwork" }, { status: 400 });
  }

  const admin = await prisma.member.findUnique({
    where: { id: session.user.id },
    select: { passwordHash: true },
  });
  if (!admin || !(await bcrypt.compare(parsed.data.adminPassword, admin.passwordHash))) {
    return NextResponse.json({ error: "INVALID_ADMIN_PASSWORD" }, { status: 401 });
  }

  const token = parsed.data.commitToken;
  const existing = await prisma.rankPlanVersion.findUnique({
    where: { commitToken: token },
    include: planInclude,
  });
  if (existing) {
    if (existing.createdById !== session.user.id) {
      return NextResponse.json({ error: "DUPLICATE_COMMIT" }, { status: 409 });
    }
    return NextResponse.json({
      duplicate: true,
      version: existing.version,
      active: existing.definitions.map(definitionToDto),
    });
  }

  const activeVersion = await prisma.rankPlanVersion.findFirst({
    where: { isActive: true },
    orderBy: { version: "desc" },
    include: planInclude,
  });
  if (!activeVersion) {
    return NextResponse.json({ error: "RANK_PLAN_FAILED" }, { status: 500 });
  }

  const proposedRows: RankPlanDefinitionDto[] = parsed.data.ranks.map((rank) => ({
    id: `proposed-${rank.rankKey}`,
    rankKey: rank.rankKey,
    sortOrder: rank.sortOrder,
    name: rank.name,
    nameBn: rank.nameBn ?? null,
    directTarget: rank.directTarget,
    team1Target: rank.team1Target,
    team2Target: rank.team2Target,
    team3Target: rank.team3Target,
    rewardType: rank.rewardType,
    rewardSp: rank.rewardSp ?? "",
    rewardLabel: rank.rewardType === "PHYSICAL" ? (rank.rewardLabel ?? null) : null,
    rewardLabelBn: rank.rewardType === "PHYSICAL" ? (rank.rewardLabelBn ?? null) : null,
    rewardDescription: rank.rewardType === "PHYSICAL" ? (rank.rewardDescription ?? null) : null,
    rewardDescriptionBn:
      rank.rewardType === "PHYSICAL" ? (rank.rewardDescriptionBn ?? null) : null,
    badgeImageUrl: rank.badgeImageUrl ?? rankBadgeSrc(rank.rankKey),
    rewardImageUrl:
      rank.rewardType === "PHYSICAL"
        ? (rank.rewardImageUrl ?? defaultRankRewardImage(rank.rankKey))
        : null,
  }));

  const changes = buildRankPlanDiff(
    activeVersion.definitions.map(definitionToDto),
    proposedRows,
  );

  const ranks: RankDefinitionInput[] = parsed.data.ranks.map((rank) => ({
    rankKey: rank.rankKey,
    sortOrder: rank.sortOrder,
    name: rank.name,
    nameBn: rank.nameBn ?? null,
    directTargetPaisa: spToPaisa(rank.directTarget),
    team1TargetPaisa: spToPaisa(rank.team1Target),
    team2TargetPaisa: spToPaisa(rank.team2Target),
    team3TargetPaisa: spToPaisa(rank.team3Target),
    rewardType: rank.rewardType,
    rewardSpPaisa: rank.rewardType === "SP" ? spToPaisa(rank.rewardSp!) : null,
    rewardLabel: rank.rewardType === "PHYSICAL" ? rank.rewardLabel! : null,
    rewardLabelBn: rank.rewardType === "PHYSICAL" ? (rank.rewardLabelBn ?? null) : null,
    rewardDescription: rank.rewardType === "PHYSICAL" ? (rank.rewardDescription ?? null) : null,
    rewardDescriptionBn:
      rank.rewardType === "PHYSICAL" ? (rank.rewardDescriptionBn ?? null) : null,
    badgeImageUrl: rank.badgeImageUrl ?? rankBadgeSrc(rank.rankKey),
    rewardImageUrl:
      rank.rewardType === "PHYSICAL"
        ? (rank.rewardImageUrl ?? defaultRankRewardImage(rank.rankKey))
        : null,
  }));

  try {
    const created = await prisma.$transaction(async (tx) => {
      const raced = await tx.rankPlanVersion.findUnique({
        where: { commitToken: token },
        select: { id: true },
      });
      if (raced) throw new Error("DUPLICATE_COMMIT");

      return createRankPlanVersion(tx, {
        ranks,
        note: parsed.data.note ?? null,
        actorId: session.user.id,
        commitToken: token,
        approvedChanges: changes as unknown as Prisma.InputJsonValue,
      });
    });
    const awarded = await evaluateAllMembers(prisma);

    return NextResponse.json(
      {
        duplicate: false,
        version: created.version,
        awardedCount: awarded,
        changes: changes.length,
        active: created.definitions.map(definitionToDto),
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof Error && error.message === "DUPLICATE_COMMIT") {
      const raced = await prisma.rankPlanVersion.findUnique({
        where: { commitToken: token },
        include: planInclude,
      });
      if (raced) {
        return NextResponse.json({ duplicate: true, version: raced.version });
      }
    }
    if (isUniqueViolation(error)) {
      const raced = await prisma.rankPlanVersion.findUnique({
        where: { commitToken: token },
        include: planInclude,
      });
      if (raced) {
        return NextResponse.json({ duplicate: true, version: raced.version });
      }
    }
    console.error("Rank plan save failed", error);
    return NextResponse.json({ error: "RANK_PLAN_FAILED" }, { status: 500 });
  }
}
