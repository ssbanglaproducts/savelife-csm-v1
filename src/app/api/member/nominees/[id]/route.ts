import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { writeAuditLog } from "@/lib/audit";
import { nomineeInputSchema } from "@/lib/nominee-input";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

async function requireMember() {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: NextResponse.json({ error: "LOGIN_REQUIRED" }, { status: 401 }) } as const;
  }
  if (session.user.role !== "MEMBER") {
    return { error: NextResponse.json({ error: "FORBIDDEN" }, { status: 403 }) } as const;
  }
  return { memberId: session.user.id } as const;
}

export async function PATCH(request: Request, context: RouteContext) {
  const access = await requireMember();
  if ("error" in access) return access.error;
  const { id } = await context.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const parsed = nomineeInputSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  const existing = await prisma.nominee.findFirst({
    where: { id, memberId: access.memberId },
    select: { fullName: true, relation: true, phone: true },
  });
  if (!existing) return NextResponse.json({ error: "NOMINEE_NOT_FOUND" }, { status: 404 });

  const nominee = await prisma.nominee.update({
    where: { id },
    data: parsed.data,
    select: { id: true, fullName: true, relation: true, phone: true },
  });

  await writeAuditLog({
    actorId: access.memberId,
    actorRole: "MEMBER",
    action: "NOMINEE_UPDATED",
    entityType: "Nominee",
    entityId: id,
    before: existing,
    after: { fullName: nominee.fullName, relation: nominee.relation, phone: nominee.phone },
  });
  revalidatePath("/[locale]/member/profile", "page");

  return NextResponse.json({ nominee });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const access = await requireMember();
  if ("error" in access) return access.error;
  const { id } = await context.params;

  const existing = await prisma.nominee.findFirst({
    where: { id, memberId: access.memberId },
    select: { fullName: true, relation: true, phone: true },
  });
  if (!existing) return NextResponse.json({ error: "NOMINEE_NOT_FOUND" }, { status: 404 });

  await prisma.nominee.delete({ where: { id } });
  await writeAuditLog({
    actorId: access.memberId,
    actorRole: "MEMBER",
    action: "NOMINEE_DELETED",
    entityType: "Nominee",
    entityId: id,
    before: existing,
  });
  revalidatePath("/[locale]/member/profile", "page");

  return NextResponse.json({ ok: true });
}
