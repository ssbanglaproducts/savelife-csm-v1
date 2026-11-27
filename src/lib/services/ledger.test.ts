import { describe, expect, it, vi } from "vitest";
import type { Prisma } from "../../generated/prisma/client";
import { debitWalletFieldIfSufficient, isUniqueViolationOn } from "./ledger";

function fakeClient(balance: bigint, claimed: number) {
  const wallet = { id: "wallet-1", memberId: "member-1", availablePaisa: balance };
  const updateMany = vi.fn(async () => ({ count: claimed }));
  const findUnique = vi.fn(async () => wallet);
  const update = vi.fn(async () => wallet);
  const client = {
    wallet: { updateMany, findUnique, update },
  };
  return { client: client as unknown as Prisma.TransactionClient, updateMany, findUnique, update };
}

describe("debitWalletFieldIfSufficient", () => {
  it("spends through a conditional updateMany and reads the resulting balance", async () => {
    const { client, updateMany, findUnique, update } = fakeClient(9_000n, 1);

    const result = await debitWalletFieldIfSufficient(client, "member-1", "availablePaisa", 2_500n);

    expect(updateMany).toHaveBeenCalledTimes(1);
    expect(updateMany).toHaveBeenCalledWith({
      where: { memberId: "member-1", availablePaisa: { gte: 2_500n } },
      data: { availablePaisa: { decrement: 2_500n } },
    });
    expect(findUnique).toHaveBeenCalledWith({ where: { memberId: "member-1" } });
    expect(update).not.toHaveBeenCalled();
    expect(result).toEqual({ walletId: "wallet-1", balanceAfterPaisa: 9_000n });
  });

  it("returns null without touching the balance when the conditional claim loses", async () => {
    const { client, findUnique, update } = fakeClient(100n, 0);

    const result = await debitWalletFieldIfSufficient(client, "member-1", "availablePaisa", 200n);

    expect(result).toBeNull();
    expect(findUnique).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });

  it("rejects non-positive amounts before any database write", async () => {
    const { client, updateMany } = fakeClient(100n, 1);

    expect(await debitWalletFieldIfSufficient(client, "member-1", "availablePaisa", 0n)).toBeNull();
    expect(updateMany).not.toHaveBeenCalled();
  });
});

describe("isUniqueViolationOn", () => {
  it("distinguishes a version collision from other duplicate keys", () => {
    const versionError = {
      code: "P2002",
      meta: { target: ["RankPlanVersion_version_key"] },
    };
    const tokenError = { code: "P2002", meta: { target: ["commitToken"] } };
    // The table name itself contains "Version": it must not be mistaken for a
    // version-field collision, or a replayed commit would return STALE_VERSION.
    const tableTokenError = {
      code: "P2002",
      meta: { target: ["RankPlanVersion_commitToken_key"] },
    };

    expect(isUniqueViolationOn(versionError, "version")).toBe(true);
    expect(isUniqueViolationOn(tokenError, "version")).toBe(false);
    expect(isUniqueViolationOn(tableTokenError, "version")).toBe(false);
    expect(isUniqueViolationOn(new Error("other"), "version")).toBe(false);
  });
});
