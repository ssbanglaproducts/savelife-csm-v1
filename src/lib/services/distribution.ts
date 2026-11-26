import type { PrismaClient } from "../../generated/prisma/client";
import type { Paisa } from "../money";
import {
  calculateMonthlyProfitDistribution,
  computeProfitPerThousandPaisa,
  type ProfitEligibleInvestment,
} from "./profit";

export interface DistributionRecipient {
  readonly memberId: string;
  readonly memberNo: string;
  readonly name: string;
  readonly investedPaisa: Paisa;
  readonly receivingPaisa: Paisa;
}

type AccumulatedRecipient = {
  -readonly [K in keyof DistributionRecipient]: DistributionRecipient[K];
};

export interface DistributionPreview {
  readonly distributablePaisa: Paisa;
  readonly totalEligiblePaisa: Paisa;
  readonly profitPerThousandPaisa: Paisa;
  readonly recipients: readonly DistributionRecipient[];
}

/** Capital still in the business is the eligible pool for a distribution. */
export async function loadEligibleInvestments(
  client: PrismaClient,
): Promise<readonly ProfitEligibleInvestment[]> {
  const investments = await client.investment.findMany({
    where: { status: "ACTIVE", remainingPrincipalPaisa: { gt: 0n } },
    select: { id: true, memberId: true, remainingPrincipalPaisa: true },
    orderBy: { createdAt: "asc" },
  });
  return investments.map((item) => ({
    investmentId: item.id,
    memberId: item.memberId,
    eligiblePaisa: item.remainingPrincipalPaisa,
  }));
}

/**
 * Computes the exact recipients for a distributable amount without writing
 * anything. The same calculation is used by the confirmation preview and by
 * the post endpoint, so the numbers shown to the admin are the numbers applied.
 * A member with multiple active investments appears once, with totals summed.
 */
export async function buildDistributionPreview(
  client: PrismaClient,
  distributablePaisa: Paisa,
): Promise<DistributionPreview | null> {
  const investments = await client.investment.findMany({
    where: { status: "ACTIVE", remainingPrincipalPaisa: { gt: 0n } },
    select: {
      id: true,
      remainingPrincipalPaisa: true,
      member: { select: { id: true, memberId: true, fullName: true } },
    },
    orderBy: { createdAt: "asc" },
  });
  if (investments.length === 0) return null;

  const calculation = calculateMonthlyProfitDistribution(
    distributablePaisa,
    investments.map((item) => ({
      investmentId: item.id,
      memberId: item.member.id,
      eligiblePaisa: item.remainingPrincipalPaisa,
    })),
  );

  const members = new Map(
    investments.map((item) => [item.member.id, item.member] as const),
  );

  const recipients = new Map<string, AccumulatedRecipient>();
  for (const line of calculation.lines) {
    const member = members.get(line.memberId);
    const existing = recipients.get(line.memberId);
    if (existing) {
      existing.investedPaisa += line.eligiblePaisa;
      existing.receivingPaisa += line.allocatedPaisa;
      continue;
    }
    recipients.set(line.memberId, {
      memberId: line.memberId,
      memberNo: member?.memberId ?? "",
      name: member?.fullName ?? "",
      investedPaisa: line.eligiblePaisa,
      receivingPaisa: line.allocatedPaisa,
    });
  }

  return {
    distributablePaisa: calculation.distributablePaisa,
    totalEligiblePaisa: calculation.totalEligiblePaisa,
    profitPerThousandPaisa: computeProfitPerThousandPaisa(
      calculation.distributablePaisa,
      calculation.totalEligiblePaisa,
    ),
    recipients: [...recipients.values()],
  };
}
