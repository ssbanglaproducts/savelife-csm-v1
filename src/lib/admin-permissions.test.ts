import { describe, expect, it } from "vitest";
import {
  ADMIN_PERMISSION_VALUES,
  BASELINE_PERMISSIONS,
  isAdminPermission,
  isBaselinePermission,
  parseAssignedPermissions,
} from "./admin-permissions";

describe("admin permission catalogue", () => {
  it("uses stable page.action pairs only", () => {
    for (const permission of ADMIN_PERMISSION_VALUES) {
      expect(permission).toMatch(/^[a-zA-Z]+\.[a-zA-Z]+$/);
    }
    expect(new Set(ADMIN_PERMISSION_VALUES).size).toBe(ADMIN_PERMISSION_VALUES.length);
  });

  it("always grants only the dashboard baseline", () => {
    expect([...BASELINE_PERMISSIONS]).toEqual(["dashboard.view"]);
    expect(isBaselinePermission("dashboard.view")).toBe(true);
    expect(isBaselinePermission("members.view")).toBe(false);
  });

  it("discards unknown and baseline strings from grant input", () => {
    expect(
      parseAssignedPermissions([
        "members.view",
        "members.view",
        "dashboard.view",
        "unknown.permission",
        "staff.manage",
        42,
        null,
      ]),
    ).toEqual(["members.view", "staff.manage"]);
  });

  it("never treats an arbitrary string as a permission", () => {
    expect(isAdminPermission("members.view")).toBe(true);
    expect(isAdminPermission("members")).toBe(false);
    expect(isAdminPermission("view")).toBe(false);
    expect(isAdminPermission("all")).toBe(false);
    expect(isAdminPermission(undefined)).toBe(false);
  });
});
