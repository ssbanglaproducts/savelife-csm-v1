import { NextResponse } from "next/server";
import { activeMemberErrorResponse, requireActiveMemberApi } from "@/lib/member-access";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/** All accounts owned by the signed-in principal, for the account switcher. */
export async function GET() {
  const access = await requireActiveMemberApi();
  if (!access.ok) return activeMemberErrorResponse(access);

  const principalId = access.principalId;
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
      where: { id: access.memberId },
      select: { id: true },
    }),
  ]);

  if (links.length === 0 && fallback) {
    return NextResponse.json({
      accounts: [
        {
          id: fallback.id,
          memberId: access.identity.memberId,
          name: access.identity.name ?? "Member",
          image: access.identity.image ?? null,
          role: access.identity.role,
          status: "ACTIVE",
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
      current: account.id === access.identity.id,
    })),
  });
}
