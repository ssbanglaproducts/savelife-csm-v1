import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminApiSession } from "@/lib/admin-access";
import type { Prisma } from "@/generated/prisma/client";
import { verifyAdminPassword } from "@/lib/admin-password";
import { writeAuditLog } from "@/lib/audit";
import { spToPaisa } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import {
  SALARY_RANK_CONFIG,
  SALARY_RANK_KEYS,
  type SalaryPlan,
  type SalaryRankConfig,
  type SalaryRankKey,
} from "@/lib/salary";
import {
  buildSalaryPlanDiff,
  validateSalaryPlanDraft,
} from "@/lib/salary-plan-form";
import {
  alignAllSalaryEntitlements,
  createSalaryPlanVersion,
  getActiveSalaryPlan,
  planFromVersion,
  serializeSalaryPlan,
  serializeSalaryPlanVersion,
  type SalaryPlanDefinitionInput,
  type SalaryPlanRankDto,
} from "@/lib/services/salary-plan";
import { isUniqueViolation } from "@/lib/services/ledger";

export const dynamic = "force-dynamic";

const BDT_OFFSET_MS = 6 * 60 * 60 * 1000;

const percent = z.string().trim().regex(/^\d{1,3}(\.\d{1,2})?$/);
const amount = z.string().trim().regex(/^\d+(\.\d{1,2})?$/);
const weeks = z.union([z.string().trim().regex(/^(|\d+)$/), z.null()]);
const effectiveDate = z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/);

const schema = z.object({
  note: z.string().trim().max(500).optional().nullable(),
  effectiveFrom: effectiveDate,
  adminPassword: z.string().min(1).max(200),
  commitToken: z.string().uuid(),
  ranks: z
    .array(
      z.object({
        rankKey: z.enum(SALARY_RANK_KEYS),
        isEnabled: z.boolean(),
        allocationPercent: percent,
        maxWeeklySalary: amount,
        maxWeeks: weeks,
      }),
    )
    .length(SALARY_RANK_KEYS.length),
});

function percentToBps(value: string): number {
  const [whole = "0", fraction = ""] = value.split(".");
  return Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
}

function parseWeeks(value: string | null): number | null {
  if (value === null || value.trim() === "" || value.trim() === "0") return null;
  return Number.parseInt(value.trim(), 10);
}

function parseEffectiveDate(value: string): Date | null {
  const utcDate = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(utcDate.getTime()) || utcDate.toISOString().slice(0, 10) !== value) {
    return null;
  }
  return new Date(utcDate.getTime() - BDT_OFFSET_MS);
}

const planInclude = {
  definitions: { orderBy: { sortOrder: "asc" as const } },
  createdBy: { select: { memberId: true, fullName: true } },
} satisfies Prisma.SalaryPlanVersionInclude;

function forbidden() {
  return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
}

export async function GET() {
  const session = await requireAdminApiSession("salary.view");
  if (!session) return forbidden();

  const [plan, versions] = await Promise.all([
    getActiveSalaryPlan(prisma),
    prisma.salaryPlanVersion.findMany({
      orderBy: { version: "desc" },
      include: planInclude,
    }),
  ]);
  const activeVersion = versions.find((version) => version.isActive) ?? null;

  return NextResponse.json({
    active: serializeSalaryPlan(plan, {
      effectiveFrom: activeVersion?.effectiveFrom,
      activatedAt: activeVersion?.activatedAt,
      createdAt: activeVersion?.createdAt,
      createdBy: activeVersion?.createdBy,
      note: activeVersion?.note,
      approvedChanges: activeVersion?.approvedChanges,
    }),
    versions: versions.map(serializeSalaryPlanVersion),
    nextVersion: Math.max(...versions.map((version) => version.version), 0) + 1,
  });
}

export async function POST(request: Request) {
  const session = await requireAdminApiSession("salary.manage");
  if (!session) return forbidden();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Please check the salary values" }, { status: 400 });
  }

  const keys = parsed.data.ranks.map((rank) => rank.rankKey);
  if (new Set(keys).size !== SALARY_RANK_KEYS.length) {
    return NextResponse.json({ error: "Invalid salary ranks" }, { status: 400 });
  }

  const effectiveFrom = parseEffectiveDate(parsed.data.effectiveFrom);
  if (!effectiveFrom) {
    return NextResponse.json({ error: "Invalid effective date" }, { status: 400 });
  }

  const draftRows: SalaryPlanRankDto[] = parsed.data.ranks.map((rank) => {
    const fallback = SALARY_RANK_CONFIG[rank.rankKey];
    return {
      rankKey: rank.rankKey,
      sortOrder: fallback.sortOrder,
      isEnabled: rank.isEnabled,
      defaultName: fallback.defaultName,
      defaultNameBn: fallback.defaultNameBn,
      name: fallback.defaultName,
      nameBn: fallback.defaultNameBn,
      badgeImageUrl: null,
      allocationPercent: rank.allocationPercent,
      maxWeeklySalary: rank.maxWeeklySalary,
      maxWeeks: rank.maxWeeks === null ? null : rank.maxWeeks.trim() || null,
      enabled: false,
    };
  });

  const validation = validateSalaryPlanDraft(draftRows, parsed.data.effectiveFrom);
  if (!validation.valid) {
    return NextResponse.json(
      { error: "Invalid salary values", issues: validation.issues },
      { status: 400 },
    );
  }

  const definitions: SalaryPlanDefinitionInput[] = parsed.data.ranks.map((rank) => ({
    rankKey: rank.rankKey,
    sortOrder: SALARY_RANK_KEYS.indexOf(rank.rankKey) + 1,
    isEnabled: rank.isEnabled,
    allocationBps: percentToBps(rank.allocationPercent),
    maxWeeklySalaryPaisa: spToPaisa(rank.maxWeeklySalary),
    maxWeeks: parseWeeks(rank.maxWeeks),
  }));

  if (!(await verifyAdminPassword(session.user.id, parsed.data.adminPassword))) {
    return NextResponse.json({ error: "INVALID_ADMIN_PASSWORD" }, { status: 401 });
  }

  const token = parsed.data.commitToken;
  const existing = await prisma.salaryPlanVersion.findUnique({
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
      active: serializeSalaryPlan(planFromVersion(existing), {
        effectiveFrom: existing.effectiveFrom,
        activatedAt: existing.activatedAt,
        createdAt: existing.createdAt,
        createdBy: existing.createdBy,
        note: existing.note,
        approvedChanges: existing.approvedChanges,
      }),
    });
  }

  const [currentPlan, currentVersion] = await Promise.all([
    getActiveSalaryPlan(prisma),
    prisma.salaryPlanVersion.findFirst({
      where: { isActive: true },
      orderBy: { version: "desc" },
      include: planInclude,
    }),
  ]);

  const configs: Record<SalaryRankKey, SalaryRankConfig> = { ...SALARY_RANK_CONFIG };
  for (const definition of definitions) {
    configs[definition.rankKey] = {
      ...configs[definition.rankKey],
      isEnabled: definition.isEnabled,
      allocationBps: definition.allocationBps,
      maxWeeklySalaryPaisa: definition.maxWeeklySalaryPaisa,
      maxWeeks: definition.maxWeeks,
    };
  }
  const proposedPlan: SalaryPlan = { version: null, versionId: null, configs };
  const changes = buildSalaryPlanDiff(
    serializeSalaryPlan(currentPlan, {
      effectiveFrom: currentVersion?.effectiveFrom,
      activatedAt: currentVersion?.activatedAt,
      createdAt: currentVersion?.createdAt,
      createdBy: currentVersion?.createdBy,
      note: currentVersion?.note,
      approvedChanges: currentVersion?.approvedChanges,
    }),
    serializeSalaryPlan(proposedPlan, { effectiveFrom }),
  );

  try {
    const { plan, aligned } = await prisma.$transaction(async (tx) => {
      const raced = await tx.salaryPlanVersion.findUnique({
        where: { commitToken: token },
        select: { id: true },
      });
      if (raced) throw new Error("DUPLICATE_COMMIT");

      const saved = await createSalaryPlanVersion(tx, {
        definitions,
        note: parsed.data.note ?? null,
        actorId: session.user.id,
        effectiveFrom,
        commitToken: token,
        approvedChanges: changes as unknown as Prisma.InputJsonValue,
      });
      const changed = await alignAllSalaryEntitlements(tx, saved);
      return { plan: saved, aligned: changed };
    });

    await writeAuditLog({
      actorId: session.user.id,
      actorRole: session.user.role,
      action: "SALARY_PLAN_VERSION_CREATED",
      entityType: "SalaryPlanVersion",
      entityId: plan.versionId ?? undefined,
      before: Object.fromEntries(
        changes.map((change, index) => [`${index}:${change.id}.previous`, change.previous]),
      ),
      after: {
        version: plan.version,
        effectiveFrom: parsed.data.effectiveFrom,
        totalAllocationBps: validation.totalBps,
        alignedCount: aligned,
        ...Object.fromEntries(
          changes.map((change, index) => [`${index}:${change.id}.next`, change.next]),
        ),
      },
    });

    return NextResponse.json(
      {
        duplicate: false,
        version: plan.version,
        alignedCount: aligned,
        changes: changes.length,
        active: serializeSalaryPlan(plan),
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof Error && error.message === "DUPLICATE_COMMIT") {
      const raced = await prisma.salaryPlanVersion.findUnique({
        where: { commitToken: token },
        include: planInclude,
      });
      if (raced) {
        return NextResponse.json({ duplicate: true, version: raced.version });
      }
    }
    if (isUniqueViolation(error)) {
      const raced = await prisma.salaryPlanVersion.findUnique({
        where: { commitToken: token },
        include: planInclude,
      });
      if (raced) {
        return NextResponse.json({ duplicate: true, version: raced.version });
      }
    }
    console.error("Salary plan save failed", error);
    return NextResponse.json({ error: "SALARY_PLAN_FAILED" }, { status: 500 });
  }
}
