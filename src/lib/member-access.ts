import { prisma } from "@/lib/prisma";
import type { MemberStatus } from "@/lib/viewer";

/** Live member status; never trust the JWT snapshot for store access rules. */
export async function getMemberStatus(memberId: string): Promise<MemberStatus | null> {
  const member = await prisma.member.findUnique({
    where: { id: memberId },
    select: { status: true },
  });
  return member?.status ?? null;
}

export type MemberAccessResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly code: string; readonly status: number };

/**
 * Money-moving member routes must read the current status from the database.
 * The JWT contains a status snapshot and can be stale after activation or
 * suspension.
 */
export async function checkMemberCanTransact(memberId: string): Promise<MemberAccessResult> {
  const member = await prisma.member.findUnique({
    where: { id: memberId },
    select: { status: true },
  });

  if (!member) return { ok: false, code: "MEMBER_NOT_FOUND", status: 404 };
  if (member.status !== "ACTIVE") {
    return { ok: false, code: "MEMBER_NOT_ACTIVE", status: 403 };
  }
  return { ok: true };
}

/**
 * Wallet-funded checkout is the activation path. INACTIVE members may place a
 * paid order; SUSPENDED members may not move money at all.
 */
export async function checkMemberCanCheckout(memberId: string): Promise<MemberAccessResult> {
  const member = await prisma.member.findUnique({
    where: { id: memberId },
    select: { status: true },
  });

  if (!member) return { ok: false, code: "MEMBER_NOT_FOUND", status: 404 };
  if (member.status === "SUSPENDED") {
    return { ok: false, code: "MEMBER_SUSPENDED", status: 403 };
  }
  return { ok: true };
}
