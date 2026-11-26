import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { writeAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { notifyWithdrawalResolved } from "@/lib/services/notification-events";
import { completePrincipalWithdrawal } from "@/lib/services/operations";

export const dynamic = "force-dynamic";

const schema = z.object({
  withdrawalId: z.string().min(1),
  action: z.enum(["APPROVE", "REJECT", "PAID"]),
  note: z.string().trim().max(300).optional().default(""),
});

const allowedCurrentStatuses = {
  APPROVE: ["PENDING"],
  REJECT: ["PENDING"],
  PAID: ["APPROVED"],
} as const;

export async function PATCH(request: Request) {
  const admin = await auth();
  if (admin?.user?.role !== "ADMIN" || !admin.user.id) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  const { withdrawalId, action, note } = parsed.data;
  const status = action === "PAID" ? "PAID" : action === "APPROVE" ? "APPROVED" : "REJECTED";

  try {
    const current = await prisma.withdrawal.findUnique({
      where: { id: withdrawalId },
      select: { status: true, type: true, memberId: true, amountPaisa: true },
    });
    if (!current) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

    if (!(allowedCurrentStatuses[action] as readonly string[]).includes(current.status)) {
      return NextResponse.json({ error: "INVALID_STATE" }, { status: 409 });
    }

    if (current.type === "PRINCIPAL") {
      // Principal release is owned by the automation pass: it happens only when
      // the two-month notice window has elapsed. Admins only record handover.
      if (action === "APPROVE") {
        return NextResponse.json({ error: "PRINCIPAL_RELEASE_AUTOMATED" }, { status: 409 });
      }
      if (action === "PAID") {
        const result = await completePrincipalWithdrawal(prisma, {
          withdrawalId,
          processedBy: admin.user.id,
        });
        if (!result.applied) {
          const code =
            result.reason === "DUPLICATE" || result.reason === "ALREADY_APPLIED"
              ? "DUPLICATE_REQUEST"
              : "INVALID_STATE";
          return NextResponse.json({ error: code }, { status: 409 });
        }
        await writeAuditLog({
          actorId: admin.user.id,
          actorRole: "ADMIN",
          action: "PRINCIPAL_WITHDRAWAL_PAID",
          entityType: "Withdrawal",
          entityId: withdrawalId,
          before: { status: current.status },
          after: { status: "PAID" },
        });
        return NextResponse.json({ ok: true });
      }
    }

    const claimed = await prisma.withdrawal.updateMany({
      where: { id: withdrawalId, status: { in: [...allowedCurrentStatuses[action]] } },
      data: {
        status,
        processedBy: admin.user.id,
        processedAt: new Date(),
        ...(note ? { note } : {}),
      },
    });
    if (claimed.count === 0) return NextResponse.json({ error: "INVALID_STATE" }, { status: 409 });

    await notifyWithdrawalResolved(current.memberId, current.amountPaisa, status);

    await writeAuditLog({
      actorId: admin.user.id,
      actorRole: "ADMIN",
      action: "WITHDRAWAL_REVIEWED",
      entityType: "Withdrawal",
      entityId: withdrawalId,
      before: { status: current.status },
      after: { status },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Withdrawal review failed", error);
    return NextResponse.json({ error: "UPDATE_FAILED" }, { status: 500 });
  }
}
