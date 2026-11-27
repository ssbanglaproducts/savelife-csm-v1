import { describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "../../generated/prisma/client";
import { flushAuditOutbox, queueAuditOutbox } from "./audit-outbox";

function makeRow() {
  return {
    id: "outbox-1",
    actorId: null,
    actorRole: null,
    action: "TEST_ACTION",
    entityType: "Test",
    entityId: "entity-1",
    before: null,
    after: { status: "DONE" },
    ip: null,
    attempts: 0,
    lastError: null,
    nextAttemptAt: new Date(),
    createdAt: new Date(),
  };
}

function makeClient({ upsertFails = false } = {}) {
  const row = makeRow();
  const auditLogUpsert = vi.fn(async (args: { create: Record<string, unknown> }) => {
    if (upsertFails) throw new Error("database unavailable");
    return args.create;
  });
  const auditOutboxDeleteMany = vi.fn(async () => ({ count: 1 }));
  const auditOutboxUpdateMany = vi.fn(async () => ({ count: 1 }));
  const client = {
    auditLog: {
      upsert: auditLogUpsert,
    },
    auditOutbox: {
      create: vi.fn(async (args: { data: Record<string, unknown> }) => ({
        id: row.id,
        ...args.data,
      })),
      findMany: vi.fn(async () => [row]),
      updateMany: auditOutboxUpdateMany,
      deleteMany: auditOutboxDeleteMany,
    },
    $transaction: vi.fn(async (run: (tx: unknown) => Promise<unknown>) => run(client)),
  } as unknown as PrismaClient;
  return { client, auditLogUpsert, auditOutboxDeleteMany, auditOutboxUpdateMany };
}

describe("audit outbox", () => {
  it("returns the queued row id for the primary insert", async () => {
    const { client } = makeClient();

    const queued = await queueAuditOutbox(client, {
      action: "TEST_ACTION",
      entityType: "Test",
      entityId: "entity-1",
    });

    expect(queued.id).toBe("outbox-1");
  });

  it("replays with the queued id so a crash cannot duplicate the audit", async () => {
    const { client, auditLogUpsert, auditOutboxDeleteMany } = makeClient();

    const result = await flushAuditOutbox(client);

    expect(auditLogUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "outbox-1" },
        create: expect.objectContaining({ id: "outbox-1" }),
        update: {},
      }),
    );
    expect(auditOutboxDeleteMany).toHaveBeenCalledWith({ where: { id: "outbox-1" } });
    expect(result).toEqual({ flushed: 1, failed: 0 });
  });

  it("schedules a retry even if a concurrent runner deleted the row", async () => {
    const { client, auditOutboxUpdateMany } = makeClient({ upsertFails: true });
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const result = await flushAuditOutbox(client);

    expect(result).toEqual({ flushed: 0, failed: 1 });
    expect(auditOutboxUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "outbox-1" } }),
    );
    expect(errorSpy).toHaveBeenCalledTimes(1);
    errorSpy.mockRestore();
  });
});
