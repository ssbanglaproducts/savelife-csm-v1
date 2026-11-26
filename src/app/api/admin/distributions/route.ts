import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { writeAuditLog } from "@/lib/audit";
import { spToPaisa } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import { formatDistributionMonth } from "@/lib/services/date";
import { loadEligibleInvestments } from "@/lib/services/distribution";
import { ServiceError } from "@/lib/services/errors";
import { postProfitDistribution } from "@/lib/services/operations";
import { computeProfitPerThousandPaisa } from "@/lib/services/profit";

export const dynamic = "force-dynamic";

const schema = z.object({
  amount: z.string().trim().regex(/^\d+(\.\d{1,2})?$/),
});

function errorResponse(code: string, status: number) {
  return NextResponse.json({ error: code }, { status });
}

export async function POST(request: Request) {
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
  if (!parsed.success) return errorResponse("Invalid amount", 400);

  try {
    const distributable = spToPaisa(parsed.data.amount);
    if (distributable <= 0n) return errorResponse("Invalid amount", 400);

    const eligible = await loadEligibleInvestments(prisma);
    if (eligible.length === 0) return errorResponse("NO_ELIGIBLE_INVESTMENTS", 400);
    const totalEligible = eligible.reduce((sum, item) => sum + item.eligiblePaisa, 0n);

    // Auto-stamped: no caller-supplied month, so repeated posts on the same day
    // each create their own distribution.
    const month = formatDistributionMonth(new Date());
    const result = await postProfitDistribution(prisma, {
      month,
      distributablePaisa: distributable,
      eligible,
      createdBy: admin.user.id,
    });

    if (!result.applied) return errorResponse("DISTRIBUTION_FAILED", 500);

    await writeAuditLog({
      actorId: admin.user.id,
      actorRole: "ADMIN",
      action: "PROFIT_DISTRIBUTION_POSTED",
      entityType: "ProfitDistribution",
      entityId: result.distributionId,
      after: {
        month,
        distributablePaisa: distributable.toString(),
        allocatedPaisa: result.allocatedPaisa.toString(),
        recipients: eligible.length,
      },
    });

    if (result.roiCommission) {
      await writeAuditLog({
        actorId: admin.user.id,
        actorRole: "ADMIN",
        action: "ROI_COMMISSION_POSTED",
        entityType: "RoiCommissionDistribution",
        entityId: result.roiCommission.distributionId,
        after: {
          month,
          totalBasisPaisa: result.roiCommission.totalBasisPaisa.toString(),
          totalCommissionPaisa: result.roiCommission.totalCommissionPaisa.toString(),
          recipients: result.roiCommission.recipientCount,
        },
      });
    }

    return NextResponse.json(
      {
        ok: true,
        distribution: {
          id: result.distributionId,
          month,
          profitPerThousandPaisa: computeProfitPerThousandPaisa(distributable, totalEligible).toString(),
        },
        roiCommission: result.roiCommission
          ? {
              totalCommissionPaisa: result.roiCommission.totalCommissionPaisa.toString(),
              recipientCount: result.roiCommission.recipientCount,
            }
          : null,
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof ServiceError) {
      return errorResponse(error.code === "INVALID_INPUT" ? "Invalid amount" : error.code, 400);
    }
    return errorResponse("DISTRIBUTION_FAILED", 500);
  }
}
