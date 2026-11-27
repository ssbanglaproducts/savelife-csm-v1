import { NextResponse } from "next/server";
import { activeMemberErrorResponse, requireActiveMemberApi } from "@/lib/member-access";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function DELETE(_request: Request, context: RouteContext) {
  const access = await requireActiveMemberApi();
  if (!access.ok) return activeMemberErrorResponse(access);

  const { id } = await context.params;
  const deleted = await prisma.$transaction(async (tx) => {
    const existing = await tx.withdrawalMethod.findFirst({
      where: { id, memberId: access.memberId },
      select: { id: true, isDefault: true },
    });
    if (!existing) return null;

    await tx.withdrawalMethod.delete({ where: { id } });

    if (existing.isDefault) {
      const next = await tx.withdrawalMethod.findFirst({
        where: { memberId: access.memberId },
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
