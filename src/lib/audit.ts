import { prisma } from "@/lib/prisma";
import { isUniqueViolation } from "@/lib/services/ledger";
import { queueAuditOutbox } from "@/lib/services/audit-outbox";

export type AuditInput = {
  /** Null for system-authored actions such as scheduled investment credits. */
  actorId?: string | null;
  actorRole?: "MEMBER" | "ADMIN" | "STAFF" | null;
  action: string;
  entityType: string;
  entityId?: string;
  before?: Record<string, string | number | boolean | null>;
  after?: Record<string, string | number | boolean | null>;
};

function logContext(input: AuditInput) {
  return { action: input.action, entityType: input.entityType, entityId: input.entityId };
}

export async function writeAuditLog(input: AuditInput): Promise<void> {
  // Queue first: if the process dies before the primary insert, the timer can
  // still replay the event. A successful insert clears the queued row below.
  let outboxId: string | null = null;
  try {
    outboxId = (await queueAuditOutbox(prisma, input)).id;
  } catch (error) {
    console.error("Unable to queue audit outbox", logContext(input), error);
  }

  try {
    await prisma.auditLog.create({
      data: {
        ...(outboxId ? { id: outboxId } : {}),
        actorId: input.actorId ?? null,
        actorRole: input.actorRole ?? null,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        before: input.before,
        after: input.after,
      },
    });
  } catch (error) {
    if (isUniqueViolation(error) && outboxId) {
      // A replay may have inserted this id already; the audit exists.
      try {
        await prisma.auditOutbox.delete({ where: { id: outboxId } });
      } catch (deleteError) {
        console.error("Unable to clear audit outbox", logContext(input), deleteError);
      }
      return;
    }
    console.error("Unable to write audit log", logContext(input), error);
    if (!outboxId) {
      // Last resort when even the write-ahead row could not be created.
      try {
        await queueAuditOutbox(prisma, input);
      } catch (outboxError) {
        console.error("Unable to queue audit outbox", logContext(input), outboxError);
      }
    }
    return;
  }

  if (outboxId) {
    try {
      await prisma.auditOutbox.delete({ where: { id: outboxId } });
    } catch (error) {
      // The replay path is idempotent by id, so a leftover row is harmless.
      console.error("Unable to clear audit outbox", logContext(input), error);
    }
  }
}
