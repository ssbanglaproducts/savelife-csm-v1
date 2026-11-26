import { describe, expect, it } from "vitest";
import type { PrismaClient } from "../../generated/prisma/client";
import { spToPaisa } from "../money";
import { buildDistributionPreview } from "./distribution";

function fakeClient(rows: readonly unknown[]): PrismaClient {
  return {
    investment: { findMany: async () => rows },
  } as unknown as PrismaClient;
}

const investments = [
  {
    id: "i1",
    remainingPrincipalPaisa: spToPaisa("1000"),
    member: { id: "m1", memberId: "SL000001", fullName: "Alice" },
  },
  {
    id: "i3",
    remainingPrincipalPaisa: spToPaisa("1000"),
    member: { id: "m1", memberId: "SL000001", fullName: "Alice" },
  },
  {
    id: "i2",
    remainingPrincipalPaisa: spToPaisa("3000"),
    member: { id: "m2", memberId: "SL000002", fullName: "Bob" },
  },
];

describe("buildDistributionPreview", () => {
  it("returns one row per member with their invested and receiving totals", async () => {
    const preview = await buildDistributionPreview(fakeClient(investments), spToPaisa("500"));

    expect(preview).not.toBeNull();
    expect(preview?.totalEligiblePaisa).toBe(spToPaisa("5000"));
    expect(preview?.profitPerThousandPaisa).toBe(spToPaisa("100"));
    expect(preview?.recipients).toEqual([
      {
        memberId: "m1",
        memberNo: "SL000001",
        name: "Alice",
        investedPaisa: spToPaisa("2000"),
        receivingPaisa: spToPaisa("200"),
      },
      {
        memberId: "m2",
        memberNo: "SL000002",
        name: "Bob",
        investedPaisa: spToPaisa("3000"),
        receivingPaisa: spToPaisa("300"),
      },
    ]);
  });

  it("returns null when there are no eligible investments", async () => {
    expect(await buildDistributionPreview(fakeClient([]), spToPaisa("100"))).toBeNull();
  });
});
