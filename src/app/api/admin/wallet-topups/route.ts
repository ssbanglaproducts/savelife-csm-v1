import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminApiSession } from "@/lib/admin-access";
import { writeAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { notifyTopUpRejected } from "@/lib/services/notification-events";
import { approveWalletTopUp, claimPendingWalletTopUp } from "@/lib/services/wallet";

export const dynamic = "force-dynamic";

const schema = z.object({
  requestId: z.string().min(1),
  action: z.enum(["APPROVE", "REJECT"]),
  note: z.string().trim().max(300).optional().default(""),
});

function errorResponse(code: string, status: number) {
  return NextResponse.json({ error: code }, { status });
}

export async function GET(request: Request) {
  const session = await requireAdminApiSession("topUps.view");
  if (!session) {
    return errorResponse("FORBIDDEN", 403);
  }

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const requests = await prisma.walletTopUp.findMany({
    where: {
      member: { role: "MEMBER" },
      ...(status === "PENDING" ? { status: "PENDING" } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      member: {
        select: { memberId: true, fullName: true },
      },
    },
  });

  return NextResponse.json({
    requests: requests.map((item) => ({
      ...item,
      amountPaisa: item.amountPaisa.toString(),
      createdAt: item.createdAt.toISOString(),
      reviewedAt: item.reviewedAt?.toISOString() ?? null,
    })),
  });
}

export async function PATCH(request: Request) {
  const session = await requireAdminApiSession("topUps.manage");
  if (!session) {
    return errorResponse("FORBIDDEN", 403);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse("INVALID_REQUEST", 400);
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return errorResponse("INVALID_REQUEST", 400);

  if (parsed.data.action === "APPROVE") {
    const result = await approveWalletTopUp(prisma, {
      topUpId: parsed.data.requestId,
      adminId: session.user.id,
    });
    if (!result.applied) {
      if (result.reason === "NOT_FOUND") return errorResponse("NOT_FOUND", 404);
      return errorResponse("ALREADY_REVIEWED", 409);
    }

    await writeAuditLog({
      actorId: session.user.id,
      actorRole: session.user.role,
      action: "WALLET_TOP_UP_APPROVED",
      entityType: "WalletTopUp",
      entityId: parsed.data.requestId,
      after: { amountPaisa: result.amountPaisa.toString() },
    });

    return NextResponse.json({ ok: true, status: "APPROVED" });
  }

  const claim = await prisma.$transaction(async (tx) => {
    const existing = await tx.walletTopUp.findUnique({
      where: { id: parsed.data.requestId },
      select: { status: true, memberId: true, requestNumber: true },
    });
    if (!existing) return { state: "NOT_FOUND" as const };

    const claimed = await claimPendingWalletTopUp(tx, parsed.data.requestId, {
      status: "REJECTED",
      reviewedBy: session.user.id,
      reviewedAt: new Date(),
      note: parsed.data.note || undefined,
    });
    if (!claimed) return { state: "ALREADY_REVIEWED" as const };
    return { state: "CLAIMED" as const, existing };
  });
  if (claim.state === "NOT_FOUND") return errorResponse("NOT_FOUND", 404);
  if (claim.state === "ALREADY_REVIEWED") return errorResponse("ALREADY_REVIEWED", 409);
  const { existing } = claim;

  await notifyTopUpRejected(existing.memberId, existing.requestNumber, parsed.data.note);

  await writeAuditLog({
    actorId: session.user.id,
    actorRole: session.user.role,
    action: "WALLET_TOP_UP_REJECTED",
    entityType: "WalletTopUp",
    entityId: parsed.data.requestId,
    after: { note: parsed.data.note },
  });

  return NextResponse.json({ ok: true, status: "REJECTED" });
}
