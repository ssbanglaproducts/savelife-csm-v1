import { describe, expect, it } from "vitest";
import { credentialRoleAllowed, normalizeAdminEmail } from "./admin-login";

describe("admin email login", () => {
  it("normalizes administrator and staff email addresses", () => {
    expect(normalizeAdminEmail("  Admin@Savelife.Test  ")).toBe("admin@savelife.test");
    expect(normalizeAdminEmail("STAFF+one@Example.COM")).toBe("staff+one@example.com");
  });

  it("rejects member IDs and malformed email addresses", () => {
    expect(normalizeAdminEmail("SL000000")).toBeNull();
    expect(normalizeAdminEmail("SL000001")).toBeNull();
    expect(normalizeAdminEmail("not-an-email")).toBeNull();
    expect(normalizeAdminEmail("admin@localhost")).toBeNull();
    expect(normalizeAdminEmail(undefined)).toBeNull();
    expect(normalizeAdminEmail(123)).toBeNull();
  });

  it("keeps the two login forms role-specific", () => {
    expect(credentialRoleAllowed("ADMIN", "ADMIN")).toBe(true);
    expect(credentialRoleAllowed("STAFF", "ADMIN")).toBe(true);
    expect(credentialRoleAllowed("MEMBER", "ADMIN")).toBe(false);

    expect(credentialRoleAllowed("MEMBER", "MEMBER")).toBe(true);
    expect(credentialRoleAllowed("ADMIN", "MEMBER")).toBe(false);
    expect(credentialRoleAllowed("STAFF", "MEMBER")).toBe(false);
  });
});
