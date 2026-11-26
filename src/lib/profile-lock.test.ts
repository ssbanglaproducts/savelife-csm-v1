import { describe, expect, it } from "vitest";
import { addressInputSchema } from "./address-input";
import { nomineeInputSchema } from "./nominee-input";
import { hasLockedProfileFields } from "./profile-lock";

describe("profile lock", () => {
  it("rejects every signup identity and contact field", () => {
    for (const field of ["fullName", "email", "phone", "street", "district", "address", "isMain"]) {
      expect(hasLockedProfileFields({ [field]: "changed" })).toBe(true);
    }
  });

  it("allows photo-only profile updates", () => {
    expect(hasLockedProfileFields({ profileImage: null })).toBe(false);
    expect(hasLockedProfileFields({})).toBe(false);
    expect(hasLockedProfileFields(null)).toBe(false);
  });
});

describe("profile sub-resource input", () => {
  it("validates saved address fields", () => {
    expect(
      addressInputSchema.safeParse({
        fullAddress: "House 1, Road 2",
        thana: "Dhanmondi",
        district: "Dhaka",
      }).success,
    ).toBe(true);
    expect(
      addressInputSchema.safeParse({ fullAddress: "x", thana: "", district: "Dhaka" }).success,
    ).toBe(false);
  });

  it("validates nominee fields", () => {
    expect(
      nomineeInputSchema.safeParse({
        fullName: " nominee ",
        relation: " Sister ",
        phone: "01700000000",
      }).data,
    ).toEqual({ fullName: "nominee", relation: "Sister", phone: "01700000000" });
    expect(
      nomineeInputSchema.safeParse({ fullName: "A", relation: "", phone: "123" }).success,
    ).toBe(false);
  });
});
