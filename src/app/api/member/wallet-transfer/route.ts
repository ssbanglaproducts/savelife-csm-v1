import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { writeAuditLog } from "@/lib/audit";
import { checkMemberCanTransact } from "@/lib/member-access";
import { spToPaisa } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import { ServiceError } from "@/lib/services/errors";
import { transferBalanceToAvailable } from "@/lib/services/operations";

export const dynamic = "force-dynamic";

const transferSchema = z.object({
  from: z.enum(["PROFIT", "AFFILIATE", "RANK_REWARD"]),
  amount: z.string().trim().regex(/^\d+(\.\d{1,2})?$/),
  idempotencyKey: z.string().trim().min(8).max(200).optional(),
});

function errorResponse(code: string, status: number) {
  return NextResponse.json({ error: code }, { status });
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return errorResponse("LOGIN_REQUIRED", 401);

  const access = await checkMemberCanTransact(session.user.id);
  if (!access.ok) return errorResponse(access.code, access.status);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse("Invalid request", 400);
  }

  const parsed = transferSchema.safeParse(body);
  if (!parsed.success) return errorResponse("Invalid amount", 400);

  try {
    const amount = spToPaisa(parsed.data.amount);
    const idempotencyKey =
      parsed.data.idempotencyKey ??
      `${session.user.id}:transfer:${Date.now()}:${Math.random().toString(36).slice(2)}`;

    const result = await transferBalanceToAvailable(prisma, {
      memberId: session.user.id,
      source: parsed.data.from,
      amountPaisa: amount,
      idempotencyKey,
      createdBy: session.user.id,
    });

    if (!result.applied) {
      if (result.reason === "INSUFFICIENT_BALANCE") {
        return errorResponse("INSUFFICIENT_BALANCE", 400);
      }
      if (result.reason === "DUPLICATE") return errorResponse("DUPLICATE_REQUEST", 409);
      if (result.reason === "NOT_FOUND") return errorResponse("WALLET_NOT_FOUND", 404);
      return errorResponse("TRANSFER_FAILED", 500);
    }

    const wallet = await prisma.wallet.findUnique({
      where: { memberId: session.user.id },
      select: {
        availablePaisa: true,
        profitPaisa: true,
        affiliatePaisa: true,
        rankRewardPaisa: true,
      },
    });

    await writeAuditLog({
      actorId: session.user.id,
      actorRole: "MEMBER",
      action: "WALLET_TRANSFER",
      entityType: "Wallet",
      entityId: session.user.id,
      after: { from: parsed.data.from, amountPaisa: amount.toString() },
    });

    return NextResponse.json({
      ok: true,
      wallet: {
        availablePaisa: wallet?.availablePaisa.toString() ?? "0",
        profitPaisa: wallet?.profitPaisa.toString() ?? "0",
        affiliatePaisa: wallet?.affiliatePaisa.toString() ?? "0",
        rankRewardPaisa: wallet?.rankRewardPaisa.toString() ?? "0",
      },
    });
  } catch (error) {
    if (error instanceof ServiceError) return errorResponse(error.code, 400);
    return errorResponse("TRANSFER_FAILED", 500);
  }
}
