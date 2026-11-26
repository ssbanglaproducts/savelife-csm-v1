import { describe, expect, it } from "vitest";
import { getSponsorRegistrationError } from "./registration";

describe("registration sponsor validation", () => {
  it("allows active sponsors", () => {
    expect(getSponsorRegistrationError({ status: "ACTIVE" })).toBeNull();
  });

  it("reports missing sponsors as not found", () => {
    expect(getSponsorRegistrationError(null)).toBe("SPONSOR_NOT_FOUND");
    expect(getSponsorRegistrationError(undefined)).toBe("SPONSOR_NOT_FOUND");
  });

  it("rejects inactive and suspended sponsors", () => {
    expect(getSponsorRegistrationError({ status: "INACTIVE" })).toBe("SPONSOR_INACTIVE");
    expect(getSponsorRegistrationError({ status: "SUSPENDED" })).toBe("SPONSOR_INACTIVE");
    expect(getSponsorRegistrationError({ status: null })).toBe("SPONSOR_INACTIVE");
  });
});
