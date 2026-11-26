import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { writeAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { ServiceError } from "@/lib/services/errors";
import { notifyInvestmentRejected } from "@/lib/services/notification-events";
import { reverseInstallmentCredit } from "@/lib/services/operations";

export const dynamic = "force-dynamic";

const schema = z.object({
  action: z.enum(["APPROVE", "REJECT", "REVERSE_INSTALLMENT"]),
  investmentId: z.string().min(1).optional(),
  installmentId: z.string().min(1).optional(),
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
  if (!parsed.success) return errorResponse("Invalid request", 400);

  const { action, investmentId, installmentId } = parsed.data;

  // Activating an investment moves principal, creates the contractual schedule
  // and plans affiliate rewards. That belongs to payment-proof review only;
  // a bare status flip here would leave money and ledger state inconsistent.
  if (action === "APPROVE") {
    return errorResponse("APPROVE_VIA_PAYMENT_PROOF", 400);
  }

  try {
    let processed = 0;
    let entityId: string | null = investmentId ?? installmentId ?? null;
    let after: Record<string, string | number | boolean> = {};

    if (action === "REVERSE_INSTALLMENT") {
      if (!installmentId) return errorResponse("INSTALLMENT_ID_REQUIRED", 400);
      entityId = installmentId;
      const result = await reverseInstallmentCredit(prisma, {
        installmentId,
        createdBy: admin.user.id,
      });
      if (!result.applied) {
        if (result.reason === "NOT_FOUND") return errorResponse("NOT_FOUND", 404);
        if (result.reason === "DUPLICATE") return errorResponse("DUPLICATE", 409);
        return errorResponse("REVERSAL_FAILED", 500);
      }
      processed = 1;
      after = { processed };
    } else if (action === "REJECT") {
      if (!investmentId) return errorResponse("INVESTMENT_ID_REQUIRED", 400);
      entityId = investmentId;
      const target = await prisma.investment.findUnique({
        where: { id: investmentId },
        select: { memberId: true, investmentNumber: true },
      });
      if (!target) return errorResponse("NOT_FOUND", 404);
      const claimed = await prisma.investment.updateMany({
        where: { id: investmentId, status: "PENDING" },
        data: { status: "REJECTED", verifiedBy: admin.user.id, verifiedAt: new Date() },
      });
      if (claimed.count === 0) {
        const exists = await prisma.investment.findUnique({
          where: { id: investmentId },
          select: { id: true },
        });
        return exists ? errorResponse("INVALID_STATE", 409) : errorResponse("NOT_FOUND", 404);
      }
      processed = claimed.count;
      after = { processed };
      await notifyInvestmentRejected(target.memberId, target.investmentNumber);
    }

    await writeAuditLog({
      actorId: admin.user.id,
      actorRole: "ADMIN",
      action: `INVESTMENT_${action}`,
      entityType: action === "REVERSE_INSTALLMENT" ? "InvestmentInstallment" : "Investment",
      entityId: entityId ?? undefined,
      after,
    });

    return NextResponse.json({ ok: true, processed });
  } catch (error) {
    if (error instanceof ServiceError) {
      if (error.code === "INVALID_INPUT") return errorResponse("Invalid request", 400);
      if (error.code === "NOT_FOUND") return errorResponse("NOT_FOUND", 404);
      return errorResponse(error.code, 400);
    }
    console.error("Investment action failed", error);
    return errorResponse("UPDATE_FAILED", 500);
  }
}
