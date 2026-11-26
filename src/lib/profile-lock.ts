/**
 * Signup identity and contact details are permanent. Member-facing profile
 * updates may only change the photo; any attempt to send a locked field is
 * rejected so a stale or hand-crafted client cannot rewrite it.
 */
export const LOCKED_PROFILE_FIELDS = [
  "fullName",
  "email",
  "phone",
  "address",
  "addresses",
  "street",
  "city",
  "thana",
  "district",
  "postalCode",
  "fullAddress",
  "isDefault",
  "isMain",
] as const;

export function hasLockedProfileFields(body: unknown): boolean {
  if (typeof body !== "object" || body === null) return false;
  const record = body as Record<string, unknown>;
  return LOCKED_PROFILE_FIELDS.some((field) =>
    Object.prototype.hasOwnProperty.call(record, field),
  );
}
