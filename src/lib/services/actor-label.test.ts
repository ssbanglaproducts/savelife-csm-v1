import { describe, expect, it } from "vitest";
import { formatActorLabel } from "@/lib/services/actor-label";

describe("formatActorLabel", () => {
  it("uses the member ID for member actors", () => {
    expect(formatActorLabel({ fullName: "Founder", memberId: "SL000001" })).toBe(
      "Founder (SL000001)",
    );
  });

  it("falls back to email for admin and staff actors without a member ID", () => {
    expect(
      formatActorLabel({ fullName: "Savelife Administrator", memberId: null, email: "admin@savelife.test" }),
    ).toBe("Savelife Administrator (admin@savelife.test)");
  });

  it("falls back to name when no secondary label is present", () => {
    expect(formatActorLabel({ name: "System" })).toBe("System");
  });

  it("renders a placeholder for missing actors", () => {
    expect(formatActorLabel(null)).toBe("—");
  });
});
