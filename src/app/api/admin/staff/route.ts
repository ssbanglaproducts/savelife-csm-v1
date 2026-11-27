import { createHash } from "node:crypto";
import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminAccess } from "@/lib/admin-access";
import { normalizeAdminEmail } from "@/lib/admin-login";
import {
  parseAssignedPermissions,
  type AdminPermission,
} from "@/lib/admin-permissions";
import { verifyAdminPassword } from "@/lib/admin-password";
import { writeAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { isUniqueViolation } from "@/lib/services/ledger";
import { serializeStaffAccount } from "@/lib/staff";

export const dynamic = "force-dynamic";

const identityFields = {
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().min(5).max(254),
  phone: z.string().trim().min(8).max(30),
} as const;

const mutationFields = {
  idempotencyKey: z.string().trim().min(8).max(200),
  adminPassword: z.string().min(1).max(200),
} as const;

const writeSchema = z.discriminatedUnion("action", [
  z.object({
    ...mutationFields,
    action: z.literal("CREATE"),
    ...identityFields,
    password: z.string().min(8).max(128),
    permissions: z.array(z.string()).max(64),
  }),
  z.object({
    ...mutationFields,
    action: z.literal("UPDATE"),
    targetId: z.string().min(1),
    ...identityFields,
    password: z.string().min(8).max(128).optional(),
    permissions: z.array(z.string()).max(64),
  }),
  z.object({
    ...mutationFields,
    action: z.literal("SET_STATUS"),
    targetId: z.string().min(1),
    status: z.enum(["ACTIVE", "SUSPENDED"]),
  }),
]);

const staffSelect = {
  id: true,
  memberId: true,
  fullName: true,
  email: true,
  phone: true,
  role: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  staffPermissions: { select: { permission: true } },
} as const;

type WriteInput = z.infer<typeof writeSchema>;
type NormalizedInput =
  | {
      action: "CREATE";
      name: string;
      email: string;
      phone: string;
      password: string;
      permissions: AdminPermission[];
    }
  | {
      action: "UPDATE";
      targetId: string;
      name: string;
      email: string;
      phone: string;
      password: string | null;
      permissions: AdminPermission[];
    }
  | {
      action: "SET_STATUS";
      targetId: string;
      status: "ACTIVE" | "SUSPENDED";
    };

class StaffRequestError extends Error {
  constructor(
    readonly code: string,
    readonly status = 400,
  ) {
    super(code);
  }
}

function fail(code: string, status = 400) {
  return NextResponse.json({ error: code }, { status });
}

function normalizeInput(input: WriteInput): NormalizedInput {
  if (input.action === "SET_STATUS") {
    return { action: input.action, targetId: input.targetId, status: input.status };
  }

  const email = normalizeAdminEmail(input.email);
  if (!email) throw new StaffRequestError("INVALID_EMAIL");
  const permissions = parseAssignedPermissions(input.permissions);
  if (input.action === "CREATE") {
    return {
      action: "CREATE",
      name: input.name,
      email,
      phone: input.phone,
      password: input.password,
      permissions,
    };
  }

  return {
    action: "UPDATE",
    targetId: input.targetId,
    name: input.name,
    email,
    phone: input.phone,
    password: input.password ?? null,
    permissions,
  };
}

function requestHash(actorId: string, input: NormalizedInput): string {
  const payload =
    input.action === "CREATE"
      ? {
          action: input.action,
          actorId,
          name: input.name,
          email: input.email,
          phone: input.phone,
          permissions: input.permissions,
          password: input.password,
        }
      : input.action === "UPDATE"
        ? {
            action: input.action,
            actorId,
            targetId: input.targetId,
            name: input.name,
            email: input.email,
            phone: input.phone,
            permissions: input.permissions,
            password: input.password,
          }
        : {
            action: input.action,
            actorId,
            targetId: input.targetId,
            status: input.status,
          };

  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

function assertGrantable(
  actor: { role: "ADMIN" | "STAFF"; permissions: ReadonlySet<AdminPermission> },
  permissions: readonly AdminPermission[],
): void {
  if (actor.role === "ADMIN") return;
  if (!permissions.every((permission) => actor.permissions.has(permission))) {
    throw new StaffRequestError("PERMISSION_ESCALATION", 403);
  }
}

export async function GET() {
  const access = await requireAdminAccess("staff.view");
  if (!access) return fail("FORBIDDEN", 403);

  const rows = await prisma.member.findMany({
    where: { role: "STAFF" },
    select: staffSelect,
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ staff: rows.map(serializeStaffAccount) });
}

export async function POST(request: Request) {
  const access = await requireAdminAccess("staff.manage");
  if (!access) return fail("FORBIDDEN", 403);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail("Invalid request");
  }

  const parsed = writeSchema.safeParse(body);
  if (!parsed.success) return fail("Invalid request");

  let input: NormalizedInput;
  let hash: string;
  try {
    input = normalizeInput(parsed.data);
    hash = requestHash(access.id, input);
  } catch (error) {
    if (error instanceof StaffRequestError) return fail(error.code, error.status);
    throw error;
  }

  // A replay with the same key and payload is safe even if the acting password
  // has since changed. Reusing a key for different data is always rejected.
  const existing = await prisma.staffMutation.findUnique({
    where: { idempotencyKey: parsed.data.idempotencyKey },
    select: { requestHash: true, targetId: true },
  });
  if (existing) {
    if (existing.requestHash !== hash) return fail("DUPLICATE_REQUEST", 409);
    return NextResponse.json({ ok: true, replayed: true, targetId: existing.targetId });
  }

  if (!(await verifyAdminPassword(access.id, parsed.data.adminPassword))) {
    return fail("INVALID_ADMIN_PASSWORD", 401);
  }

  if (input.action !== "CREATE" && input.targetId === access.id) {
    return fail("SELF_LOCKOUT", 409);
  }

  try {
    if (input.action !== "CREATE") {
      assertGrantable(access, []);
    }

    const result = await prisma.$transaction(async (tx) => {
      let targetId: string;
      let action: string;
      let before: Record<string, string | null> | undefined;
      let after: Record<string, string | null> | undefined;

      if (input.action === "CREATE") {
        assertGrantable(access, input.permissions);

        const duplicate = await tx.member.findFirst({
          where: {
            email: { equals: input.email, mode: "insensitive" },
            role: { in: ["ADMIN", "STAFF"] },
          },
          select: { id: true },
        });
        if (duplicate) throw new StaffRequestError("DUPLICATE_EMAIL", 409);

        const target = await tx.member.create({
          data: {
            fullName: input.name,
            email: input.email,
            phone: input.phone,
            passwordHash: await bcrypt.hash(input.password, 10),
            role: "STAFF",
            status: "ACTIVE",
            activationDate: new Date(),
            staffPermissions: {
              create: input.permissions.map((permission) => ({
                permission,
                grantedById: access.id,
              })),
            },
          },
          select: staffSelect,
        });
        targetId = target.id;
        action = "STAFF_CREATED";
        after = {
          email: target.email,
          permissions: input.permissions.join(",") || "",
          status: target.status,
        };
      } else {
        const target = await tx.member.findFirst({
          where: { id: input.targetId, role: { in: ["ADMIN", "STAFF"] } },
          select: staffSelect,
        });
        if (!target) throw new StaffRequestError("TARGET_NOT_FOUND", 404);

        if (target.role === "ADMIN") {
          // Staff may manage explicit grants, never a super-admin account.
          if (access.role === "STAFF") {
            throw new StaffRequestError("ADMIN_PROTECTED", 409);
          }
          if (input.action !== "SET_STATUS" || input.status !== "SUSPENDED") {
            throw new StaffRequestError("ADMIN_PROTECTED", 409);
          }
          const activeAdmins = await tx.member.count({
            where: { role: "ADMIN", status: "ACTIVE" },
          });
          if (activeAdmins <= 1) throw new StaffRequestError("LAST_SUPER_ADMIN", 409);
        }

        if (input.action === "SET_STATUS") {
          await tx.member.update({
            where: { id: target.id },
            data: { status: input.status },
          });
          targetId = target.id;
          action = "STAFF_STATUS_CHANGED";
          before = { status: target.status };
          after = { status: input.status };
        } else {
          assertGrantable(access, input.permissions);
          const duplicate = await tx.member.findFirst({
            where: {
              email: { equals: input.email, mode: "insensitive" },
              role: { in: ["ADMIN", "STAFF"] },
              id: { not: target.id },
            },
            select: { id: true },
          });
          if (duplicate) throw new StaffRequestError("DUPLICATE_EMAIL", 409);

          await tx.member.update({
            where: { id: target.id },
            data: {
              fullName: input.name,
              email: input.email,
              phone: input.phone,
              ...(input.password ? { passwordHash: await bcrypt.hash(input.password, 10) } : {}),
            },
          });
          await tx.staffPermissionGrant.deleteMany({ where: { memberId: target.id } });
          if (input.permissions.length > 0) {
            await tx.staffPermissionGrant.createMany({
              data: input.permissions.map((permission) => ({
                memberId: target.id,
                permission,
                grantedById: access.id,
              })),
            });
          }
          targetId = target.id;
          action = input.password ? "STAFF_UPDATED_WITH_PASSWORD" : "STAFF_UPDATED";
          before = {
            fullName: target.fullName,
            email: target.email,
            phone: target.phone,
            permissions:
              target.staffPermissions.map((grant) => grant.permission).sort().join(",") || "",
          };
          after = {
            fullName: input.name,
            email: input.email,
            phone: input.phone,
            permissions: input.permissions.join(",") || "",
          };
        }
      }

      await tx.staffMutation.create({
        data: {
          idempotencyKey: parsed.data.idempotencyKey,
          action,
          requestHash: hash,
          actorId: access.id,
          targetId,
        },
      });

      return { targetId, action, before, after };
    });

    await writeAuditLog({
      actorId: access.id,
      actorRole: access.role,
      action: result.action,
      entityType: "StaffAccount",
      entityId: result.targetId,
      before: result.before,
      after: result.after,
    });

    return NextResponse.json({ ok: true, targetId: result.targetId }, { status: 201 });
  } catch (error) {
    if (error instanceof StaffRequestError) return fail(error.code, error.status);
    if (isUniqueViolation(error)) {
      const replay = await prisma.staffMutation.findUnique({
        where: { idempotencyKey: parsed.data.idempotencyKey },
        select: { requestHash: true, targetId: true },
      });
      if (replay) {
        if (replay.requestHash !== hash) return fail("DUPLICATE_REQUEST", 409);
        return NextResponse.json({ ok: true, replayed: true, targetId: replay.targetId });
      }
      return fail("DUPLICATE_EMAIL", 409);
    }
    console.error("Staff mutation failed", error);
    return fail("STAFF_MUTATION_FAILED", 500);
  }
}
