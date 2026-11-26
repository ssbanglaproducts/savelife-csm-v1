import type { PrismaClient } from "../../generated/prisma/client";
import { sumPaisa, type Paisa } from "../money";
import {
  DEFAULT_SALARY_PLAN,
  enabledSalaryRankKeys,
  isSalaryRankKey,
  latestSalaryBoundary,
  planSalaryPayments,
  type SalaryPlan,
} from "../salary";
import { adjustWalletField, isUniqueViolation, makeKey, recordLedgerEntry } from "./ledger";

export interface SalaryDistributionInput {
  readonly asOf?: Date;
  readonly createdBy?: string;
}

export interface SalaryDistributionResult {
  readonly applied: boolean;
  readonly reason?: "DUPLICATE";
  readonly distributionId?: string;
  readonly weekEndAt: string;
  readonly totalPaidPaisa: Paisa;
  readonly recipientCount: number;
  readonly failedCount: number;
}

interface EligibleEntitlement {
  readonly id: string;
  readonly memberId: string;
  readonly memberName: string;
  readonly rankKey: string;
  readonly weeksPaid: number;
}

/**
 * Posts one weekly salary distribution for the Sunday 00:00 BDT boundary at or
 * before `asOf`. Every rank is calculated from its own treasury, and all
 * successful credits are committed atomically. Re-running the same week is a
 * no-op.
 */
export async function runSalaryDistribution(
  client: PrismaClient,
  input: SalaryDistributionInput = {},
  plan: SalaryPlan = DEFAULT_SALARY_PLAN,
): Promise<SalaryDistributionResult> {
  const asOf = input.asOf ?? new Date();
  if (!(asOf instanceof Date) || Number.isNaN(asOf.getTime())) {
    throw new Error("A valid asOf date is required");
  }
  const weekEndAt = latestSalaryBoundary(asOf);
  const weekEndIso = weekEndAt.toISOString();
  const enabledRankKeys = enabledSalaryRankKeys(plan);

  const existing = await client.salaryDistribution.findUnique({
    where: { weekEndAt },
    select: { id: true },
  });
  if (existing) {
    return {
      applied: false,
      reason: "DUPLICATE",
      distributionId: existing.id,
      weekEndAt: weekEndIso,
      totalPaidPaisa: 0n,
      recipientCount: 0,
      failedCount: 0,
    };
  }

  try {
    return await client.$transaction(async (tx) => {
      const repeated = await tx.salaryDistribution.findUnique({
        where: { weekEndAt },
        select: { id: true },
      });
      if (repeated) {
        return {
          applied: false as const,
          reason: "DUPLICATE" as const,
          distributionId: repeated.id,
          weekEndAt: weekEndIso,
          totalPaidPaisa: 0n,
          recipientCount: 0,
          failedCount: 0,
        };
      }

      const [treasuryRows, entitlementRows] = await Promise.all([
        tx.salaryTreasury.findMany({
          where: { rankKey: { in: [...enabledRankKeys] } },
          select: { rankKey: true, balancePaisa: true },
        }),
        tx.salaryEntitlement.findMany({
          where: {
            isActive: true,
            rankKey: { in: [...enabledRankKeys] },
            member: { status: "ACTIVE" },
          },
          select: {
            id: true,
            memberId: true,
            rankKey: true,
            weeksPaid: true,
            member: { select: { fullName: true } },
          },
          orderBy: [{ rankKey: "asc" }, { memberId: "asc" }],
        }),
      ]);

      const balances = new Map(
        treasuryRows.map((row) => [row.rankKey, row.balancePaisa] as const),
      );
      const eligibleByRank = new Map<string, EligibleEntitlement[]>();
      for (const row of entitlementRows) {
        if (!isSalaryRankKey(row.rankKey)) continue;
        const config = plan.configs[row.rankKey];
        if (config.maxWeeks !== null && row.weeksPaid >= config.maxWeeks) continue;
        const list = eligibleByRank.get(row.rankKey) ?? [];
        list.push({
          id: row.id,
          memberId: row.memberId,
          memberName: row.member.fullName,
          rankKey: row.rankKey,
          weeksPaid: row.weeksPaid,
        });
        eligibleByRank.set(row.rankKey, list);
      }

      const paymentPlans = enabledRankKeys.map((rankKey) => {
        const recipients = eligibleByRank.get(rankKey) ?? [];
        const config = plan.configs[rankKey];
        return {
          rankKey,
          recipients,
          plan: planSalaryPayments(
            balances.get(rankKey) ?? 0n,
            recipients.length,
            config.maxWeeklySalaryPaisa,
          ),
        };
      });

      const totalTreasuryPaisa = sumPaisa(
        enabledRankKeys.map((rankKey) => balances.get(rankKey) ?? 0n),
      );

      const distribution = await tx.salaryDistribution.create({
        data: {
          weekEndAt,
          status: "POSTED",
          totalTreasuryPaisa,
          totalPaidPaisa: 0n,
          recipientCount: 0,
          postedAt: asOf,
          salaryPlanVersionId: plan.versionId,
        },
      });

      let totalPaidPaisa = 0n;
      let recipientCount = 0;
      let failedCount = 0;

      for (const { rankKey, recipients, plan: rankPlan } of paymentPlans) {
        const config = plan.configs[rankKey];
        for (let index = 0; index < recipients.length; index += 1) {
          const recipient = recipients[index];
          const amountPaisa = rankPlan.amounts[index] ?? 0n;
          if (amountPaisa <= 0n) continue;

          // Claim from the rank's own treasury first. A failed claim is a
          // failed payment: no wallet credit and no completed salary week.
          const claimed = await tx.salaryTreasury.updateMany({
            where: { rankKey, balancePaisa: { gte: amountPaisa } },
            data: {
              balancePaisa: { decrement: amountPaisa },
              totalPaidPaisa: { increment: amountPaisa },
            },
          });
          if (claimed.count === 0) {
            await tx.salaryPayment.create({
              data: {
                distributionId: distribution.id,
                memberId: recipient.memberId,
                entitlementId: recipient.id,
                rankKey,
                amountPaisa,
                weekNumber: recipient.weeksPaid + 1,
                status: "FAILED",
              },
            });
            failedCount += 1;
            continue;
          }

          await tx.wallet.upsert({
            where: { memberId: recipient.memberId },
            create: { memberId: recipient.memberId },
            update: {},
          });
          const balance = await adjustWalletField(
            tx,
            recipient.memberId,
            "salaryPaisa",
            amountPaisa,
            "CREDIT",
          );
          await recordLedgerEntry(tx, {
            walletId: balance.walletId,
            memberId: recipient.memberId,
            category: "SALARY",
            direction: "CREDIT",
            amountPaisa,
            balanceAfterPaisa: balance.balanceAfterPaisa,
            type: "SALARY_PAYMENT",
            idempotencyKey: makeKey("salary-payment", weekEndIso, recipient.memberId),
            referenceType: "SalaryDistribution",
            referenceId: distribution.id,
            description: `Weekly salary: ${config.defaultName}`,
            createdBy: input.createdBy,
          });
          await tx.salaryPayment.create({
            data: {
              distributionId: distribution.id,
              memberId: recipient.memberId,
              entitlementId: recipient.id,
              rankKey,
              amountPaisa,
              weekNumber: recipient.weeksPaid + 1,
              status: "SUCCESS",
            },
          });
          await tx.salaryEntitlement.update({
            where: { id: recipient.id },
            data: { weeksPaid: { increment: 1 } },
          });

          totalPaidPaisa += amountPaisa;
          recipientCount += 1;
        }
      }

      await tx.salaryDistribution.update({
        where: { id: distribution.id },
        data: { totalPaidPaisa, recipientCount },
      });

      return {
        applied: true,
        distributionId: distribution.id,
        weekEndAt: weekEndIso,
        totalPaidPaisa,
        recipientCount,
        failedCount,
      };
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      const raced = await client.salaryDistribution.findUnique({
        where: { weekEndAt },
        select: { id: true },
      });
      return {
        applied: false,
        reason: "DUPLICATE",
        distributionId: raced?.id,
        weekEndAt: weekEndIso,
        totalPaidPaisa: 0n,
        recipientCount: 0,
        failedCount: 0,
      };
    }
    throw error;
  }
}
