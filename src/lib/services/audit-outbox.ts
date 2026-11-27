import type { Prisma, PrismaClient } from "../../generated/prisma/client";
import { isUniqueViolation } from "./ledger";

export interface AuditOutboxPayload {
  actorId?: string | null;
  actorRole?: "MEMBER" | "ADMIN" | "STAFF" | null;
  action: string;
  entityType: string;
  entityId?: string;
  before?: Record<string, string | number | boolean | null>;
  after?: Record<string, string | number | boolean | null>;
  ip?: string;
}

export interface AuditOutboxFlushResult {
  readonly flushed: number;
  readonly failed: number;
}

const MAX_BATCH = 50;
const BACKOFF_BASE_MS = 1_000;
const MAX_BACKOFF_MS = 60_000;

function jsonInput(value: Prisma.JsonValue | null): Prisma.InputJsonValue | undefined {
  return value === null ? undefined : (value as Prisma.InputJsonValue);
}

function errorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.slice(0, 500);
}

function auditCreateData(row: {
  id: string;
  createdAt: Date;
  actorId: string | null;
  actorRole: "MEMBER" | "ADMIN" | "STAFF" | null;
  action: string;
  entityType: string;
  entityId: string | null;
  before: Prisma.JsonValue | null;
  after: Prisma.JsonValue | null;
  ip: string | null;
}) {
  return {
    id: row.id,
    createdAt: row.createdAt,
    actorId: row.actorId,
    actorRole: row.actorRole,
    action: row.action,
    entityType: row.entityType,
    entityId: row.entityId,
    before: jsonInput(row.before),
    after: jsonInput(row.after),
    ip: row.ip,
  };
}

/**
 * Writes an audit row ahead of the primary insert so a crash between the two
 * cannot lose the event. The returned id is reused by the primary insert.
 */
export async function queueAuditOutbox(
  client: PrismaClient,
  input: AuditOutboxPayload,
): Promise<{ id: string }> {
  const row = await client.auditOutbox.create({
    data: {
      actorId: input.actorId ?? null,
      actorRole: input.actorRole ?? null,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      before: input.before,
      after: input.after,
      ip: input.ip ?? null,
    },
  });
  return { id: row.id };
}

/**
 * Replays due outbox rows into AuditLog. A row is deleted only after its audit
 * insert commits; failures get an exponential retry delay and stay durable.
 */
export async function flushAuditOutbox(
  client: PrismaClient,
  limit = MAX_BATCH,
): Promise<AuditOutboxFlushResult> {
  const due = await client.auditOutbox.findMany({
    where: { nextAttemptAt: { lte: new Date() } },
    orderBy: { createdAt: "asc" },
    take: Math.max(1, Math.min(limit, MAX_BATCH)),
  });

  let flushed = 0;
  let failed = 0;

  for (const row of due) {
    try {
      await client.$transaction(async (tx) => {
        // A crash after the audit insert but before outbox deletion leaves the
        // row replayable. Check by id first so replay never inserts a duplicate.
        const existing = await tx.auditLog.findUnique({
          where: { id: row.id },
          select: { id: true },
        });
        if (!existing) {
          await tx.auditLog.create({ data: auditCreateData(row) });
        }
        // Another replay runner may have already deleted the row.
        await tx.auditOutbox.deleteMany({ where: { id: row.id } });
      });
      flushed += 1;
    } catch (error) {
      // A concurrent runner can win the insert race after findUnique. Only
      // clear the row when the conflicting id is this event's audit record.
      if (isUniqueViolation(error)) {
        let recovered = false;
        try {
          const existing = await client.auditLog.findUnique({
            where: { id: row.id },
            select: { id: true },
          });
          if (existing) {
            await client.auditOutbox.deleteMany({ where: { id: row.id } });
            recovered = true;
          }
        } catch (recoveryError) {
          console.error("Audit outbox recovery failed", { id: row.id }, recoveryError);
        }
        if (recovered) {
          flushed += 1;
          continue;
        }
      }

      failed += 1;
      const attempts = row.attempts + 1;
      const delay = Math.min(MAX_BACKOFF_MS, BACKOFF_BASE_MS * 2 ** Math.min(attempts, 6));
      console.error(
        "Audit outbox replay failed",
        {
          action: row.action,
          entityType: row.entityType,
          entityId: row.entityId,
          attempts,
        },
        error,
      );
      try {
        // A concurrent runner may have already deleted this row; updateMany
        // makes retry scheduling a no-op instead of a P2025 failure.
        await client.auditOutbox.updateMany({
          where: { id: row.id },
          data: {
            attempts,
            lastError: errorMessage(error),
            nextAttemptAt: new Date(Date.now() + delay),
          },
        });
      } catch (updateError) {
        console.error("Audit outbox retry schedule failed", { id: row.id }, updateError);
      }
    }
  }

  return { flushed, failed };
}
