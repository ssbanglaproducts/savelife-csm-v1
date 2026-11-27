import { describe, expect, it } from "vitest";
import { serializeStaffAccount } from "./staff";

describe("staff account serialization", () => {
  it("returns only safe fields and valid sorted permissions", () => {
    const createdAt = new Date("2026-11-01T06:00:00.000Z");
    const updatedAt = new Date("2026-11-02T09:30:00.000Z");

    const view = serializeStaffAccount({
      id: "staff-1",
      memberId: "SL000010",
      fullName: "Support One",
      email: "support@savelife.test",
      phone: "+8801700000010",
      role: "STAFF",
      status: "ACTIVE",
      createdAt,
      updatedAt,
      staffPermissions: [
        { permission: "members.view" },
        { permission: "legacy.unknown" },
        { permission: "dashboard.view" },
        { permission: "orders.view" },
      ],
    });

    expect(view).toEqual({
      id: "staff-1",
      memberId: "SL000010",
      fullName: "Support One",
      email: "support@savelife.test",
      phone: "+8801700000010",
      role: "STAFF",
      status: "ACTIVE",
      permissions: ["members.view", "orders.view"],
      createdAt: createdAt.toISOString(),
      updatedAt: updatedAt.toISOString(),
    });
    expect(JSON.stringify(view)).not.toContain("passwordHash");
  });
});
