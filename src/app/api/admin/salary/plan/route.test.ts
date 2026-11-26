import bcrypt from "bcryptjs";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  adminFindUnique: vi.fn(),
  memberFindMany: vi.fn(),
  versionFindUnique: vi.fn(),
  versionFindFirst: vi.fn(),
  versionCreate: vi.fn(),
  versionUpdateMany: vi.fn(),
  versionFindUniqueOrThrow: vi.fn(),
  treasuryUpsert: vi.fn(),
  writeAuditLog: vi.fn(),
}));

vi.mock("@/auth", () => ({ auth: mocks.auth }));
vi.mock("@/lib/audit", () => ({ writeAuditLog: mocks.writeAuditLog }));
vi.mock("@/lib/prisma", () => {
  const prisma = {
    member: {
      findUnique: mocks.adminFindUnique,
      findMany: mocks.memberFindMany,
    },
    salaryPlanVersion: {
      findUnique: mocks.versionFindUnique,
      findFirst: mocks.versionFindFirst,
      create: mocks.versionCreate,
      updateMany: mocks.versionUpdateMany,
      findUniqueOrThrow: mocks.versionFindUniqueOrThrow,
    },
    salaryTreasury: { upsert: mocks.treasuryUpsert },
    $transaction: async (fn: (tx: unknown) => Promise<unknown>) => fn(prisma),
  };
  return { prisma };
});

import { POST } from "./route";
import {
  DEFAULT_SALARY_PLAN,
  SALARY_RANK_CONFIG,
  SALARY_RANK_KEYS,
} from "@/lib/salary";
import { serializeSalaryPlan } from "@/lib/services/salary-plan";

const ADMIN_ID = "admin-1";
const TOKEN = "11111111-1111-4111-8111-111111111111";
const PASSWORD = "Admin@123456";
const EFFECTIVE_FROM = "2026-12-06";
const ACTIVE_EFFECTIVE = new Date("2026-11-01T00:00:00.000Z");
const ACTIVATED_AT = new Date("2026-11-01T06:00:00.000Z");
const CREATED_AT = new Date("2026-11-01T06:00:00.000Z");

type CreateData = {
  version: number;
  isActive: boolean;
  commitToken: string;
  createdById: string;
  effectiveFrom: Date;
  definitions: { create: Array<Record<string, unknown>> };
  approvedChanges: Array<Record<string, unknown>>;
};

function snapshot(value: unknown): string {
  return JSON.stringify(value, (_key, nested) =>
    typeof nested === "bigint" ? nested.toString() : nested,
  );
}

function definitions(version: number, r2AllocationBps: number) {
  return SALARY_RANK_KEYS.map((rankKey) => {
    const config = SALARY_RANK_CONFIG[rankKey];
    return {
      id: `salary-plan-definition:${version}:${rankKey}`,
      planVersionId: `salary-plan-version:${version}`,
      rankKey,
      sortOrder: config.sortOrder,
      isEnabled: config.isEnabled,
      allocationBps: rankKey === "R2" ? r2AllocationBps : config.allocationBps,
      maxWeeklySalaryPaisa: config.maxWeeklySalaryPaisa,
      maxWeeks: config.maxWeeks,
      createdAt: CREATED_AT,
    };
  });
}

function activeVersion() {
  return {
    id: "salary-plan-version:2",
    version: 2,
    isActive: true,
    effectiveFrom: ACTIVE_EFFECTIVE,
    activatedAt: ACTIVATED_AT,
    note: null,
    approvedChanges: [],
    commitToken: null,
    createdById: ADMIN_ID,
    createdAt: CREATED_AT,
    definitions: definitions(2, 200),
    createdBy: { memberId: "SL000000", fullName: "System Admin" },
  };
}

function savedVersion() {
  return {
    id: "salary-plan-version:3",
    version: 3,
    isActive: true,
    effectiveFrom: new Date(`${EFFECTIVE_FROM}T00:00:00.000Z`),
    activatedAt: ACTIVATED_AT,
    note: null,
    approvedChanges: [],
    commitToken: TOKEN,
    createdById: ADMIN_ID,
    createdAt: CREATED_AT,
    definitions: definitions(3, 250),
    createdBy: { memberId: "SL000000", fullName: "System Admin" },
  };
}

function body(overrides: Record<string, unknown> = {}) {
  const ranks = serializeSalaryPlan(DEFAULT_SALARY_PLAN).ranks.map((row) => ({
    rankKey: row.rankKey,
    isEnabled: row.isEnabled,
    allocationPercent: row.allocationPercent,
    maxWeeklySalary: row.maxWeeklySalary,
    maxWeeks: row.maxWeeks,
  }));
  ranks[1].allocationPercent = "2.5";
  return {
    effectiveFrom: EFFECTIVE_FROM,
    adminPassword: PASSWORD,
    commitToken: TOKEN,
    ranks,
    ...overrides,
  };
}

function request(payload: Record<string, unknown>): Request {
  return new Request("http://localhost/api/admin/salary/plan", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

describe("POST /api/admin/salary/plan", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    mocks.auth.mockResolvedValue({ user: { id: ADMIN_ID, role: "ADMIN" } });
    mocks.adminFindUnique.mockResolvedValue({
      passwordHash: await bcrypt.hash(PASSWORD, 4),
    });
    mocks.memberFindMany.mockResolvedValue([]);
    mocks.versionFindUnique.mockResolvedValue(null);
    mocks.versionFindFirst.mockResolvedValue(activeVersion());
    mocks.versionCreate.mockImplementation(async ({ data }: { data: CreateData }) => ({
      ...savedVersion(),
      ...data,
      definitions: data.definitions.create.map(
        (definition: Record<string, unknown>, index: number) => ({
          id: `new-definition:${index}`,
          createdAt: CREATED_AT,
          ...definition,
        }),
      ),
    }));
    mocks.versionUpdateMany.mockResolvedValue({ count: 1 });
    mocks.versionFindUniqueOrThrow.mockImplementation(async () => savedVersion());
    mocks.treasuryUpsert.mockResolvedValue({});
    mocks.writeAuditLog.mockResolvedValue(undefined);
  });

  it("rejects a wrong admin password without creating anything", async () => {
    const response = await POST(request(body({ adminPassword: "wrong-password" })));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({
      error: "INVALID_ADMIN_PASSWORD",
    });
    expect(mocks.versionFindUnique).not.toHaveBeenCalled();
    expect(mocks.versionCreate).not.toHaveBeenCalled();
    expect(mocks.versionUpdateMany).not.toHaveBeenCalled();
    expect(mocks.writeAuditLog).not.toHaveBeenCalled();
  });

  it("rejects invalid salary values before authorization", async () => {
    const response = await POST(
      request(body({ ranks: serializeSalaryPlan(DEFAULT_SALARY_PLAN).ranks.map((row, index) => (index === 1 ? { ...row, allocationPercent: "101" } : row)) })),
    );

    expect(response.status).toBe(400);
    expect(mocks.adminFindUnique).not.toHaveBeenCalled();
    expect(mocks.versionCreate).not.toHaveBeenCalled();
  });

  it("blocks a repeated commit token", async () => {
    mocks.versionFindUnique.mockResolvedValue({
      ...savedVersion(),
      createdById: ADMIN_ID,
    });

    const response = await POST(request(body()));
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json).toMatchObject({ duplicate: true, version: 3 });
    expect(mocks.versionCreate).not.toHaveBeenCalled();
    expect(mocks.versionUpdateMany).not.toHaveBeenCalled();
  });

  it("commits a reviewed version while leaving prior definitions unchanged", async () => {
    const active = activeVersion();
    const before = snapshot(active);
    mocks.versionFindFirst.mockResolvedValue(active);

    const response = await POST(request(body()));
    const json = await response.json();

    expect(response.status).toBe(201);
    expect(json).toMatchObject({ duplicate: false, version: 3 });

    const createData = mocks.versionCreate.mock.calls[0]?.[0]?.data as
      | CreateData
      | undefined;
    expect(createData).toMatchObject({
      version: 3,
      isActive: true,
      commitToken: TOKEN,
      createdById: ADMIN_ID,
    });
    expect(createData?.effectiveFrom).toBeInstanceOf(Date);
    expect(createData?.definitions.create).toHaveLength(9);
    expect(createData?.definitions.create[0]).toMatchObject({
      rankKey: "R1",
      isEnabled: false,
      allocationBps: 0,
    });
    expect(createData?.approvedChanges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          rankKey: "R2",
          settingKey: "allocation",
          previous: "2",
          next: "2.5",
        }),
      ]),
    );
    expect(mocks.versionCreate).toHaveBeenCalledTimes(1);
    expect(mocks.versionUpdateMany).toHaveBeenCalledWith({
      where: { id: { not: "salary-plan-version:3" }, isActive: true },
      data: { isActive: false },
    });
    expect(snapshot(active)).toBe(before);
    expect(mocks.writeAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: ADMIN_ID,
        actorRole: "ADMIN",
        action: "SALARY_PLAN_VERSION_CREATED",
      }),
    );
  });
});
