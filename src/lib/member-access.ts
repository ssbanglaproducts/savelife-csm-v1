import { NextResponse } from "next/server";
import type { Session } from "next-auth";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import type { MemberStatus } from "@/lib/viewer";

/** Live member status; never trust the JWT snapshot for store access rules. */
export async function getMemberStatus(memberId: string): Promise<MemberStatus | null> {
  const member = await prisma.member.findUnique({
    where: { id: memberId, role: "MEMBER" },
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
    where: { id: memberId, role: "MEMBER" },
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
export type ActiveMemberApiResult =
  | {
      readonly ok: true;
      readonly memberId: string;
      readonly principalId: string;
      readonly identity: Session["user"];
    }
  | {
      readonly ok: false;
      readonly code: "LOGIN_REQUIRED" | "FORBIDDEN" | "MEMBER_NOT_ACTIVE";
      readonly status: 401 | 403;
    };

/**
 * Central guard for non-public member APIs. The session supplies the identity,
 * while role and status are re-read from the database so a stale JWT cannot
 * keep a suspended or deactivated member authorized. Money routes use the
 * transaction-specific checks below instead; checkout and cart keep their
 * explicit activation exceptions.
 */
export async function requireActiveMemberApi(): Promise<ActiveMemberApiResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, code: "LOGIN_REQUIRED", status: 401 };
  if (session.user.role !== "MEMBER") return { ok: false, code: "FORBIDDEN", status: 403 };

  const member = await prisma.member.findUnique({
    where: { id: session.user.id, role: "MEMBER" },
    select: { status: true },
  });
  if (!member || member.status !== "ACTIVE") {
    return { ok: false, code: "MEMBER_NOT_ACTIVE", status: 403 };
  }
  return {
    ok: true,
    memberId: session.user.id,
    principalId: session.user.principalId ?? session.user.id,
    identity: session.user,
  };
}

export type ActivePrincipalApiResult =
  | {
      readonly ok: true;
      readonly memberId: string;
      readonly principalId: string;
      readonly role: "MEMBER" | "ADMIN" | "STAFF";
      readonly identity: Session["user"];
    }
  | {
      readonly ok: false;
      readonly code: "LOGIN_REQUIRED" | "FORBIDDEN" | "MEMBER_NOT_ACTIVE";
      readonly status: 401 | 403;
    };

/**
 * Shared endpoints (notifications and image uploads) are used by both member
 * and admin panels. Every role is still re-read from the database so a stale
 * or suspended account cannot stay authorized.
 */
export async function requireActivePrincipalApi(): Promise<ActivePrincipalApiResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, code: "LOGIN_REQUIRED", status: 401 };

  const role = session.user.role;
  if (role !== "MEMBER" && role !== "ADMIN" && role !== "STAFF") {
    return { ok: false, code: "FORBIDDEN", status: 403 };
  }

  const member = await prisma.member.findUnique({
    where: {
      id: session.user.id,
      role: { in: role === "MEMBER" ? ["MEMBER"] : ["ADMIN", "STAFF"] },
    },
    select: { status: true },
  });
  if (!member || member.status !== "ACTIVE") {
    return {
      ok: false,
      code: role === "MEMBER" ? "MEMBER_NOT_ACTIVE" : "FORBIDDEN",
      status: 403,
    };
  }

  return {
    ok: true,
    memberId: session.user.id,
    principalId: session.user.principalId ?? session.user.id,
    role,
    identity: session.user,
  };
}

export type ActiveApiFailure = {
  readonly ok?: false;
  readonly code: "LOGIN_REQUIRED" | "FORBIDDEN" | "MEMBER_NOT_ACTIVE";
  readonly status: 401 | 403;
};

/** Convert a guard failure into the existing JSON error contract. */
export function activeMemberErrorResponse(failure: ActiveApiFailure) {
  return NextResponse.json({ error: failure.code }, { status: failure.status });
}

export async function checkMemberCanCheckout(memberId: string): Promise<MemberAccessResult> {
  const member = await prisma.member.findUnique({
    where: { id: memberId, role: "MEMBER" },
    select: { status: true },
  });

  if (!member) return { ok: false, code: "MEMBER_NOT_FOUND", status: 404 };
  if (member.status === "SUSPENDED") {
    return { ok: false, code: "MEMBER_SUSPENDED", status: 403 };
  }
  return { ok: true };
}
