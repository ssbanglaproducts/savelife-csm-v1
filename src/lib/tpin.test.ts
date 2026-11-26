import bcrypt from "bcryptjs";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { findUnique } = vi.hoisted(() => ({ findUnique: vi.fn() }));

vi.mock("@/lib/prisma", () => ({
  prisma: { member: { findUnique } },
}));

import { verifyMemberTPin } from "./tpin";

describe("verifyMemberTPin", () => {
  beforeEach(() => {
    findUnique.mockReset();
  });

  it("accepts the correct six-digit PIN", async () => {
    findUnique.mockResolvedValue({ tPinHash: await bcrypt.hash("123456", 4) });
    await expect(verifyMemberTPin("SL1", "123456")).resolves.toEqual({ ok: true });
  });

  it("reports TPIN_NOT_SET when no hash exists", async () => {
    findUnique.mockResolvedValueOnce({ tPinHash: null }).mockResolvedValueOnce(null);
    await expect(verifyMemberTPin("SL1", "123456")).resolves.toEqual({
      ok: false,
      code: "TPIN_NOT_SET",
    });
    await expect(verifyMemberTPin("SL1", "123456")).resolves.toEqual({
      ok: false,
      code: "TPIN_NOT_SET",
    });
  });

  it("reports INVALID_TPIN for a wrong PIN", async () => {
    findUnique.mockResolvedValue({ tPinHash: await bcrypt.hash("123456", 4) });
    await expect(verifyMemberTPin("SL1", "654321")).resolves.toEqual({
      ok: false,
      code: "INVALID_TPIN",
    });
  });

  it("rejects malformed input even when it matches the hash", async () => {
    findUnique.mockResolvedValue({ tPinHash: await bcrypt.hash("12345", 4) });
    await expect(verifyMemberTPin("SL1", "12345")).resolves.toEqual({
      ok: false,
      code: "INVALID_TPIN",
    });
  });
});
