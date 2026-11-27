import { Prisma, type PrismaClient } from "../../generated/prisma/client";
import {
  DEFAULT_SALARY_PLAN,
  isSalaryRankKey,
  isSalaryRankEnabled,
  SALARY_RANK_CONFIG,
  SALARY_RANK_KEYS,
  totalSalaryAllocationBps,
  type SalaryPlan,
  type SalaryRankConfig,
  type SalaryRankKey,
} from "../salary";
import {
  findHighestSalaryAchievement,
  syncSalaryEntitlement,
} from "./salary-entitlements";

type Client = PrismaClient | Prisma.TransactionClient;

async function runInTransaction<T>(
  client: Client,
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  if ("$transaction" in client && typeof client.$transaction === "function") {
    return client.$transaction(fn);
  }
  return fn(client as Prisma.TransactionClient);
}

export const salaryPlanInclude = {
  definitions: { orderBy: { sortOrder: "asc" as const } },
} satisfies Prisma.SalaryPlanVersionInclude;

type PlanWithDefinitions = Prisma.SalaryPlanVersionGetPayload<{
  include: typeof salaryPlanInclude;
}>;

async function ensureTreasuries(
  client: Prisma.TransactionClient,
  rankKeys: readonly string[],
): Promise<void> {
  for (const rankKey of rankKeys) {
    await client.salaryTreasury.upsert({
      where: { rankKey },
      create: {
        rankKey,
        balancePaisa: 0n,
        totalAllocatedPaisa: 0n,
        totalPaidPaisa: 0n,
      },
      update: {},
    });
  }
}

export function planFromVersion(version: PlanWithDefinitions): SalaryPlan {
  const configs: Record<SalaryRankKey, SalaryRankConfig> = { ...SALARY_RANK_CONFIG };
  for (const definition of version.definitions) {
    if (!isSalaryRankKey(definition.rankKey)) continue;
    const fallback = SALARY_RANK_CONFIG[definition.rankKey];
    configs[definition.rankKey] = {
      ...fallback,
      isEnabled: definition.isEnabled,
      allocationBps: definition.allocationBps,
      maxWeeklySalaryPaisa: definition.maxWeeklySalaryPaisa,
      maxWeeks: definition.maxWeeks,
    };
  }
  return {
    version: version.version,
    versionId: version.id,
    configs,
  };
}

/** Creates version 1 from the official locked values if no plan exists yet. */
export async function ensureDefaultSalaryPlan(client: Client): Promise<SalaryPlan> {
  const active = await client.salaryPlanVersion.findFirst({
    where: { isActive: true },
    include: salaryPlanInclude,
  });
  if (active) return planFromVersion(active);

  const latest = await client.salaryPlanVersion.findFirst({
    orderBy: { version: "desc" },
    select: { id: true, version: true },
  });
  if (latest) {
    const now = new Date();
    await client.salaryPlanVersion.updateMany({
      where: { id: { not: latest.id }, isActive: true },
      data: { isActive: false },
    });
    await client.salaryPlanVersion.update({
      where: { id: latest.id },
      data: { isActive: true, activatedAt: now },
    });
    const reactivated = await client.salaryPlanVersion.findUniqueOrThrow({
      where: { id: latest.id },
      include: salaryPlanInclude,
    });
    return planFromVersion(reactivated);
  }

  return runInTransaction(client, async (tx) => {
    const version = 1;
    await tx.salaryPlanVersion.create({
      data: {
        id: "salary-plan-version:1",
        version,
        isActive: true,
        activatedAt: new Date(),
        note: "Official initial salary plan",
        definitions: {
          create: SALARY_RANK_KEYS.map((rankKey) => {
            const config = SALARY_RANK_CONFIG[rankKey];
            return {
              id: `salary-plan-definition:1:${rankKey}`,
              rankKey,
              sortOrder: config.sortOrder,
              isEnabled: config.isEnabled,
              allocationBps: config.allocationBps,
              maxWeeklySalaryPaisa: config.maxWeeklySalaryPaisa,
              maxWeeks: config.maxWeeks,
            };
          }),
        },
      },
    });
    await ensureTreasuries(tx, [...SALARY_RANK_KEYS]);
    const created = await tx.salaryPlanVersion.findUniqueOrThrow({
      where: { version },
      include: salaryPlanInclude,
    });
    return planFromVersion(created);
  });
}

export async function getActiveSalaryPlan(client: Client): Promise<SalaryPlan> {
  return ensureDefaultSalaryPlan(client);
}

export type SalaryPlanDefinitionInput = {
  readonly rankKey: SalaryRankKey;
  readonly sortOrder: number;
  readonly isEnabled: boolean;
  readonly allocationBps: number;
  readonly maxWeeklySalaryPaisa: bigint;
  readonly maxWeeks: number | null;
};

/** Saves a new active version. Older versions stay immutable for auditability. */
export async function createSalaryPlanVersion(
  client: Client,
  input: {
    readonly definitions: readonly SalaryPlanDefinitionInput[];
    readonly note?: string | null;
    readonly actorId?: string | null;
    readonly effectiveFrom?: Date;
    readonly approvedChanges?: Prisma.InputJsonValue;
    readonly commitToken?: string;
    readonly expectedVersion?: number;
  },
): Promise<SalaryPlan> {
  return runInTransaction(client, async (tx) => {
    const latest = await tx.salaryPlanVersion.findFirst({
      orderBy: { version: "desc" },
      select: { version: true },
    });
    const currentVersion = latest?.version ?? 0;
    if (input.expectedVersion !== undefined && input.expectedVersion !== currentVersion) {
      throw new Error("STALE_VERSION");
    }
    const nextVersion = currentVersion + 1;
    const created = await tx.salaryPlanVersion.create({
      data: {
        version: nextVersion,
        isActive: true,
        effectiveFrom: input.effectiveFrom ?? new Date(),
        activatedAt: new Date(),
        note: input.note ?? null,
        approvedChanges: input.approvedChanges ?? Prisma.JsonNull,
        commitToken: input.commitToken ?? null,
        createdById: input.actorId ?? null,
        definitions: {
          create: input.definitions.map((definition) => ({
            rankKey: definition.rankKey,
            sortOrder: definition.sortOrder,
            isEnabled: definition.isEnabled,
            allocationBps: definition.allocationBps,
            maxWeeklySalaryPaisa: definition.maxWeeklySalaryPaisa,
            maxWeeks: definition.maxWeeks,
          })),
        },
      },
    });
    await tx.salaryPlanVersion.updateMany({
      where: { id: { not: created.id }, isActive: true },
      data: { isActive: false },
    });
    await ensureTreasuries(
      tx,
      input.definitions
        .filter(
          (definition) =>
            definition.isEnabled &&
            definition.allocationBps > 0 &&
            definition.maxWeeklySalaryPaisa > 0n,
        )
        .map((definition) => definition.rankKey),
    );
    const saved = await tx.salaryPlanVersion.findUniqueOrThrow({
      where: { id: created.id },
      include: salaryPlanInclude,
    });
    return planFromVersion(saved);
  });
}

/** Reconciles every member's single entitlement with a newly saved plan. */
export async function alignAllSalaryEntitlements(
  client: Client,
  plan: SalaryPlan = DEFAULT_SALARY_PLAN,
): Promise<number> {
  const members = await client.member.findMany({
    select: { id: true },
    orderBy: { memberId: "asc" },
  });
  let changed = 0;
  for (const member of members) {
    const highest = await findHighestSalaryAchievement(client, member.id, plan);
    if (
      await syncSalaryEntitlement(
        client,
        {
          memberId: member.id,
          rankKey: highest?.rankKey ?? "",
          rankSortOrder: highest?.rankSortOrder ?? 0,
          achievedAt: highest?.achievedAt ?? new Date(0),
          reason: "PLAN_UPDATE",
        },
        plan,
      )
    ) {
      changed += 1;
    }
  }
  return changed;
}

function bpsToPercent(bps: number): string {
  return (bps / 100).toString();
}

function paisaToSp(value: bigint): string {
  const whole = value / 100n;
  const fraction = value % 100n;
  return fraction === 0n
    ? whole.toString()
    : `${whole.toString()}.${fraction.toString().padStart(2, "0")}`;
}

export type SalaryPlanRankDto = {
  rankKey: SalaryRankKey;
  sortOrder: number;
  isEnabled: boolean;
  defaultName: string;
  defaultNameBn: string;
  /** Active Rank Plan labels; falls back to the salary defaults. */
  name: string;
  nameBn: string;
  badgeImageUrl: string | null;
  allocationPercent: string;
  maxWeeklySalary: string;
  maxWeeks: string | null;
  /** True only when the toggle is on and both values are payable. */
  enabled: boolean;
};

export type SalaryPlanChangeDto = {
  id: string;
  scope: "rank" | "plan";
  rankKey: string;
  rankLabel: string;
  settingKey: "isEnabled" | "allocation" | "weeklyCap" | "duration" | "effectiveFrom";
  previous: string;
  next: string;
};

export type SalaryPlanActorDto = {
  memberId: string | null;
  email: string | null;
  name: string;
} | null;

export type SalaryPlanDto = {
  version: number | null;
  versionId: string | null;
  effectiveFrom: string | null;
  activatedAt: string | null;
  createdAt: string | null;
  createdBy: SalaryPlanActorDto;
  note: string | null;
  approvedChanges: readonly SalaryPlanChangeDto[];
  totalAllocationBps: number;
  enabledRanks: readonly SalaryRankKey[];
  ranks: readonly SalaryPlanRankDto[];
};

export type SalaryPlanMeta = {
  effectiveFrom?: Date | null;
  activatedAt?: Date | null;
  createdAt?: Date | null;
  createdBy?: { memberId: string | null; fullName: string; email?: string | null } | null;
  note?: string | null;
  approvedChanges?: unknown;
};

function toIso(value: Date | null | undefined): string | null {
  return value ? value.toISOString() : null;
}

function approvedChangesFromJson(value: unknown): readonly SalaryPlanChangeDto[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (row): row is SalaryPlanChangeDto =>
      Boolean(row) && typeof row === "object" && "settingKey" in row && "previous" in row && "next" in row,
  );
}

/** Plain JSON representation for server components, APIs, and client forms. */
export function serializeSalaryPlan(
  plan: SalaryPlan = DEFAULT_SALARY_PLAN,
  meta: SalaryPlanMeta = {},
): SalaryPlanDto {
  return {
    version: plan.version,
    versionId: plan.versionId,
    effectiveFrom: toIso(meta.effectiveFrom),
    activatedAt: toIso(meta.activatedAt),
    createdAt: toIso(meta.createdAt),
    createdBy: meta.createdBy
      ? {
          memberId: meta.createdBy.memberId,
          email: meta.createdBy.email ?? null,
          name: meta.createdBy.fullName,
        }
      : null,
    note: meta.note ?? null,
    approvedChanges: approvedChangesFromJson(meta.approvedChanges),
    totalAllocationBps: totalSalaryAllocationBps(plan),
    enabledRanks: SALARY_RANK_KEYS.filter((rankKey) =>
      isSalaryRankEnabled(plan.configs[rankKey]),
    ),
    ranks: SALARY_RANK_KEYS.map((rankKey) => {
      const config = plan.configs[rankKey];
      return {
        rankKey,
        sortOrder: config.sortOrder,
        isEnabled: config.isEnabled,
        defaultName: config.defaultName,
        defaultNameBn: config.defaultNameBn,
        name: config.defaultName,
        nameBn: config.defaultNameBn,
        badgeImageUrl: null,
        allocationPercent: bpsToPercent(config.allocationBps),
        maxWeeklySalary: paisaToSp(config.maxWeeklySalaryPaisa),
        maxWeeks: config.maxWeeks === null ? null : config.maxWeeks.toString(),
        enabled: isSalaryRankEnabled(config),
      };
    }),
  };
}

export type SalaryPlanVersionDto = SalaryPlanDto & {
  id: string;
  isActive: boolean;
};

type SalaryPlanVersionRecord = PlanWithDefinitions & {
  createdBy?: { memberId: string | null; fullName: string; email?: string | null } | null;
};

/** Full JSON representation of one immutable plan version for history views. */
export function serializeSalaryPlanVersion(version: SalaryPlanVersionRecord): SalaryPlanVersionDto {
  return {
    ...serializeSalaryPlan(planFromVersion(version), {
      effectiveFrom: version.effectiveFrom,
      activatedAt: version.activatedAt,
      createdAt: version.createdAt,
      createdBy: version.createdBy,
      note: version.note,
      approvedChanges: version.approvedChanges,
    }),
    id: version.id,
    isActive: version.isActive,
  };
}
