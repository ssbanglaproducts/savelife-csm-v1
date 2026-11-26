import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getMemberStatus } from "@/lib/member-access";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function DELETE(_request: Request, context: RouteContext) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "LOGIN_REQUIRED" }, { status: 401 });
  }
  if (session.user.role !== "MEMBER") {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }
  if ((await getMemberStatus(session.user.id)) !== "ACTIVE") {
    return NextResponse.json({ error: "MEMBER_NOT_ACTIVE" }, { status: 403 });
  }

  const { id } = await context.params;
  const deleted = await prisma.$transaction(async (tx) => {
    const existing = await tx.withdrawalMethod.findFirst({
      where: { id, memberId: session.user.id },
      select: { id: true, isDefault: true },
    });
    if (!existing) return null;

    await tx.withdrawalMethod.delete({ where: { id } });

    if (existing.isDefault) {
      const next = await tx.withdrawalMethod.findFirst({
        where: { memberId: session.user.id },
        orderBy: { createdAt: "desc" },
        select: { id: true },
      });
      if (next) {
        await tx.withdrawalMethod.update({
          where: { id: next.id },
          data: { isDefault: true },
        });
      }
    }

    return existing;
  });

  if (!deleted) {
    return NextResponse.json({ error: "METHOD_NOT_FOUND" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
