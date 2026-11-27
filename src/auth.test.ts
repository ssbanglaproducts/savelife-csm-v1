import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  nextAuthConfig: null as Record<string, unknown> | null,
  compare: vi.fn(),
  memberFindUnique: vi.fn(),
  memberFindFirst: vi.fn(),
}));

vi.mock("next-auth", () => {
  class MockCredentialsSignin extends Error {
    code = "CREDENTIALS_SIGNIN";
  }
  return {
    default: (config: Record<string, unknown>) => {
      mocks.nextAuthConfig = config;
      return {
        handlers: { GET: vi.fn(), POST: vi.fn() },
        auth: vi.fn(),
        signIn: vi.fn(),
        signOut: vi.fn(),
        unstable_update: vi.fn(),
      };
    },
    CredentialsSignin: MockCredentialsSignin,
  };
});

vi.mock("next-auth/providers/credentials", () => ({
  default: (config: Record<string, unknown>) => config,
}));

vi.mock("bcryptjs", () => ({ default: { compare: mocks.compare } }));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    member: {
      findUnique: mocks.memberFindUnique,
      findFirst: mocks.memberFindFirst,
    },
  },
}));

import "./auth";

type Authorize = (
  credentials: Record<string, unknown>,
  request: Request,
) => Promise<Record<string, unknown> | null>;

function authorize(): Authorize {
  const config = mocks.nextAuthConfig;
  if (!config) throw new Error("NextAuth config was not captured");
  const provider = (config.providers as Array<{ authorize: Authorize }>)[0];
  return provider.authorize;
}

function memberRecord(memberId: string) {
  return {
    id: `id-${memberId}`,
    email: null,
    fullName: "Test Member",
    profileImage: null,
    role: "MEMBER",
    memberId,
    status: "ACTIVE",
    passwordHash: "hash",
    accountLink: null,
  };
}

function request(ip: string) {
  return new Request("https://example.test/api/auth/callback/credentials", {
    headers: { "x-forwarded-for": ip },
  });
}

describe("credentials login throttling", () => {
  beforeEach(() => {
    mocks.compare.mockReset();
    mocks.memberFindUnique.mockReset();
    mocks.memberFindFirst.mockReset();
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  it("returns the stable rate-limit error after repeated bad passwords", async () => {
    const memberId = "SL610001";
    mocks.memberFindUnique.mockResolvedValue(memberRecord(memberId));
    mocks.compare.mockResolvedValue(false);

    for (let attempt = 0; attempt < 5; attempt += 1) {
      expect(
        await authorize()(
          { memberId, password: "wrong", expectedRole: "MEMBER" },
          request("192.0.2.10"),
        ),
      ).toBeNull();
    }

    await expect(
      authorize()(
        { memberId, password: "wrong", expectedRole: "MEMBER" },
        request("192.0.2.10"),
      ),
    ).rejects.toMatchObject({ code: "TOO_MANY_ATTEMPTS" });
  });

  it("allows a correct password and clears that account's backoff", async () => {
    const memberId = "SL610002";
    mocks.memberFindUnique.mockResolvedValue(memberRecord(memberId));
    mocks.compare.mockResolvedValue(true);

    const identity = await authorize()(
      { memberId, password: "correct", expectedRole: "MEMBER" },
      request("192.0.2.11"),
    );
    expect(identity).toMatchObject({ memberId, role: "MEMBER" });

    mocks.compare.mockResolvedValue(false);
    expect(
      await authorize()(
        { memberId, password: "wrong", expectedRole: "MEMBER" },
        request("192.0.2.11"),
      ),
    ).toBeNull();
  });
});
