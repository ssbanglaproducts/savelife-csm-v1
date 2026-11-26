import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { writeAuditLog } from "@/lib/audit";
import {
  LedgerEntryType as LedgerType,
  WalletCategory as Category,
} from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { ServiceError } from "@/lib/services/errors";
import { generateInstallmentSchedule } from "@/lib/services/installments";
import { adjustWalletField, recordLedgerEntry } from "@/lib/services/ledger";
import { resolveProfitOnlyMaturityDate } from "@/lib/services/maturity";
import { notifyInvestmentApproved } from "@/lib/services/notification-events";
import { creditAffiliateRewardsForInvestment } from "@/lib/services/operations";
import { evaluateRanksForInvestment } from "@/lib/services/rank-rewards";
import { fundSalaryTreasuriesForInvestment } from "@/lib/services/salary-funding";
import { getActiveSalaryPlan } from "@/lib/services/salary-plan";

export const dynamic = "force-dynamic";

const schema = z.object({
  proofId: z.string().min(1),
  action: z.enum(["APPROVE", "REJECT"]),
  note: z.string().trim().max(300).optional().default(""),
});

function errorResponse(code: string, status: number) {
  return NextResponse.json({ error: code }, { status });
}

export async function PATCH(request: Request) {
  const admin = await auth();
  if (admin?.user?.role !== "ADMIN" || !admin.user.id) {
    return errorResponse("FORBIDDEN", 403);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse("Invalid request", 400);
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) return errorResponse("Invalid request", 400);

  const { proofId, action, note } = parsed.data;
  const status = action === "APPROVE" ? "APPROVED" : "REJECTED";

  try {
    const investmentNotice: {
      value: {
        memberId: string;
        investmentNumber: string;
        amountPaisa: bigint;
      } | null;
    } = { value: null };
    const salaryFundingPaisa: { value: bigint } = { value: 0n };

    const result = await prisma.$transaction(async (tx) => {
      const proof = await tx.paymentProof.findUnique({
        where: { id: proofId },
        include: { investment: true, order: true },
      });
      if (!proof) return null;

      const updatedProof = await tx.paymentProof.update({
        where: { id: proofId },
        data: {
          status,
          reviewedBy: admin.user.id,
          reviewedAt: new Date(),
          note: note || null,
        },
        select: { id: true, memberId: true, orderId: true, investmentId: true },
      });

      let activatedInvestmentId: string | null = null;
      let uplines: Array<{ memberId: string; level: number }> = [];

      if (action === "APPROVE" && proof.orderId) {
        const order = await tx.order.findUnique({
          where: { id: proof.orderId },
          select: { status: true, memberId: true },
        });

        if (order?.status === "DELIVERED") {
          const activation = await tx.activationHistory.findUnique({
            where: { memberId: order.memberId },
            select: { id: true },
          });

          if (!activation) {
            await tx.activationHistory.create({
              data: {
                memberId: order.memberId,
                orderId: proof.orderId,
                activatedBy: admin.user.id,
                note: "Payment verified and order delivered",
              },
            });

            await tx.member.update({
              where: { id: order.memberId },
              data: { status: "ACTIVE", activationDate: new Date() },
            });
          }
        }
      }

      if (action === "APPROVE" && proof.investmentId && proof.investment) {
        const investment = proof.investment;

        if (investment.status === "PENDING") {
          const now = new Date();
          const startDate = investment.startDate ?? now;
          const lockInEndsAt =
            investment.type === "PROFIT_ONLY"
              ? resolveProfitOnlyMaturityDate({
                  lockInEndsAt: investment.lockInEndsAt,
                  startDate: investment.startDate,
                  lockInMonths: investment.lockInMonths,
                  fallbackStartDate: now,
                })
              : null;

          let monthlyInstallmentPaisa = investment.monthlyInstallmentPaisa;

          if (investment.type === "INSTALLMENT" && investment.durationMonths) {
            const schedule = generateInstallmentSchedule({
              amountPaisa: investment.amountPaisa,
              months: investment.durationMonths,
              startDate,
            });

            await tx.investmentInstallment.createMany({
              data: schedule.entries.map((item) => ({
                investmentId: investment.id,
                periodNo: item.periodNo,
                dueDate: item.dueDate,
                amountPaisa: item.amountPaisa,
              })),
              skipDuplicates: true,
            });
            monthlyInstallmentPaisa = schedule.monthlyInstallmentPaisa;
          }

          await tx.investment.update({
            where: { id: investment.id },
            data: {
              status: "ACTIVE",
              startDate,
              lockInEndsAt,
              monthlyInstallmentPaisa,
              remainingPrincipalPaisa: investment.amountPaisa,
              verifiedBy: admin.user.id,
              verifiedAt: now,
            },
          });

          const principal = await adjustWalletField(
            tx,
            investment.memberId,
            "investmentPaisa",
            investment.amountPaisa,
            "CREDIT",
          );
          await recordLedgerEntry(tx, {
            walletId: principal.walletId,
            memberId: investment.memberId,
            category: Category.INVESTMENT,
            direction: "CREDIT",
            amountPaisa: investment.amountPaisa,
            balanceAfterPaisa: principal.balanceAfterPaisa,
            type: LedgerType.INVESTMENT_PRINCIPAL,
            idempotencyKey: `principal-${investment.id}`,
            referenceType: "Investment",
            referenceId: investment.id,
            investmentId: investment.id,
            description: `Principal received for ${investment.investmentNumber}`,
            createdBy: admin.user.id,
          });

          // Salary treasuries are funded from the investment amount itself.
          // This is atomic with activation and idempotent per investment.
          const salaryPlan = await getActiveSalaryPlan(tx);
          const salaryFunding = await fundSalaryTreasuriesForInvestment(
            tx,
            {
              investmentId: investment.id,
              amountPaisa: investment.amountPaisa,
            },
            salaryPlan,
          );
          salaryFundingPaisa.value = salaryFunding.totalPaisa;

          const uplineRows = await tx.upline.findMany({
            where: { memberId: investment.memberId, level: { in: [1, 2, 3] } },
            orderBy: { level: "asc" },
            select: { uplineId: true, level: true },
          });
          uplines = uplineRows.map((item) => ({ memberId: item.uplineId, level: item.level }));
          activatedInvestmentId = investment.id;
          investmentNotice.value = {
            memberId: investment.memberId,
            investmentNumber: investment.investmentNumber,
            amountPaisa: investment.amountPaisa,
          };
        }
      }

      return { proof: updatedProof, activatedInvestmentId, uplines };
    });

    if (!result) return errorResponse("NOT_FOUND", 404);

    if (investmentNotice.value) {
      await notifyInvestmentApproved(
        investmentNotice.value.memberId,
        investmentNotice.value.investmentNumber,
        investmentNotice.value.amountPaisa,
      );
    }

    let affiliateRewardsApplied = false;
    let rankAchievementsAwarded = 0;
    if (result.activatedInvestmentId) {
      try {
        await creditAffiliateRewardsForInvestment(prisma, {
          investmentId: result.activatedInvestmentId,
          uplines: result.uplines,
        });
        affiliateRewardsApplied = true;
      } catch (error) {
        // The investment is already active and its principal is recorded. A
        // reward failure must not roll that back; it is audited for retry.
        console.error("Affiliate reward crediting failed", error);
        await writeAuditLog({
          actorId: admin.user.id,
          actorRole: "ADMIN",
          action: "AFFILIATE_REWARD_CREDIT_FAILED",
          entityType: "Investment",
          entityId: result.activatedInvestmentId,
          after: { proofId: result.proof.id },
        });
      }

      // Ranks depend on the whole placement tree and the sponsor chain, so
      // evaluation happens after the investment transaction commits. A failure
      // is audited rather than rolling back the approved investment.
      try {
        rankAchievementsAwarded = await evaluateRanksForInvestment(
          prisma,
          result.activatedInvestmentId,
        );
      } catch (error) {
        console.error("Rank evaluation failed after investment approval", error);
        await writeAuditLog({
          actorId: admin.user.id,
          actorRole: "ADMIN",
          action: "RANK_EVALUATION_FAILED",
          entityType: "Investment",
          entityId: result.activatedInvestmentId,
          after: { proofId: result.proof.id },
        });
      }
    }

    await writeAuditLog({
      actorId: admin.user.id,
      actorRole: "ADMIN",
      action: "PAYMENT_PROOF_REVIEWED",
      entityType: "PaymentProof",
      entityId: result.proof.id,
      after: {
        status,
        activatedInvestmentId: result.activatedInvestmentId,
        affiliateRewardsApplied,
        rankAchievementsAwarded,
        salaryFundingPaisa: salaryFundingPaisa.value.toString(),
      },
    });

    return NextResponse.json({ ok: true, affiliateRewardsApplied, rankAchievementsAwarded });
  } catch (error) {
    if (error instanceof ServiceError) return errorResponse(error.code, 400);
    console.error("Payment proof review failed", error);
    return errorResponse("UPDATE_FAILED", 500);
  }
}
