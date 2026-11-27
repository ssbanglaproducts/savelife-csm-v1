import { NextResponse } from "next/server";
import { z } from "zod";
import { addressInputSchema } from "@/lib/address-input";
import { activeMemberErrorResponse, requireActiveMemberApi } from "@/lib/member-access";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

const updateSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("SET_MAIN") }),
  z.object({ action: z.literal("DELETE") }),
  addressInputSchema.extend({ action: z.literal("UPDATE") }),
]);

export async function PATCH(request: Request, context: RouteContext) {
  const access = await requireActiveMemberApi();
  if (!access.ok) return activeMemberErrorResponse(access);
  const { id } = await context.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  const existing = await prisma.address.findFirst({
    where: { id, memberId: access.memberId },
    select: { id: true },
  });
  if (!existing) return NextResponse.json({ error: "ADDRESS_NOT_FOUND" }, { status: 404 });

  if (parsed.data.action === "SET_MAIN") {
    await prisma.$transaction(async (tx) => {
      await tx.address.updateMany({
        where: { memberId: access.memberId },
        data: { isDefault: false },
      });
      await tx.address.update({ where: { id }, data: { isDefault: true } });
    });
    return NextResponse.json({ ok: true });
  }

  if (parsed.data.action === "UPDATE") {
    const data = parsed.data;
    await prisma.address.update({
      where: { id },
      data: {
        label: data.label,
        street: data.fullAddress,
        city: data.thana,
        thana: data.thana,
        district: data.district,
        postalCode: data.postalCode,
      },
    });
    return NextResponse.json({ ok: true });
  }

  const deleted = await prisma.address.deleteMany({
    where: { id, memberId: access.memberId },
  });
  if (deleted.count === 0) return NextResponse.json({ error: "ADDRESS_NOT_FOUND" }, { status: 404 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const access = await requireActiveMemberApi();
  if (!access.ok) return activeMemberErrorResponse(access);
  const { id } = await context.params;

  const deleted = await prisma.address.deleteMany({
    where: { id, memberId: access.memberId },
  });
  if (deleted.count === 0) return NextResponse.json({ error: "ADDRESS_NOT_FOUND" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
