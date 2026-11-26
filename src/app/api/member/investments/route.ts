import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { checkMemberCanTransact } from "@/lib/member-access";
import { spToPaisa } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import { getActiveSettings } from "@/lib/settings";
import { uploadedImageUrlSource } from "@/lib/uploads";
import { writeAuditLog } from "@/lib/audit";

export const dynamic = "force-dynamic";

const investmentSchema = z.object({
  type: z.enum(["INSTALLMENT", "PROFIT_ONLY"]),
  amount: z.string().trim().regex(/^\d+(\.\d{1,2})?$/),
  paymentMethod: z.enum(["BKASH", "NAGAD", "BANK", "OTHER"]),
  transactionRef: z.string().trim().min(3).max(120),
  paymentImageUrl: z
    .string()
    .trim()
    .regex(new RegExp(`^(${uploadedImageUrlSource})?$`))
    .optional()
    .default(""),
});

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "LOGIN_REQUIRED" }, { status: 401 });
  }

  const access = await checkMemberCanTransact(session.user.id);
  if (!access.ok) {
    return NextResponse.json({ error: access.code }, { status: access.status });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const parsed = investmentSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Please check the form details" }, { status: 400 });

  const amount = spToPaisa(parsed.data.amount);
  if (amount < 100000n) return NextResponse.json({ error: "MINIMUM_INVESTMENT" }, { status: 400 });

  const settings = await getActiveSettings();
  const investmentNumber = `SL-INV-${Date.now().toString().slice(-8)}-${randomUUID().slice(0, 4).toUpperCase()}`;

  try {
    const investment = await prisma.investment.create({
      data: {
        investmentNumber,
        memberId: session.user.id,
        type: parsed.data.type,
        amountPaisa: amount,
        remainingPrincipalPaisa: amount,
        status: "PENDING",
        settingsId: settings.id,
        durationMonths: parsed.data.type === "INSTALLMENT" ? settings.installmentDurationMonths : null,
        monthlyInstallmentPaisa: null,
        lockInMonths: parsed.data.type === "PROFIT_ONLY" ? settings.profitOnlyLockInMonths : null,
        paymentProofs: {
          create: {
            memberId: session.user.id,
            method: parsed.data.paymentMethod,
            transactionRef: parsed.data.transactionRef,
            amountPaisa: amount,
            imageUrl: parsed.data.paymentImageUrl || null,
          },
        },
      },
      select: { id: true, investmentNumber: true, status: true },
    });

    await writeAuditLog({
      actorId: session.user.id,
      actorRole: "MEMBER",
      action: "INVESTMENT_CREATED",
      entityType: "Investment",
      entityId: investment.id,
      after: { type: parsed.data.type, amountPaisa: Number(amount) },
    });

    return NextResponse.json({ investment }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "INVESTMENT_FAILED" }, { status: 500 });
  }
}
