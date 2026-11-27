import { describe, expect, it } from "vitest";
import { normalizeMemberId, requireMemberId } from "@/lib/member-id";

describe("member-id", () => {
  it("normalizes member IDs for member-only lookups", () => {
    expect(normalizeMemberId("  sl000123  ")).toBe("SL000123");
  });

  it("returns a narrow member ID for member-scoped rows", () => {
    expect(requireMemberId({ memberId: "SL000123" })).toBe("SL000123");
  });

  it("rejects admin and staff rows without a member ID", () => {
    expect(() => requireMemberId({ memberId: null })).toThrow("MEMBER_ID_REQUIRED");
  });
});
