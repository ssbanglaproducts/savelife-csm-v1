import { describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "../../generated/prisma/client";
import { loadAffiliateCommissionHistory } from "./affiliate-commissions-history";

function row() {
  return {
    id: "reward-1",
    createdAt: new Date("2026-05-10T12:00:00.000Z"),
    level: 2,
    rateBps: 150,
    amountPaisa: 12_345n,
    beneficiary: { memberId: "SL000002", fullName: "Recipient" },
    investment: {
      investmentNumber: "INV-2026-0001",
      member: { memberId: "SL000001", fullName: "Source" },
    },
  };
}

function asyncStub<T>(value: T) {
  return vi.fn(async (args: unknown) => {
    void args;
    return value;
  });
}

function makeClient() {
  const findMany = asyncStub([row()]);
  const count = asyncStub(3);
  const aggregate = asyncStub({ _sum: { amountPaisa: 98_765n } });

  const client = {
    affiliateReward: { findMany, count, aggregate },
  } as unknown as PrismaClient;

  return { client, findMany, count, aggregate };
}

describe("affiliate commission history", () => {
  it("is a read-only member-scoped log that preserves BigInt amounts", async () => {
    const { client, findMany, count, aggregate } = makeClient();

    const result = await loadAffiliateCommissionHistory(client);

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          beneficiary: { role: "MEMBER" },
          investment: { member: { role: "MEMBER" } },
        },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip: 0,
        take: 20,
      }),
    );
    expect(count).toHaveBeenCalledWith({
      where: {
        beneficiary: { role: "MEMBER" },
        investment: { member: { role: "MEMBER" } },
      },
    });
    expect(aggregate).toHaveBeenCalledWith({
      where: {
        beneficiary: { role: "MEMBER" },
        investment: { member: { role: "MEMBER" } },
      },
      _sum: { amountPaisa: true },
    });
    expect(result.rows).toEqual([
      {
        id: "reward-1",
        createdAt: new Date("2026-05-10T12:00:00.000Z"),
        level: 2,
        rateBps: 150,
        amountPaisa: 12_345n,
        beneficiary: { memberId: "SL000002", fullName: "Recipient" },
        sourceMember: { memberId: "SL000001", fullName: "Source" },
        investmentNumber: "INV-2026-0001",
      },
    ]);
    expect(result.total).toBe(3);
    expect(result.totalPaisa).toBe(98_765n);
    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(20);
    expect(result.totalPages).toBe(1);
  });

  it("applies search, level, month and paging filters", async () => {
    const { client, findMany, count } = makeClient();

    await loadAffiliateCommissionHistory(client, {
      q: "  SL000001  ",
      level: 3,
      month: "2026-05",
      page: 2,
      pageSize: 10,
    });

    const args = findMany.mock.calls[0][0] as {
      where: {
        OR: unknown[];
        level: number;
        createdAt: { gte: Date; lt: Date };
      };
      skip: number;
      take: number;
    };
    const where = args.where;

    expect(where.OR).toEqual([
      { beneficiary: { memberId: { contains: "SL000001", mode: "insensitive" } } },
      { beneficiary: { fullName: { contains: "SL000001", mode: "insensitive" } } },
      { investment: { member: { memberId: { contains: "SL000001", mode: "insensitive" } } } },
      { investment: { member: { fullName: { contains: "SL000001", mode: "insensitive" } } } },
      { investment: { investmentNumber: { contains: "SL000001", mode: "insensitive" } } },
    ]);
    expect(where.level).toBe(3);
    expect(where.createdAt).toEqual({
      gte: new Date("2026-05-01T00:00:00.000Z"),
      lt: new Date("2026-06-01T00:00:00.000Z"),
    });
    expect(args.skip).toBe(10);
    expect(args.take).toBe(10);
    expect(count).toHaveBeenCalledWith({ where });
  });

  it("ignores invalid filters and clamps paging to safe defaults", async () => {
    const { client, findMany } = makeClient();

    const result = await loadAffiliateCommissionHistory(client, {
      level: 0,
      month: "not-a-month",
      page: -4,
      pageSize: 0,
    });
    const args = findMany.mock.calls[0][0] as {
      where: { level?: number; createdAt?: unknown };
      skip: number;
      take: number;
    };

    expect(args.where.level).toBeUndefined();
    expect(args.where.createdAt).toBeUndefined();
    expect(args.skip).toBe(0);
    expect(args.take).toBe(20);
    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(20);
  });
});
