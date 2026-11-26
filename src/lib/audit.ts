import { prisma } from "@/lib/prisma";

export type AuditInput = {
  /** Null for system-authored actions such as scheduled investment credits. */
  actorId?: string | null;
  actorRole?: "MEMBER" | "ADMIN" | null;
  action: string;
  entityType: string;
  entityId?: string;
  before?: Record<string, string | number | boolean | null>;
  after?: Record<string, string | number | boolean | null>;
};

export async function writeAuditLog(input: AuditInput): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        actorId: input.actorId ?? null,
        actorRole: input.actorRole ?? null,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        before: input.before,
        after: input.after,
      },
    });
  } catch {
    // Audit failures must not mask the primary mutation, but they are visible
    // in server logs for follow-up.
    console.error("Unable to write audit log", input.action);
  }
}
