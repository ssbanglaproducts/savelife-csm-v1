import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/** Lightweight identity + spendable balance for the storefront header. */
export async function GET() {
  const session = await auth();
  const user = session?.user;

  if (!user?.id) {
    return NextResponse.json({ viewer: null, availablePaisa: "0" });
  }

  const [member, wallet] = await Promise.all([
    prisma.member.findUnique({
      where: { id: user.id },
      select: { fullName: true, profileImage: true, memberId: true, role: true, status: true, phone: true },
    }),
    prisma.wallet.findUnique({
      where: { memberId: user.id },
      select: { availablePaisa: true },
    }),
  ]);

  return NextResponse.json({
    viewer: {
      // Read the live profile so a freshly uploaded avatar/name appears in the
      // storefront header without requiring another sign-in.
      name: member?.fullName ?? user.name ?? "Member",
      image: member?.profileImage ?? user.image ?? null,
      memberId: member?.memberId ?? user.memberId,
      role: member?.role ?? user.role,
      status: member?.status ?? user.status ?? "INACTIVE",
      phone: member?.phone ?? null,
    },
    availablePaisa: (wallet?.availablePaisa ?? 0n).toString(),
  });
}
