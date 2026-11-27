export type LoginRole = "ADMIN" | "MEMBER";
export type AccountRole = "MEMBER" | "ADMIN" | "STAFF";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Administrator and staff accounts sign in with a normalized email address. */
export function normalizeAdminEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  if (!EMAIL_PATTERN.test(email) || email.length > 254) return null;
  return email;
}

/**
 * The member form only accepts MEMBER accounts. The separate administrator
 * form accepts both ADMIN and STAFF, but never a member account.
 */
export function credentialRoleAllowed(role: AccountRole, expectedRole: LoginRole): boolean {
  if (expectedRole === "ADMIN") return role === "ADMIN" || role === "STAFF";
  return role === "MEMBER";
}
