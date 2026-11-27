import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { addressInputSchema } from "@/lib/address-input";
import { getMemberStatus } from "@/lib/member-access";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "LOGIN_REQUIRED" }, { status: 401 });
  if (session.user.role !== "MEMBER") return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

  const addresses = await prisma.address.findMany({
    where: { memberId: session.user.id },
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
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "LOGIN_REQUIRED" }, { status: 401 });
  if (session.user.role !== "MEMBER") {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }
  // Live status: the JWT snapshot may be stale after activation or suspension.
  if ((await getMemberStatus(session.user.id)) !== "ACTIVE") {
    return NextResponse.json({ error: "MEMBER_NOT_ACTIVE" }, { status: 403 });
  }

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
    where: { id: session.user.id },
    select: { fullName: true, phone: true },
  });
  if (!member) return NextResponse.json({ error: "MEMBER_NOT_FOUND" }, { status: 404 });

  const isMain = typeof body === "object" && body !== null && "isMain" in body
    ? Boolean((body as { isMain?: unknown }).isMain)
    : false;

  const address = await prisma.$transaction(async (tx) => {
    if (isMain) {
      await tx.address.updateMany({
        where: { memberId: session.user.id },
        data: { isDefault: false },
      });
    }
    return tx.address.create({
      data: {
        memberId: session.user.id,
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
