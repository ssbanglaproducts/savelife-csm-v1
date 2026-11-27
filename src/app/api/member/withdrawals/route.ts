import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { writeAuditLog } from "@/lib/audit";
import { checkMemberCanTransact } from "@/lib/member-access";
import { spToPaisa } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import { notifyWithdrawalRequested } from "@/lib/services/notification-events";
import {
  createPrincipalWithdrawalNotice,
  createWithdrawalRequest,
} from "@/lib/services/operations";
import { ServiceError } from "@/lib/services/errors";
import { verifyMemberTPin } from "@/lib/tpin";
import {
  normalizeAccountDetails,
  withdrawalAccountFields,
  withdrawalMethodSchema,
} from "@/lib/withdrawal-methods";

export const dynamic = "force-dynamic";

const withdrawalSchema = z.object({
  type: z.enum(["AVAILABLE", "PRINCIPAL"]).optional().default("AVAILABLE"),
  investmentId: z.string().trim().min(1).optional(),
  amount: z.string().trim().regex(/^\d+(\.\d{1,2})?$/),
  method: withdrawalMethodSchema,
  ...withdrawalAccountFields,
  note: z.string().trim().max(300).optional().default(""),
  tPin: z.string(),
  idempotencyKey: z.string().trim().min(8).max(200).optional(),
});

function errorResponse(code: string, status: number) {
  return NextResponse.json({ error: code }, { status });
}

function resultError(reason: string | undefined) {
  if (reason === "BELOW_MINIMUM") return errorResponse("MINIMUM_WITHDRAWAL", 400);
  if (reason === "INSUFFICIENT_BALANCE") return errorResponse("INSUFFICIENT_BALANCE", 400);
  if (reason === "DUPLICATE") return errorResponse("DUPLICATE_REQUEST", 409);
  if (reason === "NOT_MATURED") return errorResponse("PRINCIPAL_NOT_MATURED", 400);
  if (reason === "INELIGIBLE") return errorResponse("PRINCIPAL_NOT_ELIGIBLE", 400);
  if (reason === "NOT_FOUND") return errorResponse("WALLET_NOT_FOUND", 404);
  return errorResponse("WITHDRAWAL_FAILED", 500);
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return errorResponse("LOGIN_REQUIRED", 401);
  if (session.user.role !== "MEMBER") return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

  const access = await checkMemberCanTransact(session.user.id);
  if (!access.ok) return errorResponse(access.code, access.status);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse("Invalid request", 400);
  }

  const parsed = withdrawalSchema.safeParse(body);
  if (!parsed.success) return errorResponse("Please check the form details", 400);

  // The withdrawal PIN is independent of the login password and is required for
  // every payout request, including principal notices.
  const tPin = await verifyMemberTPin(session.user.id, parsed.data.tPin);
  if (!tPin.ok) return errorResponse(tPin.code, 400);

  try {
    const amount = spToPaisa(parsed.data.amount);
    const idempotencyKey =
      parsed.data.idempotencyKey ??
      `${session.user.id}:${Date.now()}:${Math.random().toString(36).slice(2)}`;
    const accountDetails = normalizeAccountDetails(parsed.data.method, {
      accountName: parsed.data.accountName,
      accountNumber: parsed.data.accountNumber,
      bankName: parsed.data.bankName,
      branch: parsed.data.branch,
    });
    if (!accountDetails) {
      return errorResponse("BANK_FIELDS_REQUIRED", 400);
    }

    if (parsed.data.type === "PRINCIPAL") {
      if (!parsed.data.investmentId) return errorResponse("INVESTMENT_ID_REQUIRED", 400);
      const notice = await createPrincipalWithdrawalNotice(prisma, {
        memberId: session.user.id,
        investmentId: parsed.data.investmentId,
        method: parsed.data.method,
        accountDetails,
        note: parsed.data.note,
        idempotencyKey,
      });
      if (!notice.applied) return resultError(notice.reason);

      await notifyWithdrawalRequested(session.user.id, notice.amountPaisa);

      await writeAuditLog({
        actorId: session.user.id,
        actorRole: "MEMBER",
        action: "PRINCIPAL_NOTICE_SUBMITTED",
        entityType: "Withdrawal",
        entityId: notice.withdrawalId,
        after: {
          investmentId: parsed.data.investmentId,
          amountPaisa: notice.amountPaisa.toString(),
          payableAt: notice.payableAt?.toISOString() ?? null,
        },
      });

      return NextResponse.json(
        {
          ok: true,
          withdrawal: {
            id: notice.withdrawalId,
            requestNumber: notice.requestNumber,
            payableAt: notice.payableAt?.toISOString() ?? null,
            amountPaisa: notice.amountPaisa.toString(),
          },
        },
        { status: 201 },
      );
    }

    const result = await createWithdrawalRequest(prisma, {
      memberId: session.user.id,
      amountPaisa: amount,
      method: parsed.data.method,
      accountDetails,
      note: parsed.data.note,
      idempotencyKey,
    });

    if (!result.applied) return resultError(result.reason);

    await notifyWithdrawalRequested(session.user.id, amount);

    const wallet = await prisma.wallet.findUnique({
      where: { memberId: session.user.id },
      select: { availablePaisa: true },
    });

    await writeAuditLog({
      actorId: session.user.id,
      actorRole: "MEMBER",
      action: "WITHDRAWAL_REQUESTED",
      entityType: "Withdrawal",
      entityId: result.withdrawalId,
      after: {
        amountPaisa: amount.toString(),
        feePaisa: result.feePaisa.toString(),
        netPaisa: result.netPaisa.toString(),
      },
    });

    return NextResponse.json(
      {
        ok: true,
        withdrawal: {
          id: result.withdrawalId,
          requestNumber: result.requestNumber,
          feePaisa: result.feePaisa.toString(),
          netPaisa: result.netPaisa.toString(),
        },
        availablePaisa: wallet?.availablePaisa.toString() ?? "0",
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof ServiceError) return errorResponse(error.code, 400);
    return errorResponse("WITHDRAWAL_FAILED", 500);
  }
}
