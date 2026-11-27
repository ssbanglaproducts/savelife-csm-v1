import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { verifyAdminPassword } from "@/lib/admin-password";
import { writeAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { loadTopUpAccounts, TOP_UP_ACCOUNTS_SETTING_KEY } from "@/lib/topup-accounts";

export const dynamic = "force-dynamic";

const schema = z.object({
  bkash: z.string().trim().max(200).optional().default(""),
  nagad: z.string().trim().max(200).optional().default(""),
  bank: z.string().trim().max(200).optional().default(""),
  adminPassword: z.string().min(1).max(200),
});

function errorResponse(code: string, status: number) {
  return NextResponse.json({ error: code }, { status });
}

export async function GET() {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") return errorResponse("FORBIDDEN", 403);
  return NextResponse.json({ accounts: await loadTopUpAccounts(prisma) });
}

export async function PATCH(request: Request) {
  const session = await auth();
  if (session?.user?.role !== "ADMIN" || !session.user.id) {
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

  if (!(await verifyAdminPassword(session.user.id, parsed.data.adminPassword))) {
    return errorResponse("INVALID_ADMIN_PASSWORD", 401);
  }

  const accounts = {
    BKASH: parsed.data.bkash,
    NAGAD: parsed.data.nagad,
    BANK: parsed.data.bank,
  };

  await prisma.systemSetting.upsert({
    where: { key: TOP_UP_ACCOUNTS_SETTING_KEY },
    create: { key: TOP_UP_ACCOUNTS_SETTING_KEY, value: accounts },
    update: { value: accounts },
  });

  await writeAuditLog({
    actorId: session.user.id,
    actorRole: "ADMIN",
    action: "TOP_UP_ACCOUNTS_UPDATED",
    entityType: "SystemSetting",
    entityId: TOP_UP_ACCOUNTS_SETTING_KEY,
    after: {
      BKASH: accounts.BKASH ? "set" : "empty",
      NAGAD: accounts.NAGAD ? "set" : "empty",
      BANK: accounts.BANK ? "set" : "empty",
    },
  });

  return NextResponse.json({ ok: true, accounts });
}
