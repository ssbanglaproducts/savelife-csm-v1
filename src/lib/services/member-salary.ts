import type { PrismaClient } from "../../generated/prisma/client";
import { isSalaryRankKey, nextSalaryBoundary, type SalaryPlan } from "../salary";
import { getActiveSalaryPlan, serializeSalaryPlan, type SalaryPlanRankDto } from "./salary-plan";

/**
 * Salary data for the member's personal Salary tab. Amounts are serialized as
 * decimal strings so the DTO can cross the server/client boundary safely.
 * Failed postings never contribute to totals or successful-week progress.
 */
export type MemberSalaryPaymentDto = {
  id: string;
  rankKey: string;
  rankName: string;
  rankNameBn: string;
  amountPaisa: string;
  weekNumber: number;
  status: "SUCCESS" | "FAILED" | "PENDING";
  createdAt: string;
  weekEndAt: string;
  postedAt: string | null;
};

export type MemberSalaryDto = {
  entitlement: {
    rankKey: string;
    rankName: string;
    rankNameBn: string;
    maxWeeklySalaryPaisa: string;
    maxWeeks: number | null;
    weeksPaid: number;
    achievedAt: string;
  } | null;
  /** Active salary-plan values for every rank, used by the rank rewards UI. */
  salaryRanks: readonly SalaryPlanRankDto[];
  /** All successful payments across the member's history, including old ranks. */
  totalReceivedPaisa: string;
  payments: MemberSalaryPaymentDto[];
  nextDistributionAt: string;
};

function rankLabels(
  rankKey: string,
  plan: SalaryPlan,
): { rankName: string; rankNameBn: string } {
  const config = isSalaryRankKey(rankKey) ? plan.configs[rankKey] : null;
  return {
    rankName: config?.defaultName ?? rankKey,
    rankNameBn: config?.defaultNameBn ?? rankKey,
  };
}

export async function getMemberSalaryData(
  client: PrismaClient,
  memberId: string,
  now: Date = new Date(),
): Promise<MemberSalaryDto> {
  const plan = await getActiveSalaryPlan(client);
  const [entitlement, payments, received] = await Promise.all([
    client.salaryEntitlement.findUnique({
      where: { memberId },
      select: {
        rankKey: true,
        rankSortOrder: true,
        weeksPaid: true,
        achievedAt: true,
        isActive: true,
      },
    }),
    client.salaryPayment.findMany({
      where: { memberId },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      select: {
        id: true,
        rankKey: true,
        amountPaisa: true,
        weekNumber: true,
        status: true,
        createdAt: true,
        distribution: { select: { weekEndAt: true, postedAt: true } },
      },
    }),
    client.salaryPayment.aggregate({
      where: { memberId, status: "SUCCESS" },
      _sum: { amountPaisa: true },
    }),
  ]);

  const config =
    entitlement?.isActive && isSalaryRankKey(entitlement.rankKey)
      ? plan.configs[entitlement.rankKey]
      : null;
  const labels = entitlement ? rankLabels(entitlement.rankKey, plan) : null;

  return {
    entitlement:
      entitlement && labels && config
        ? {
            rankKey: entitlement.rankKey,
            ...labels,
            maxWeeklySalaryPaisa: config.maxWeeklySalaryPaisa.toString(),
            maxWeeks: config.maxWeeks,
            weeksPaid: entitlement.weeksPaid,
            achievedAt: entitlement.achievedAt.toISOString(),
          }
        : null,
    salaryRanks: serializeSalaryPlan(plan).ranks,
    totalReceivedPaisa: (received._sum.amountPaisa ?? 0n).toString(),
    payments: payments.map((payment) => ({
      id: payment.id,
      rankKey: payment.rankKey,
      ...rankLabels(payment.rankKey, plan),
      amountPaisa: payment.amountPaisa.toString(),
      weekNumber: payment.weekNumber,
      status:
        payment.status === "SUCCESS"
          ? "SUCCESS"
          : payment.status === "FAILED"
            ? "FAILED"
            : "PENDING",
      createdAt: payment.createdAt.toISOString(),
      weekEndAt: payment.distribution.weekEndAt.toISOString(),
      postedAt: payment.distribution.postedAt?.toISOString() ?? null,
    })),
    nextDistributionAt: nextSalaryBoundary(now).toISOString(),
  };
}
