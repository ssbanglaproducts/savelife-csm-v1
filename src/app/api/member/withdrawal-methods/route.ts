import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getMemberStatus } from "@/lib/member-access";
import { prisma } from "@/lib/prisma";
import {
  normalizeAccountDetails,
  parseSavedWithdrawalMethod,
  savedWithdrawalMethodSchema,
} from "@/lib/withdrawal-methods";

export const dynamic = "force-dynamic";

async function requireActiveMember() {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: NextResponse.json({ error: "LOGIN_REQUIRED" }, { status: 401 }) } as const;
  }
  if (session.user.role !== "MEMBER") {
    return { error: NextResponse.json({ error: "FORBIDDEN" }, { status: 403 }) } as const;
  }
  if ((await getMemberStatus(session.user.id)) !== "ACTIVE") {
    return { error: NextResponse.json({ error: "MEMBER_NOT_ACTIVE" }, { status: 403 }) } as const;
  }
  return { memberId: session.user.id } as const;
}

export async function GET() {
  const access = await requireActiveMember();
  if ("error" in access) return access.error;

  const methods = await prisma.withdrawalMethod.findMany({
    where: { memberId: access.memberId },
    orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
    select: {
      id: true,
      label: true,
      method: true,
      accountDetails: true,
      isDefault: true,
    },
  });

  return NextResponse.json({
    methods: methods.map(parseSavedWithdrawalMethod),
  });
}

export async function POST(request: Request) {
  const access = await requireActiveMember();
  if ("error" in access) return access.error;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "INVALID_REQUEST" }, { status: 400 });
  }

  const parsed = savedWithdrawalMethodSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "INVALID_REQUEST" }, { status: 400 });
  }

  const accountDetails = normalizeAccountDetails(parsed.data.method, parsed.data.accountDetails);
  if (!accountDetails) {
    return NextResponse.json({ error: "BANK_FIELDS_REQUIRED" }, { status: 400 });
  }

  const existingCount = await prisma.withdrawalMethod.count({
    where: { memberId: access.memberId },
  });
  const requestedDefault =
    typeof body === "object" && body !== null && "isDefault" in body
      ? Boolean((body as { isDefault?: unknown }).isDefault)
      : false;
  const makeDefault = existingCount === 0 || requestedDefault;

  try {
    const method = await prisma.$transaction(async (tx) => {
      if (makeDefault) {
        await tx.withdrawalMethod.updateMany({
          where: { memberId: access.memberId },
          data: { isDefault: false },
        });
      }
      return tx.withdrawalMethod.create({
        data: {
          memberId: access.memberId,
          label: parsed.data.label,
          method: parsed.data.method,
          accountDetails,
          isDefault: makeDefault,
        },
        select: {
          id: true,
          label: true,
          method: true,
          accountDetails: true,
          isDefault: true,
        },
      });
    });

    return NextResponse.json(
      { method: parseSavedWithdrawalMethod(method) },
      { status: 201 },
    );
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      String(error.code) === "P2002"
    ) {
      return NextResponse.json({ error: "DUPLICATE_LABEL" }, { status: 409 });
    }
    return NextResponse.json({ error: "SAVE_FAILED" }, { status: 500 });
  }
}
