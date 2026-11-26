import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/** All accounts owned by the signed-in principal, for the account switcher. */
export async function GET() {
  const session = await auth();
  const user = session?.user;
  if (!user?.id) {
    return NextResponse.json({ error: "LOGIN_REQUIRED" }, { status: 401 });
  }

  const principalId = user.principalId ?? user.id;
  const [links, fallback] = await Promise.all([
    prisma.accountOwnership.findMany({
      where: { ownerId: principalId },
      orderBy: [{ createdAt: "asc" }, { accountId: "asc" }],
      select: {
        account: {
          select: {
            id: true,
            memberId: true,
            fullName: true,
            profileImage: true,
            role: true,
            status: true,
            wallet: { select: { availablePaisa: true } },
          },
        },
      },
    }),
    prisma.member.findUnique({
      where: { id: user.id },
      select: { id: true },
    }),
  ]);

  if (links.length === 0 && fallback) {
    return NextResponse.json({
      accounts: [
        {
          id: fallback.id,
          memberId: user.memberId,
          name: user.name ?? "Member",
          image: user.image ?? null,
          role: user.role,
          status: user.status,
          availablePaisa: "0",
          current: true,
        },
      ],
    });
  }

  return NextResponse.json({
    accounts: links.map(({ account }) => ({
      id: account.id,
      memberId: account.memberId,
      name: account.fullName,
      image: account.profileImage,
      role: account.role,
      status: account.status,
      availablePaisa: (account.wallet?.availablePaisa ?? 0n).toString(),
      current: account.id === user.id,
    })),
  });
}
