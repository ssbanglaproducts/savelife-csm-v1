import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { spToPaisa } from "@/lib/money";
import { notifyTopUpRequested } from "@/lib/services/notification-events";
import { uploadedImageUrlSource } from "@/lib/uploads";

export const dynamic = "force-dynamic";

const schema = z.object({
  amount: z.string().trim().regex(/^\d+(\.\d{1,2})?$/),
  method: z.enum(["BKASH", "NAGAD", "BANK"]),
  transactionRef: z.string().trim().min(3).max(120),
  proofImageUrl: z
    .string()
    .trim()
    .regex(new RegExp(`^(${uploadedImageUrlSource})?$`))
    .optional()
    .default(""),
  note: z.string().trim().max(300).optional().default(""),
});

function errorResponse(code: string, status: number) {
  return NextResponse.json({ error: code }, { status });
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return errorResponse("LOGIN_REQUIRED", 401);
  if (session.user.role !== "MEMBER") return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

  const requests = await prisma.walletTopUp.findMany({
    where: { memberId: session.user.id },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      requestNumber: true,
      amountPaisa: true,
      method: true,
      transactionRef: true,
      status: true,
      note: true,
      createdAt: true,
      reviewedAt: true,
    },
  });

  return NextResponse.json({
    requests: requests.map((request) => ({
      ...request,
      amountPaisa: request.amountPaisa.toString(),
      createdAt: request.createdAt.toISOString(),
      reviewedAt: request.reviewedAt?.toISOString() ?? null,
    })),
  });
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return errorResponse("LOGIN_REQUIRED", 401);
  if (session.user.role !== "MEMBER") return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse("INVALID_REQUEST", 400);
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return errorResponse("INVALID_REQUEST", 400);

  const amount = spToPaisa(parsed.data.amount);
  if (amount <= 0n) return errorResponse("INVALID_AMOUNT", 400);

  const requestNumber = `SL-TU-${Date.now().toString().slice(-8)}-${randomUUID()
    .slice(0, 4)
    .toUpperCase()}`;

  const created = await prisma.walletTopUp.create({
    data: {
      requestNumber,
      memberId: session.user.id,
      amountPaisa: amount,
      method: parsed.data.method,
      transactionRef: parsed.data.transactionRef,
      proofImageUrl: parsed.data.proofImageUrl || null,
      note: parsed.data.note || null,
    },
    select: { id: true, requestNumber: true, status: true },
  });

  await notifyTopUpRequested(session.user.id, created.requestNumber, amount);

  return NextResponse.json({ request: created }, { status: 201 });
}
