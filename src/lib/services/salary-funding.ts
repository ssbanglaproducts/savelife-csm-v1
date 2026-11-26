import type { Prisma, PrismaClient } from "../../generated/prisma/client";
import {
  DEFAULT_SALARY_PLAN,
  enabledSalaryRankKeys,
  planSalaryAllocations,
  type SalaryPlan,
  type SalaryRankKey,
} from "../salary";
import type { Paisa } from "../money";

type Client = PrismaClient | Prisma.TransactionClient;

export interface SalaryFundingResult {
  readonly applied: boolean;
  readonly fundedRanks: readonly SalaryRankKey[];
  readonly totalPaisa: Paisa;
}

/**
 * Allocates the active plan's configured percentages into each enabled rank
 * treasury. The composite unique key makes a repeat call a no-op, so each
 * eligible investment is counted exactly once.
 */
export async function fundSalaryTreasuriesForInvestment(
  client: Client,
  input: { investmentId: string; amountPaisa: Paisa },
  plan: SalaryPlan = DEFAULT_SALARY_PLAN,
): Promise<SalaryFundingResult> {
  if (input.amountPaisa < 0n) throw new Error("Investment amount cannot be negative");

  const existing = await client.salaryFunding.findMany({
    where: { investmentId: input.investmentId },
    select: { rankKey: true },
  });
  const existingKeys = new Set(existing.map((row) => row.rankKey));
  const missing = enabledSalaryRankKeys(plan).filter(
    (rankKey) => !existingKeys.has(rankKey),
  );
  if (missing.length === 0) {
    return { applied: false, fundedRanks: [], totalPaisa: 0n };
  }

  const allocations = planSalaryAllocations(input.amountPaisa, plan);
  const run = async (tx: Prisma.TransactionClient): Promise<SalaryFundingResult> => {
    const created = await tx.salaryFunding.createMany({
      data: missing.map((rankKey) => ({
        id: `salary-funding:${input.investmentId}:${rankKey}`,
        investmentId: input.investmentId,
        rankKey,
        amountPaisa: allocations[rankKey],
      })),
      skipDuplicates: true,
    });
    if (created.count === 0) {
      return { applied: false, fundedRanks: [], totalPaisa: 0n };
    }

    const fundedRanks: SalaryRankKey[] = [];
    let totalPaisa = 0n;
    for (const rankKey of missing) {
      const amountPaisa = allocations[rankKey];
      await tx.salaryTreasury.upsert({
        where: { rankKey },
        create: {
          rankKey,
          balancePaisa: amountPaisa,
          totalAllocatedPaisa: amountPaisa,
          totalPaidPaisa: 0n,
        },
        update: {
          balancePaisa: { increment: amountPaisa },
          totalAllocatedPaisa: { increment: amountPaisa },
        },
      });
      fundedRanks.push(rankKey);
      totalPaisa += amountPaisa;
    }

    return { applied: true, fundedRanks, totalPaisa };
  };

  if ("$transaction" in client && typeof client.$transaction === "function") {
    return client.$transaction(run);
  }
  return run(client as Prisma.TransactionClient);
}
