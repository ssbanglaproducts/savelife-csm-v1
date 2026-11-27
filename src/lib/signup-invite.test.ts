import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createSignupInvite, verifySignupInvite } from "./signup-invite";

const originalSecret = process.env.AUTH_SECRET;

beforeAll(() => {
  process.env.AUTH_SECRET = "test-signup-invite-secret";
});

afterAll(() => {
  if (originalSecret === undefined) delete process.env.AUTH_SECRET;
  else process.env.AUTH_SECRET = originalSecret;
});

const payload = {
  sponsorMemberId: "SL000001",
  placementMemberId: "SL000002",
  placementSlot: 3,
} as const;

describe("signup invite tokens", () => {
  it("round-trips an exact placement payload", () => {
    expect(verifySignupInvite(createSignupInvite(payload))).toEqual(payload);
  });

  it("uses a nonce so two links for the same slot are unique", () => {
    expect(createSignupInvite(payload)).not.toBe(createSignupInvite(payload));
  });

  it("rejects tampered tokens", () => {
    const token = createSignupInvite(payload);
    const [prefix, body] = token.split(".");
    expect(verifySignupInvite(`${prefix}.${body}.deadbeef`)).toBeNull();
    expect(verifySignupInvite(`${prefix}.garbage.signature`)).toBeNull();
    expect(verifySignupInvite(null)).toBeNull();
  });

  it("rejects malformed signed payloads", () => {
    const token = createSignupInvite(payload);
    const [prefix, body, signature] = token.split(".");
    const malformed = Buffer.from(
      JSON.stringify({ ...payload, placementSlot: "3", version: 1 }),
      "utf8",
    ).toString("base64url");
    expect(verifySignupInvite(`${prefix}.${malformed}.${signature}`)).toBeNull();
    expect(body).toBeTruthy();
  });

  it("refuses to sign without a configured secret", () => {
    const auth = process.env.AUTH_SECRET;
    const nextAuth = process.env.NEXTAUTH_SECRET;
    const invite = process.env.SIGNUP_INVITE_SECRET;
    delete process.env.AUTH_SECRET;
    delete process.env.NEXTAUTH_SECRET;
    delete process.env.SIGNUP_INVITE_SECRET;

    expect(() => createSignupInvite(payload)).toThrow(/signing secret/i);

    if (auth !== undefined) process.env.AUTH_SECRET = auth;
    if (nextAuth !== undefined) process.env.NEXTAUTH_SECRET = nextAuth;
    if (invite !== undefined) process.env.SIGNUP_INVITE_SECRET = invite;
  });
});
