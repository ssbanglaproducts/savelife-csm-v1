import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { writeAuditLog } from "@/lib/audit";
import { checkMemberCanTransact } from "@/lib/member-access";
import { spToPaisa } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import { verifyMemberTPin } from "@/lib/tpin";
import { transferMoneyBetweenMembers } from "@/lib/services/wallet";
import { ServiceError } from "@/lib/services/errors";

export const dynamic = "force-dynamic";

const schema = z.object({
  recipientId: z.string().trim().min(1),
  amount: z.string().trim().regex(/^\d+(\.\d{1,2})?$/),
  note: z.string().trim().max(300).optional().default(""),
  tPin: z.string(),
  idempotencyKey: z.string().trim().min(8).max(200).optional(),
});

function errorResponse(code: string, status: number) {
  return NextResponse.json({ error: code }, { status });
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
    return errorResponse("INVALID_REQUEST", 400);
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return errorResponse("INVALID_REQUEST", 400);

  if (parsed.data.recipientId === session.user.id) {
    return errorResponse("CANNOT_SEND_TO_SELF", 400);
  }

  const tPin = await verifyMemberTPin(session.user.id, parsed.data.tPin);
  if (!tPin.ok) return errorResponse(tPin.code, 400);

  try {
    const amount = spToPaisa(parsed.data.amount);
    const idempotencyKey =
      parsed.data.idempotencyKey ??
      `${session.user.id}:send:${Date.now()}:${randomUUID()}`;
    const transferNumber = `SL-TR-${Date.now().toString().slice(-8)}-${randomUUID()
      .slice(0, 4)
      .toUpperCase()}`;

    const result = await transferMoneyBetweenMembers(prisma, {
      senderId: session.user.id,
      recipientId: parsed.data.recipientId,
      amountPaisa: amount,
      note: parsed.data.note,
      transferNumber,
      idempotencyKey,
    });

    if (!result.applied) {
      if (result.reason === "DUPLICATE") return errorResponse("DUPLICATE_REQUEST", 409);
      if (result.reason === "INSUFFICIENT_BALANCE") {
        return errorResponse("INSUFFICIENT_BALANCE", 400);
      }
      if (result.reason === "INELIGIBLE") return errorResponse("RECIPIENT_UNAVAILABLE", 403);
      if (result.reason === "NOT_FOUND") return errorResponse("RECIPIENT_NOT_FOUND", 404);
      return errorResponse("TRANSFER_FAILED", 500);
    }

    await writeAuditLog({
      actorId: session.user.id,
      actorRole: "MEMBER",
      action: "MEMBER_MONEY_TRANSFER",
      entityType: "MemberTransfer",
      entityId: result.transferId,
      after: {
        transferNumber: result.transferNumber,
        recipientId: parsed.data.recipientId,
        amountPaisa: amount.toString(),
      },
    });

    return NextResponse.json(
      {
        ok: true,
        transfer: {
          transferNumber: result.transferNumber,
          amountPaisa: amount.toString(),
          recipientId: parsed.data.recipientId,
        },
        availablePaisa: result.senderBalancePaisa.toString(),
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof ServiceError) return errorResponse(error.code, 400);
    return errorResponse("TRANSFER_FAILED", 500);
  }
}
