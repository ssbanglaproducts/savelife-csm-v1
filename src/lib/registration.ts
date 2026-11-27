export type SponsorForRegistration = {
  status: string | null;
  role?: string | null;
};

export type SponsorRegistrationError =
  | "SPONSOR_NOT_FOUND"
  | "SPONSOR_NOT_ELIGIBLE"
  | "SPONSOR_INACTIVE"
  | null;

/** Only ACTIVE non-admin members may sponsor a new registration. */
export function getSponsorRegistrationError(
  sponsor: SponsorForRegistration | null | undefined,
): SponsorRegistrationError {
  if (!sponsor) return "SPONSOR_NOT_FOUND";
  if (sponsor.role === "ADMIN") return "SPONSOR_NOT_ELIGIBLE";
  if (sponsor.status !== "ACTIVE") return "SPONSOR_INACTIVE";
  return null;
}
