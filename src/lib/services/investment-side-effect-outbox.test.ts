import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "../../generated/prisma/client";

const mocks = vi.hoisted(() => ({
  credit: vi.fn(),
  evaluate: vi.fn(),
}));

vi.mock("./operations", () => ({
  creditAffiliateRewardsForInvestment: mocks.credit,
}));

vi.mock("./rank-rewards", () => ({
  evaluateRanksForInvestment: mocks.evaluate,
}));

import {
  INVESTMENT_SIDE_EFFECT_GRACE_MS,
  flushInvestmentSideEffects,
  markInvestmentSideEffectProcessed,
  queueInvestmentSideEffect,
} from "./investment-side-effect-outbox";

function makeClient(rows: Record<string, unknown>[]) {
  const updates: Array<{ where: { id: string }; data: Record<string, unknown> }> = [];
  const updateManys: Array<{ where: Record<string, unknown>; data: Record<string, unknown> }> = [];
  const upserts: Array<Record<string, unknown>> = [];
  const client = {
    investmentSideEffectOutbox: {
      findMany: vi.fn(async () => rows),
      update: vi.fn(async (args: { where: { id: string }; data: Record<string, unknown> }) => {
        updates.push(args);
        return { ...args.data };
      }),
      updateMany: vi.fn(
        async (args: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
          updateManys.push(args);
          return { count: 1 };
        },
      ),
      upsert: vi.fn(async (args: Record<string, unknown>) => {
        upserts.push(args);
        return args;
      }),
    },
  } as unknown as PrismaClient;
  return { client, updates, updateManys, upserts };
}

function makeRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "row-1",
    kind: "AFFILIATE_REWARDS",
    investmentId: "inv-1",
    proofId: "proof-1",
    actorId: "admin-1",
    uplines: [{ memberId: "upline-1", level: 1 }],
    attempts: 0,
    lastError: null,
    nextAttemptAt: new Date(),
    createdAt: new Date(),
    processedAt: null,
    ...overrides,
  };
}

describe("investment side-effect outbox", () => {
  beforeEach(() => {
    mocks.credit.mockReset();
    mocks.evaluate.mockReset();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  it("queues one row per investment/proof/kind and resets retry state", async () => {
    const { client, upserts } = makeClient([]);

    await queueInvestmentSideEffect(client, {
      kind: "RANK_EVALUATION",
      investmentId: "inv-1",
      proofId: "proof-1",
      actorId: "admin-1",
    });

    expect(upserts).toHaveLength(1);
    expect(upserts[0]).toMatchObject({
      where: {
        investmentId_kind_proofId: {
          investmentId: "inv-1",
          kind: "RANK_EVALUATION",
          proofId: "proof-1",
        },
      },
      create: { kind: "RANK_EVALUATION", investmentId: "inv-1", proofId: "proof-1" },
      update: { attempts: 0, lastError: null, processedAt: null },
    });
  });

  it("defers transactional rows so the approving request can run them first", async () => {
    const { client, upserts } = makeClient([]);
    const before = Date.now();

    await queueInvestmentSideEffect(
      client,
      {
        kind: "RANK_EVALUATION",
        investmentId: "inv-1",
        proofId: "proof-1",
      },
      INVESTMENT_SIDE_EFFECT_GRACE_MS,
    );

    const create = upserts[0]?.create as { nextAttemptAt: Date } | undefined;
    expect(create?.nextAttemptAt.getTime()).toBeGreaterThanOrEqual(
      before + INVESTMENT_SIDE_EFFECT_GRACE_MS,
    );
  });

  it("marks a directly completed side effect processed", async () => {
    const { client, updateManys } = makeClient([]);

    await markInvestmentSideEffectProcessed(client, {
      kind: "AFFILIATE_REWARDS",
      investmentId: "inv-1",
      proofId: "proof-1",
    });

    expect(updateManys[0]?.where).toMatchObject({
      investmentId: "inv-1",
      kind: "AFFILIATE_REWARDS",
      proofId: "proof-1",
      processedAt: null,
    });
    expect(updateManys[0]?.data.processedAt).toBeInstanceOf(Date);
  });

  it("replays affiliate rewards with the stored upline snapshot and marks it processed", async () => {
    mocks.credit.mockResolvedValue({ appliedIds: [] });
    const { client, updates } = makeClient([makeRow()]);

    const result = await flushInvestmentSideEffects(client);

    expect(mocks.credit).toHaveBeenCalledWith(expect.anything(), {
      investmentId: "inv-1",
      uplines: [{ memberId: "upline-1", level: 1 }],
    });
    expect(updates[0]).toMatchObject({
      where: { id: "row-1" },
      data: { lastError: null },
    });
    expect(updates[0]?.data.processedAt).toBeInstanceOf(Date);
    expect(result).toEqual({ flushed: 1, failed: 0 });
  });

  it("keeps a failed row durable and schedules a later retry", async () => {
    mocks.credit.mockRejectedValue(new Error("credit failed"));
    const { client, updates } = makeClient([makeRow({ attempts: 1 })]);

    const result = await flushInvestmentSideEffects(client);

    expect(result).toEqual({ flushed: 0, failed: 1 });
    expect(updates[0]?.data).toMatchObject({ attempts: 2, lastError: "credit failed" });
    expect(updates[0]?.data.nextAttemptAt).toBeInstanceOf(Date);
    expect(console.error).toHaveBeenCalled();
  });

  it("replays rank evaluation for rank rows", async () => {
    mocks.evaluate.mockResolvedValue(0);
    const { client } = makeClient([
      makeRow({ id: "row-2", kind: "RANK_EVALUATION", uplines: null }),
    ]);

    const result = await flushInvestmentSideEffects(client);

    expect(mocks.evaluate).toHaveBeenCalledWith(expect.anything(), "inv-1");
    expect(result).toEqual({ flushed: 1, failed: 0 });
  });
});
