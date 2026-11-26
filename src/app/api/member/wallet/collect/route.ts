import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { checkMemberCanTransact } from "@/lib/member-access";
import { prisma } from "@/lib/prisma";
import { collectRewardsToAvailable } from "@/lib/services/wallet";

export const dynamic = "force-dynamic";

const schema = z.object({
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
    body = {};
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return errorResponse("INVALID_REQUEST", 400);

  const idempotencyKey =
    parsed.data.idempotencyKey ??
    `${session.user.id}:collect:${Date.now()}:${Math.random().toString(36).slice(2)}`;

  try {
    const result = await collectRewardsToAvailable(prisma, {
      memberId: session.user.id,
      idempotencyKey,
      createdBy: session.user.id,
    });
    if (!result.applied && result.reason === "DUPLICATE") {
      return errorResponse("DUPLICATE_REQUEST", 409);
    }
    if (!result.applied && result.reason === "NOT_FOUND") {
      return errorResponse("WALLET_NOT_FOUND", 404);
    }

    const wallet = await prisma.wallet.findUnique({
      where: { memberId: session.user.id },
      select: {
        availablePaisa: true,
        profitPaisa: true,
        affiliatePaisa: true,
        rankRewardPaisa: true,
        salaryPaisa: true,
        roiPaisa: true,
      },
    });

    return NextResponse.json({
      ok: true,
      collectedPaisa: result.collectedPaisa.toString(),
      wallet: {
        availablePaisa: wallet?.availablePaisa.toString() ?? "0",
        profitPaisa: wallet?.profitPaisa.toString() ?? "0",
        affiliatePaisa: wallet?.affiliatePaisa.toString() ?? "0",
        rankRewardPaisa: wallet?.rankRewardPaisa.toString() ?? "0",
        salaryPaisa: wallet?.salaryPaisa.toString() ?? "0",
        roiPaisa: wallet?.roiPaisa.toString() ?? "0",
      },
    });
  } catch {
    return errorResponse("COLLECT_FAILED", 500);
  }
}
