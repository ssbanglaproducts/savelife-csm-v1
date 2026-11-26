export type SponsorForRegistration = {
  status: string | null;
};

export type SponsorRegistrationError = "SPONSOR_NOT_FOUND" | "SPONSOR_INACTIVE" | null;

/** Only ACTIVE members may sponsor a new registration. */
export function getSponsorRegistrationError(
  sponsor: SponsorForRegistration | null | undefined,
): SponsorRegistrationError {
  if (!sponsor) return "SPONSOR_NOT_FOUND";
  if (sponsor.status !== "ACTIVE") return "SPONSOR_INACTIVE";
  return null;
}
