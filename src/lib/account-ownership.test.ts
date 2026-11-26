import { describe, expect, it, vi } from "vitest";
import { buildCloneMemberData, canAccessAccount, getAccountOwnerId } from "./account-ownership";

const source = {
  email: "member@example.test",
  phone: "+8801000000001",
  passwordHash: "password-hash",
  tPinHash: "tpin-hash",
  tPinUpdatedAt: new Date("2026-01-01T00:00:00.000Z"),
};

describe("account ownership", () => {
  it("resolves the stable owner from the account link", async () => {
    const findUnique = vi.fn().mockResolvedValue({ ownerId: "owner-1" });
    const client = { accountOwnership: { findUnique } } as never;
    expect(await getAccountOwnerId(client, "account-1")).toBe("owner-1");
  });

  it("falls back to self ownership when no link exists", async () => {
    const findUnique = vi.fn().mockResolvedValue(null);
    const client = { accountOwnership: { findUnique } } as never;
    expect(await getAccountOwnerId(client, "account-1")).toBe("account-1");
  });

  it("only permits accounts owned by the principal", async () => {
    const findUnique = vi.fn().mockResolvedValue({ ownerId: "owner-1" });
    const client = { accountOwnership: { findUnique } } as never;
    expect(await canAccessAccount(client, "owner-1", "account-1")).toBe(true);
    expect(await canAccessAccount(client, "owner-2", "account-1")).toBe(false);
  });

  it("builds an inactive clone with reset identity and relationships", () => {
    const data = buildCloneMemberData({
      source,
      memberId: "SL000009",
      fullName: "Member One 2",
      profileImage: "/api/uploads/clone.png",
      sponsorId: "sponsor-id",
      placementId: "placement-id",
      placementSlot: 2,
    });

    expect(data).toMatchObject({
      memberId: "SL000009",
      fullName: "Member One 2",
      email: source.email,
      phone: source.phone,
      passwordHash: source.passwordHash,
      tPinHash: source.tPinHash,
      profileImage: "/api/uploads/clone.png",
      role: "MEMBER",
      status: "INACTIVE",
      sponsorId: "sponsor-id",
      placementParentId: "placement-id",
      placementSlot: 2,
      activationDate: null,
    });
    expect(data).not.toHaveProperty("id");
    expect(data).not.toHaveProperty("wallet");
  });
});
