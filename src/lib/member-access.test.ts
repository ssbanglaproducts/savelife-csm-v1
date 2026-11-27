import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  findUnique: vi.fn(),
}));

vi.mock("@/auth", () => ({ auth: mocks.auth }));
vi.mock("@/lib/prisma", () => ({
  prisma: { member: { findUnique: mocks.findUnique } },
}));

import {
  activeMemberErrorResponse,
  requireActiveMemberApi,
  requireActivePrincipalApi,
} from "./member-access";

function session(role = "MEMBER", status = "ACTIVE") {
  return {
    user: {
      id: "member-1",
      principalId: "principal-1",
      role,
      memberId: "SL100001",
      status,
      name: "Test Member",
    },
  };
}

describe("requireActiveMemberApi", () => {
  beforeEach(() => {
    mocks.auth.mockReset();
    mocks.findUnique.mockReset();
  });

  it("returns LOGIN_REQUIRED when there is no session", async () => {
    mocks.auth.mockResolvedValue(null);
    expect(await requireActiveMemberApi()).toEqual({
      ok: false,
      code: "LOGIN_REQUIRED",
      status: 401,
    });
    expect(mocks.findUnique).not.toHaveBeenCalled();
  });

  it("returns FORBIDDEN for non-member sessions", async () => {
    mocks.auth.mockResolvedValue(session("ADMIN"));
    expect(await requireActiveMemberApi()).toEqual({
      ok: false,
      code: "FORBIDDEN",
      status: 403,
    });
    expect(mocks.findUnique).not.toHaveBeenCalled();
  });

  it("rejects stale JWTs when live status is not ACTIVE", async () => {
    mocks.auth.mockResolvedValue(session("MEMBER", "ACTIVE"));
    mocks.findUnique.mockResolvedValue({ status: "SUSPENDED" });
    expect(await requireActiveMemberApi()).toEqual({
      ok: false,
      code: "MEMBER_NOT_ACTIVE",
      status: 403,
    });
  });

  it("rejects members missing from the database", async () => {
    mocks.auth.mockResolvedValue(session("MEMBER", "ACTIVE"));
    mocks.findUnique.mockResolvedValue(null);
    expect(await requireActiveMemberApi()).toMatchObject({
      ok: false,
      code: "MEMBER_NOT_ACTIVE",
    });
  });

  it("returns session identity for a live ACTIVE member", async () => {
    mocks.auth.mockResolvedValue(session());
    mocks.findUnique.mockResolvedValue({ status: "ACTIVE" });

    const access = await requireActiveMemberApi();
    expect(access).toMatchObject({
      ok: true,
      memberId: "member-1",
      principalId: "principal-1",
    });
    if (access.ok) expect(access.identity.name).toBe("Test Member");
    expect(mocks.findUnique).toHaveBeenCalledWith({
      where: { id: "member-1", role: "MEMBER" },
      select: { status: true },
    });
  });

  it("maps guard failures to the existing JSON error contract", () => {
    const response = activeMemberErrorResponse({
      ok: false,
      code: "MEMBER_NOT_ACTIVE",
      status: 403,
    });
    expect(response.status).toBe(403);
  });
});

describe("requireActivePrincipalApi", () => {
  beforeEach(() => {
    mocks.auth.mockReset();
    mocks.findUnique.mockReset();
  });

  it("allows live ACTIVE admins for shared admin/member endpoints", async () => {
    mocks.auth.mockResolvedValue(session("ADMIN"));
    mocks.findUnique.mockResolvedValue({ status: "ACTIVE" });

    const access = await requireActivePrincipalApi();
    expect(access).toMatchObject({
      ok: true,
      memberId: "member-1",
      role: "ADMIN",
    });
    expect(mocks.findUnique).toHaveBeenCalledWith({
      where: { id: "member-1", role: { in: ["ADMIN", "STAFF"] } },
      select: { status: true },
    });
  });

  it("rejects suspended admins and missing principals", async () => {
    mocks.auth.mockResolvedValue(session("STAFF"));
    mocks.findUnique.mockResolvedValue({ status: "SUSPENDED" });
    expect(await requireActivePrincipalApi()).toMatchObject({
      ok: false,
      code: "FORBIDDEN",
      status: 403,
    });

    mocks.findUnique.mockResolvedValue(null);
    expect(await requireActivePrincipalApi()).toMatchObject({ ok: false, code: "FORBIDDEN" });
  });

  it("keeps member-specific failure codes", async () => {
    mocks.auth.mockResolvedValue(session("MEMBER"));
    mocks.findUnique.mockResolvedValue({ status: "INACTIVE" });
    expect(await requireActivePrincipalApi()).toMatchObject({
      ok: false,
      code: "MEMBER_NOT_ACTIVE",
    });
  });
});
