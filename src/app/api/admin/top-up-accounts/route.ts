import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminApiSession } from "@/lib/admin-access";
import { verifyAdminPassword } from "@/lib/admin-password";
import { writeAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import {
  legacyAccountsFromEntries,
  loadTopUpAccounts,
  parseTopUpAccountSettings,
  TOP_UP_ACCOUNT_KINDS,
  TOP_UP_ACCOUNTS_SETTING_KEY,
  TOP_UP_METHODS,
  type TopUpAccountEntry,
} from "@/lib/topup-accounts";

export const dynamic = "force-dynamic";

const entrySchema = z
  .object({
    id: z.string().trim().regex(/^[A-Za-z0-9_-]{1,80}$/),
    method: z.enum(TOP_UP_METHODS),
    kind: z.enum(TOP_UP_ACCOUNT_KINDS).nullable().optional(),
    label: z.string().trim().max(80).optional().default(""),
    accountName: z.string().trim().max(120).optional().default(""),
    accountNumber: z.string().trim().max(200).optional().default(""),
    bankName: z.string().trim().max(120).optional().default(""),
    branch: z.string().trim().max(120).optional().default(""),
    routing: z.string().trim().max(120).optional().default(""),
    ifsc: z.string().trim().max(120).optional().default(""),
    swift: z.string().trim().max(120).optional().default(""),
  })
  .superRefine((entry, context) => {
    if (!entry.accountNumber) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["accountNumber"],
        message: "Account number is required",
      });
    }
    if (entry.method === "BANK") {
      if (!entry.bankName) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["bankName"],
          message: "Bank name is required",
        });
      }
      if (!entry.branch) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["branch"],
          message: "Branch is required",
        });
      }
    } else if (!entry.kind) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["kind"],
        message: "Account kind is required",
      });
    }
  });

const schema = z.object({
  bkash: z.string().trim().max(200).optional().default(""),
  nagad: z.string().trim().max(200).optional().default(""),
  bank: z.string().trim().max(200).optional().default(""),
  entries: z.array(entrySchema).max(30).optional(),
  adminPassword: z.string().min(1).max(200),
});

function errorResponse(code: string, status: number) {
  return NextResponse.json({ error: code }, { status });
}

export async function GET() {
  const session = await requireAdminApiSession("topUps.view");
  if (!session) return errorResponse("FORBIDDEN", 403);
  return NextResponse.json({
    accounts: await loadTopUpAccounts(prisma),
    settings: parseTopUpAccountSettings(
      await prisma.systemSetting
        .findUnique({
          where: { key: TOP_UP_ACCOUNTS_SETTING_KEY },
          select: { value: true },
        })
        .then((row) => row?.value ?? null),
    ),
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

  if (!(await verifyAdminPassword(session.user.id, parsed.data.adminPassword))) {
    return errorResponse("INVALID_ADMIN_PASSWORD", 401);
  }

  const previousRow = await prisma.systemSetting.findUnique({
    where: { key: TOP_UP_ACCOUNTS_SETTING_KEY },
    select: { value: true },
  });
  const previousRecord =
    typeof previousRow?.value === "object" && previousRow.value !== null
      ? (previousRow.value as Record<string, unknown>)
      : {};

  const legacy = {
    BKASH: parsed.data.bkash,
    NAGAD: parsed.data.nagad,
    BANK: parsed.data.bank,
  };
  const entries: TopUpAccountEntry[] | undefined = parsed.data.entries?.map((entry) => ({
    id: entry.id,
    method: entry.method,
    kind: entry.method === "BANK" ? null : (entry.kind ?? null),
    label: entry.label,
    accountName: entry.accountName,
    accountNumber: entry.accountNumber,
    bankName: entry.bankName,
    branch: entry.branch,
    routing: entry.routing,
    ifsc: entry.ifsc,
    swift: entry.swift,
  }));

  const value = entries
    ? { ...previousRecord, ...legacyAccountsFromEntries(entries), entries }
    : { ...previousRecord, ...legacy };

  await prisma.systemSetting.upsert({
    where: { key: TOP_UP_ACCOUNTS_SETTING_KEY },
    create: { key: TOP_UP_ACCOUNTS_SETTING_KEY, value },
    update: { value },
  });

  await writeAuditLog({
    actorId: session.user.id,
    actorRole: session.user.role,
    action: "TOP_UP_ACCOUNTS_UPDATED",
    entityType: "SystemSetting",
    entityId: TOP_UP_ACCOUNTS_SETTING_KEY,
    after: {
      accountCount: entries?.length ?? 0,
      BKASH: legacy.BKASH ? "set" : "empty",
      NAGAD: legacy.NAGAD ? "set" : "empty",
      BANK: legacy.BANK ? "set" : "empty",
    },
  });

  return NextResponse.json({ ok: true, accounts: legacy, entries: entries ?? [] });
}
