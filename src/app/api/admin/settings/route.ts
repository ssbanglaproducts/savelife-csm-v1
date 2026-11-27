import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { verifyAdminPassword } from "@/lib/admin-password";
import { writeAuditLog } from "@/lib/audit";
import { spToPaisa } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import { isUniqueViolation } from "@/lib/services/ledger";

export const dynamic = "force-dynamic";

const schema = z.object({
  // Kept for backwards compatibility with older admin forms. The server
  // assigns the next sequential version so clients cannot collide or rewind.
  version: z.number().int().min(1).optional(),
  installmentDurationMonths: z.number().int().min(1).max(120),
  profitOnlyLockInMonths: z.number().int().min(1).max(120),
  withdrawalFeeBps: z.number().int().min(0).max(5000),
  minWithdrawal: z.string().trim().regex(/^\d+(\.\d{1,2})?$/),
  adminPassword: z.string().min(1).max(200),
});

export async function POST(request: Request) {
  const session = await auth();
  if (session?.user?.role !== "ADMIN" || !session.user.id) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Please check the values" }, { status: 400 });

  const data = parsed.data;

  if (!(await verifyAdminPassword(session.user.id, data.adminPassword))) {
    return NextResponse.json({ error: "INVALID_ADMIN_PASSWORD" }, { status: 401 });
  }

  try {
    const created = await prisma.$transaction(async (tx) => {
      const latest = await tx.investmentSettings.findFirst({
        orderBy: { version: "desc" },
        select: { version: true },
      });
      const nextVersion = Math.max(latest?.version ?? 0, data.version ?? 0) + 1;

      await tx.investmentSettings.updateMany({
        where: { isActive: true },
        data: { isActive: false },
      });

      return tx.investmentSettings.create({
        data: {
          version: nextVersion,
          installmentDurationMonths: data.installmentDurationMonths,
          profitOnlyLockInMonths: data.profitOnlyLockInMonths,
          withdrawalFeeBps: data.withdrawalFeeBps,
          minWithdrawalPaisa: spToPaisa(data.minWithdrawal),
          isActive: true,
          effectiveFrom: new Date(),
        },
        select: { id: true, version: true },
      });
    });

    await writeAuditLog({
      actorId: session.user.id,
      actorRole: "ADMIN",
      action: "SETTINGS_VERSION_CREATED",
      entityType: "InvestmentSettings",
      entityId: created.id,
      after: { version: created.version },
    });

    return NextResponse.json({ settings: created }, { status: 201 });
  } catch (error) {
    if (isUniqueViolation(error)) {
      return NextResponse.json({ error: "VERSION_EXISTS" }, { status: 409 });
    }
    console.error("Settings version creation failed", error);
    return NextResponse.json({ error: "SETTINGS_FAILED" }, { status: 500 });
  }
}
