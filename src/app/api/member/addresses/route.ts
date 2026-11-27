import { NextResponse } from "next/server";
import { addressInputSchema } from "@/lib/address-input";
import { activeMemberErrorResponse, requireActiveMemberApi } from "@/lib/member-access";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const access = await requireActiveMemberApi();
  if (!access.ok) return activeMemberErrorResponse(access);

  const addresses = await prisma.address.findMany({
    where: { memberId: access.memberId },
    orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
    select: {
      id: true,
      label: true,
      fullName: true,
      phone: true,
      street: true,
      thana: true,
      city: true,
      district: true,
      postalCode: true,
      country: true,
      isDefault: true,
    },
  });

  return NextResponse.json({
    addresses: addresses.map((address) => ({
      ...address,
      street: address.street,
      thana: address.thana ?? address.city,
      isMain: address.isDefault,
    })),
  });
}

export async function POST(request: Request) {
  const access = await requireActiveMemberApi();
  if (!access.ok) return activeMemberErrorResponse(access);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const parsed = addressInputSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  const data = parsed.data;

  const member = await prisma.member.findUnique({
    where: { id: access.memberId },
    select: { fullName: true, phone: true },
  });
  if (!member) return NextResponse.json({ error: "MEMBER_NOT_FOUND" }, { status: 404 });

  const isMain = typeof body === "object" && body !== null && "isMain" in body
    ? Boolean((body as { isMain?: unknown }).isMain)
    : false;

  const address = await prisma.$transaction(async (tx) => {
    if (isMain) {
      await tx.address.updateMany({
        where: { memberId: access.memberId },
        data: { isDefault: false },
      });
    }
    return tx.address.create({
      data: {
        memberId: access.memberId,
        label: data.label,
        fullName: member.fullName,
        phone: member.phone,
        street: data.fullAddress,
        city: data.thana,
        thana: data.thana,
        district: data.district,
        postalCode: data.postalCode,
        country: "Bangladesh",
        isDefault: isMain,
      },
      select: {
        id: true,
        label: true,
        fullName: true,
        phone: true,
        street: true,
        thana: true,
        district: true,
        postalCode: true,
        isDefault: true,
      },
    });
  });

  return NextResponse.json({ address: { ...address, isMain: address.isDefault } }, { status: 201 });
}
