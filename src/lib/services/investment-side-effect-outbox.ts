import type { Prisma, PrismaClient } from "../../generated/prisma/client";
import { creditAffiliateRewardsForInvestment } from "./operations";
import { evaluateRanksForInvestment } from "./rank-rewards";

export type InvestmentSideEffectKind = "AFFILIATE_REWARDS" | "RANK_EVALUATION";

export type UplineSnapshot = {
  memberId: string;
  level: number;
};

export interface InvestmentSideEffectInput {
  readonly kind: InvestmentSideEffectKind;
  readonly investmentId: string;
  readonly proofId: string;
  readonly actorId?: string | null;
  readonly uplines?: readonly UplineSnapshot[];
}

export interface InvestmentSideEffectFlushResult {
  readonly flushed: number;
  readonly failed: number;
}

const MAX_BATCH = 25;
const BACKOFF_BASE_MS = 2_000;
const MAX_BACKOFF_MS = 60_000;

/** Gives the request that committed the approval time to run side effects first. */
export const INVESTMENT_SIDE_EFFECT_GRACE_MS = 60_000;

function errorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.slice(0, 500);
}

function parseUplines(value: Prisma.JsonValue | null): readonly UplineSnapshot[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return [];
    const candidate = item as { memberId?: unknown; level?: unknown };
    if (
      typeof candidate.memberId !== "string" ||
      typeof candidate.level !== "number" ||
      !Number.isInteger(candidate.level)
    ) {
      return [];
    }
    return [{ memberId: candidate.memberId, level: candidate.level }];
  });
}

type InvestmentOutboxClient = PrismaClient | Prisma.TransactionClient;

/** Queues a post-commit side effect once per investment/proof/kind. */
export async function queueInvestmentSideEffect(
  client: InvestmentOutboxClient,
  input: InvestmentSideEffectInput,
  delayMs = 0,
): Promise<void> {
  await client.investmentSideEffectOutbox.upsert({
    where: {
      investmentId_kind_proofId: {
        investmentId: input.investmentId,
        kind: input.kind,
        proofId: input.proofId,
      },
    },
    create: {
      kind: input.kind,
      investmentId: input.investmentId,
      proofId: input.proofId,
      actorId: input.actorId ?? null,
      uplines: (input.uplines ?? []) as Prisma.InputJsonValue,
      nextAttemptAt: new Date(Date.now() + delayMs),
    },
    update: {
      actorId: input.actorId ?? null,
      uplines: (input.uplines ?? []) as Prisma.InputJsonValue,
      attempts: 0,
      lastError: null,
      nextAttemptAt: new Date(Date.now() + delayMs),
      processedAt: null,
    },
  });
}

/** Marks a row complete after its in-request attempt succeeds. */
export async function markInvestmentSideEffectProcessed(
  client: InvestmentOutboxClient,
  input: InvestmentSideEffectInput,
): Promise<void> {
  await client.investmentSideEffectOutbox.updateMany({
    where: {
      investmentId: input.investmentId,
      kind: input.kind,
      proofId: input.proofId,
      processedAt: null,
    },
    data: { processedAt: new Date(), lastError: null },
  });
}

/**
 * Replays due side effects. The underlying reward and rank services are
 * idempotent, so a retry cannot duplicate ledger entries or achievements.
 */
export async function flushInvestmentSideEffects(
  client: PrismaClient,
  limit = MAX_BATCH,
): Promise<InvestmentSideEffectFlushResult> {
  const due = await client.investmentSideEffectOutbox.findMany({
    where: { processedAt: null, nextAttemptAt: { lte: new Date() } },
    orderBy: { createdAt: "asc" },
    take: Math.max(1, Math.min(limit, MAX_BATCH)),
  });

  let flushed = 0;
  let failed = 0;

  for (const row of due) {
    try {
      if (row.kind === "AFFILIATE_REWARDS") {
        await creditAffiliateRewardsForInvestment(client, {
          investmentId: row.investmentId,
          uplines: parseUplines(row.uplines),
        });
      } else if (row.kind === "RANK_EVALUATION") {
        await evaluateRanksForInvestment(client, row.investmentId);
      } else {
        throw new Error(`UNKNOWN_SIDE_EFFECT_KIND:${row.kind}`);
      }

      await client.investmentSideEffectOutbox.update({
        where: { id: row.id },
        data: { processedAt: new Date(), lastError: null },
      });
      flushed += 1;
    } catch (error) {
      failed += 1;
      const attempts = row.attempts + 1;
      const delay = Math.min(MAX_BACKOFF_MS, BACKOFF_BASE_MS * 2 ** Math.min(attempts, 5));
      console.error(
        "Investment side-effect replay failed",
        {
          id: row.id,
          kind: row.kind,
          investmentId: row.investmentId,
          attempts,
        },
        error,
      );
      try {
        await client.investmentSideEffectOutbox.update({
          where: { id: row.id },
          data: {
            attempts,
            lastError: errorMessage(error),
            nextAttemptAt: new Date(Date.now() + delay),
          },
        });
      } catch (updateError) {
        console.error("Investment side-effect retry schedule failed", { id: row.id }, updateError);
      }
    }
  }

  return { flushed, failed };
}
