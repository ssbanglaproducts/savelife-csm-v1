import { cache } from "react";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  ADMIN_PERMISSION_VALUES,
  BASELINE_PERMISSIONS,
  isAdminPermission,
  type AdminPermission,
} from "./admin-permissions";

export type AdminRole = "ADMIN" | "STAFF";

export type AdminAccess = {
  id: string;
  memberId: string | null;
  role: AdminRole;
  name: string;
  email: string | null;
  permissions: ReadonlySet<AdminPermission>;
};

export function isAdminRole(role: unknown): role is AdminRole {
  return role === "ADMIN" || role === "STAFF";
}

/**
 * Request-scoped authorization source. Identity claims come from Auth.js, but
 * permission claims never do: they are loaded from the database on every
 * request so a revoked grant takes effect immediately.
 */
export const getAdminAccess = cache(async (): Promise<AdminAccess | null> => {
  const session = await auth();
  const user = session?.user;
  if (!user?.id || !isAdminRole(user.role)) return null;

  const member = await prisma.member.findUnique({
    where: { id: user.id },
    select: {
      role: true,
      status: true,
      memberId: true,
      fullName: true,
      email: true,
      staffPermissions: { select: { permission: true } },
    },
  });
  if (!member || member.status !== "ACTIVE" || !isAdminRole(member.role)) return null;

  const permissions = new Set<AdminPermission>(BASELINE_PERMISSIONS);
  if (member.role === "ADMIN") {
    for (const permission of ADMIN_PERMISSION_VALUES) permissions.add(permission);
  } else {
    for (const grant of member.staffPermissions) {
      if (isAdminPermission(grant.permission)) permissions.add(grant.permission);
    }
  }

  return {
    id: user.id,
    memberId: member.memberId,
    role: member.role,
    name: member.fullName,
    email: member.email,
    permissions,
  };
});

export function hasAdminPermission(access: AdminAccess, permission: AdminPermission): boolean {
  return access.permissions.has(permission);
}

export async function requireAdminAccess(
  permission?: AdminPermission,
): Promise<AdminAccess | null> {
  const access = await getAdminAccess();
  if (!access) return null;
  if (permission && !access.permissions.has(permission)) return null;
  return access;
}

/**
 * Route-handler guard shaped like an Auth.js session so existing handlers keep
 * reading `session.user.id` from a live, database-backed authorization source.
 */
export async function requireAdminApiSession(
  permission: AdminPermission,
): Promise<{
  user: {
    id: string;
    memberId: string | null;
    role: AdminRole;
    name: string;
    email: string | null;
    status: "ACTIVE";
  };
} | null> {
  const access = await requireAdminAccess(permission);
  if (!access) return null;
  return { user: { ...access, status: "ACTIVE" } };
}

/** Server-page guard with the existing localized admin-login redirect. */
export async function requireAdminPageAccess(
  locale: string,
  permission?: AdminPermission,
): Promise<AdminAccess> {
  const access = await requireAdminAccess(permission);
  if (!access) {
    // Imported here so route handlers can load this module without pulling the
    // localized navigation client into a Node-only test/runtime context.
    const { redirect } = await import("@/i18n/navigation");
    redirect({ href: "/admin-login", locale });
    // The localized redirect throws at runtime; this keeps the return type
    // precise when a caller is checked with TypeScript in isolation.
    throw new Error("ADMIN_LOGIN_REDIRECT");
  }
  return access;
}
