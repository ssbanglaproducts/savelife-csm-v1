import { describe, expect, it } from "vitest";
import { createSignupInvite, verifySignupInvite } from "./signup-invite";

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
});
