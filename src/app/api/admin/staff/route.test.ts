import { beforeEach, describe, expect, it, vi } from "vitest";

const KEY = "22222222-2222-4222-8222-222222222222";
const ADMIN_ID = "admin-1";
const ADMIN_PASSWORD = "Admin@123456";
const CREATED_AT = new Date("2026-11-01T06:00:00.000Z");

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  memberFindUnique: vi.fn(),
  memberFindMany: vi.fn(),
  memberFindFirst: vi.fn(),
  memberCount: vi.fn(),
  memberCreate: vi.fn(),
  memberUpdate: vi.fn(),
  grantDeleteMany: vi.fn(),
  grantCreateMany: vi.fn(),
  mutationFindUnique: vi.fn(),
  mutationCreate: vi.fn(),
  verifyAdminPassword: vi.fn(),
  writeAuditLog: vi.fn(),
  allocateMemberId: vi.fn(),
  hash: vi.fn(),
}));

vi.mock("@/auth", () => ({ auth: mocks.auth }));
vi.mock("@/i18n/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/lib/prisma", () => {
  const prisma = {
    member: {
      findUnique: mocks.memberFindUnique,
      findMany: mocks.memberFindMany,
      findFirst: mocks.memberFindFirst,
      count: mocks.memberCount,
      create: mocks.memberCreate,
      update: mocks.memberUpdate,
    },
    staffPermissionGrant: {
      deleteMany: mocks.grantDeleteMany,
      createMany: mocks.grantCreateMany,
    },
    staffMutation: {
      findUnique: mocks.mutationFindUnique,
      create: mocks.mutationCreate,
    },
    $transaction: async (fn: (tx: unknown) => Promise<unknown>) => fn(prisma),
  };
  return { prisma };
});
vi.mock("@/lib/admin-password", () => ({ verifyAdminPassword: mocks.verifyAdminPassword }));
vi.mock("@/lib/audit", () => ({ writeAuditLog: mocks.writeAuditLog }));
vi.mock("@/lib/member-id", () => ({ allocateMemberId: mocks.allocateMemberId }));
vi.mock("bcryptjs", () => ({ default: { hash: mocks.hash, compare: vi.fn() } }));

import { GET, POST } from "./route";

type Role = "ADMIN" | "STAFF";

type StaffRow = {
  id: string;
  memberId: string | null;
  fullName: string;
  email: string;
  phone: string;
  role: Role;
  status: "ACTIVE" | "SUSPENDED";
  createdAt: Date;
  updatedAt: Date;
  staffPermissions: Array<{ permission: string }>;
};

function staffRow(overrides: Partial<StaffRow> = {}): StaffRow {
  return {
    id: "staff-1",
    memberId: "SL000010",
    fullName: "Support One",
    email: "support@savelife.test",
    phone: "+8801700000010",
    role: "STAFF",
    status: "ACTIVE",
    createdAt: CREATED_AT,
    updatedAt: CREATED_AT,
    staffPermissions: [{ permission: "orders.view" }],
    ...overrides,
  };
}

function setSession(user: { id: string; role: Role }): void {
  mocks.auth.mockResolvedValue({
    user: {
      id: user.id,
      role: user.role,
      memberId: user.role === "ADMIN" ? "SL000000" : "SL000010",
      name: "Test User",
      email: null,
    },
  });
}

function setAccessMember(role: Role, permissions: readonly string[]): void {
  mocks.memberFindUnique.mockResolvedValue({
    role,
    status: "ACTIVE",
    memberId: role === "ADMIN" ? "SL000000" : "SL000010",
    fullName: "Test User",
    email: role === "ADMIN" ? "admin@savelife.test" : "staff@savelife.test",
    staffPermissions: permissions.map((permission) => ({ permission })),
  });
}

function request(body?: Record<string, unknown>): Request {
  return new Request("http://localhost/api/admin/staff", {
    method: body ? "POST" : "GET",
    headers: { "Content-Type": "application/json" },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}

function createBody(overrides: Record<string, unknown> = {}) {
  return {
    action: "CREATE",
    idempotencyKey: KEY,
    adminPassword: ADMIN_PASSWORD,
    name: "New Staff",
    email: "new.staff@savelife.test",
    phone: "+8801700000011",
    password: "Staff@123456",
    permissions: ["orders.view"],
    ...overrides,
  };
}

function statusBody(targetId: string, status: "ACTIVE" | "SUSPENDED" = "SUSPENDED") {
  return {
    action: "SET_STATUS",
    idempotencyKey: KEY,
    adminPassword: ADMIN_PASSWORD,
    targetId,
    status,
  };
}

describe("/api/admin/staff", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    setSession({ id: ADMIN_ID, role: "ADMIN" });
    setAccessMember("ADMIN", []);

    mocks.verifyAdminPassword.mockResolvedValue(true);
    mocks.writeAuditLog.mockResolvedValue(undefined);
    mocks.allocateMemberId.mockResolvedValue("SL000010");
    mocks.hash.mockResolvedValue("hashed-password");
    mocks.memberFindMany.mockResolvedValue([staffRow()]);
    mocks.memberFindFirst.mockResolvedValue(null);
    mocks.memberCount.mockResolvedValue(2);
    mocks.memberUpdate.mockResolvedValue(undefined);
    mocks.grantDeleteMany.mockResolvedValue(undefined);
    mocks.grantCreateMany.mockResolvedValue(undefined);
    mocks.mutationFindUnique.mockResolvedValue(null);
    mocks.mutationCreate.mockImplementation(
      async (args: {
        data: {
          idempotencyKey: string;
          action: string;
          requestHash: string;
          actorId: string;
          targetId: string;
        };
      }) => ({ id: "mutation-1", ...args.data, createdAt: CREATED_AT }),
    );
    mocks.memberCreate.mockImplementation(
      async (args: {
        data: {
          memberId?: string | null;
          fullName: string;
          email: string;
          phone: string;
          role: string;
          status: string;
          staffPermissions?: { create?: Array<{ permission: string }> };
        };
      }) => {
        const { data } = args;
        return staffRow({
          id: "staff-1",
          memberId: data.memberId ?? null,
          fullName: data.fullName,
          email: data.email,
          phone: data.phone,
          role: data.role as Role,
          status: data.status as "ACTIVE",
          staffPermissions: (data.staffPermissions?.create ?? []).map((grant) => ({
            permission: grant.permission,
          })),
        });
      },
    );
  });

  it("hides the staff workspace from a staff account without staff.view", async () => {
    setSession({ id: "staff-1", role: "STAFF" });
    setAccessMember("STAFF", ["staff.manage"]);

    const response = await GET();

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({ error: "FORBIDDEN" });
    expect(mocks.memberFindMany).not.toHaveBeenCalled();
  });

  it("loads staff grants from the database on every request", async () => {
    setSession({ id: "staff-1", role: "STAFF" });
    setAccessMember("STAFF", ["staff.view"]);
    const allowed = await GET();
    expect(allowed.status).toBe(200);

    setAccessMember("STAFF", []);
    const denied = await GET();
    expect(denied.status).toBe(403);
  });

  it("rejects a duplicate admin or staff email", async () => {
    mocks.memberFindFirst.mockResolvedValueOnce({ id: "existing" });

    const response = await POST(request(createBody()));

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({ error: "DUPLICATE_EMAIL" });
    expect(mocks.memberCreate).not.toHaveBeenCalled();
    expect(mocks.writeAuditLog).not.toHaveBeenCalled();
  });

  it("requires the acting administrator password before any mutation", async () => {
    mocks.verifyAdminPassword.mockResolvedValue(false);

    const response = await POST(request(createBody()));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({ error: "INVALID_ADMIN_PASSWORD" });
    expect(mocks.memberCreate).not.toHaveBeenCalled();
    expect(mocks.mutationCreate).not.toHaveBeenCalled();
    expect(mocks.writeAuditLog).not.toHaveBeenCalled();
  });

  it("prevents permission escalation by a staff manager", async () => {
    setSession({ id: "staff-1", role: "STAFF" });
    setAccessMember("STAFF", ["staff.manage", "orders.view"]);

    const response = await POST(
      request(createBody({ permissions: ["staff.manage", "distributions.post"] })),
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({ error: "PERMISSION_ESCALATION" });
    expect(mocks.memberCreate).not.toHaveBeenCalled();
  });

  it("prevents a staff manager from touching a super-admin account", async () => {
    setSession({ id: "staff-1", role: "STAFF" });
    setAccessMember("STAFF", ["staff.manage"]);
    mocks.memberFindFirst.mockResolvedValueOnce(
      staffRow({ id: "admin-2", memberId: "SL000000", role: "ADMIN" }),
    );

    const response = await POST(request(statusBody("admin-2")));

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({ error: "ADMIN_PROTECTED" });
    expect(mocks.memberUpdate).not.toHaveBeenCalled();
  });

  it("blocks self lockout and suspending the last super admin", async () => {
    const self = await POST(request(statusBody(ADMIN_ID)));
    expect(self.status).toBe(409);
    await expect(self.json()).resolves.toMatchObject({ error: "SELF_LOCKOUT" });

    mocks.memberFindFirst.mockResolvedValueOnce(
      staffRow({ id: "admin-2", memberId: "SL000000", role: "ADMIN" }),
    );
    mocks.memberCount.mockResolvedValue(1);
    const lastAdmin = await POST(request(statusBody("admin-2")));
    expect(lastAdmin.status).toBe(409);
    await expect(lastAdmin.json()).resolves.toMatchObject({ error: "LAST_SUPER_ADMIN" });
    expect(mocks.memberUpdate).not.toHaveBeenCalled();
  });

  it("creates staff without allocating a member ID", async () => {
    const response = await POST(request(createBody()));

    expect(response.status).toBe(201);
    const createArgs = mocks.memberCreate.mock.calls[0]?.[0] as {
      data: Record<string, unknown>;
    };
    expect(createArgs.data).not.toHaveProperty("memberId");
    expect(mocks.allocateMemberId).not.toHaveBeenCalled();
    const audit = mocks.writeAuditLog.mock.calls[0]?.[0] as { after: Record<string, unknown> };
    expect(audit.after).not.toHaveProperty("memberId");

    mocks.memberFindMany.mockResolvedValueOnce([staffRow({ memberId: null })]);
    const listed = await GET();
    await expect(listed.json()).resolves.toMatchObject({
      staff: [{ memberId: null }],
    });
  });

  it("writes an audit entry without storing secrets", async () => {
    const response = await POST(request(createBody()));

    expect(response.status).toBe(201);
    expect(mocks.writeAuditLog).toHaveBeenCalledTimes(1);
    const audit = mocks.writeAuditLog.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(audit).toMatchObject({
      actorId: ADMIN_ID,
      actorRole: "ADMIN",
      action: "STAFF_CREATED",
      entityType: "StaffAccount",
      entityId: "staff-1",
    });
    expect(JSON.stringify(audit)).not.toContain(ADMIN_PASSWORD);
    expect(JSON.stringify(audit)).not.toContain("Staff@123456");
  });

  it("replays an identical idempotency key without a second mutation", async () => {
    const first = await POST(request(createBody()));
    expect(first.status).toBe(201);

    const stored = mocks.mutationCreate.mock.calls[0]?.[0] as {
      data: { requestHash: string; targetId: string };
    };
    mocks.mutationFindUnique.mockResolvedValueOnce({
      requestHash: stored.data.requestHash,
      targetId: stored.data.targetId,
    });

    const replay = await POST(request(createBody()));
    expect(replay.status).toBe(200);
    await expect(replay.json()).resolves.toMatchObject({
      ok: true,
      replayed: true,
      targetId: "staff-1",
    });
    expect(mocks.memberCreate).toHaveBeenCalledTimes(1);
    expect(mocks.verifyAdminPassword).toHaveBeenCalledTimes(1);
    expect(mocks.writeAuditLog).toHaveBeenCalledTimes(1);
  });

  it("rejects reusing an idempotency key for a different request", async () => {
    mocks.mutationFindUnique.mockResolvedValue({
      requestHash: "a-different-request-hash",
      targetId: "staff-1",
    });

    const response = await POST(request(createBody()));

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({ error: "DUPLICATE_REQUEST" });
    expect(mocks.memberCreate).not.toHaveBeenCalled();
  });
});
