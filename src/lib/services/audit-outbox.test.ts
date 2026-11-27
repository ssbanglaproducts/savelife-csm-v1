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

function makeClient({
  createFailure = "none",
  existingAudit = false,
  existingAuditAfterFailure = false,
}: {
  createFailure?: "none" | "database" | "unique";
  existingAudit?: boolean;
  existingAuditAfterFailure?: boolean;
} = {}) {
  const row = makeRow();
  let findCalls = 0;
  const auditLogFindUnique = vi.fn(async () => {
    findCalls += 1;
    if (existingAudit) return { id: row.id };
    if (existingAuditAfterFailure && findCalls > 1) return { id: row.id };
    return null;
  });
  const auditLogCreate = vi.fn(async (args: { data: Record<string, unknown> }) => {
    if (createFailure === "unique") {
      throw { code: "P2002", message: "Unique constraint failed on AuditLog_pkey" };
    }
    if (createFailure === "database") throw new Error("database unavailable");
    return args.data;
  });
  const auditOutboxDeleteMany = vi.fn(async () => ({ count: 1 }));
  const auditOutboxUpdateMany = vi.fn(async () => ({ count: 1 }));
  const client = {
    auditLog: {
      findUnique: auditLogFindUnique,
      create: auditLogCreate,
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
  return {
    client,
    auditLogFindUnique,
    auditLogCreate,
    auditOutboxDeleteMany,
    auditOutboxUpdateMany,
  };
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
    const { client, auditLogCreate, auditOutboxDeleteMany } = makeClient();

    const result = await flushAuditOutbox(client);

    expect(auditLogCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ id: "outbox-1" }) }),
    );
    expect(auditOutboxDeleteMany).toHaveBeenCalledWith({ where: { id: "outbox-1" } });
    expect(result).toEqual({ flushed: 1, failed: 0 });
  });

  it("clears replayed rows when the audit already exists by id", async () => {
    const { client, auditLogCreate, auditOutboxDeleteMany } = makeClient({ existingAudit: true });

    const result = await flushAuditOutbox(client);

    expect(auditLogCreate).not.toHaveBeenCalled();
    expect(auditOutboxDeleteMany).toHaveBeenCalledWith({ where: { id: "outbox-1" } });
    expect(result).toEqual({ flushed: 1, failed: 0 });
  });

  it("treats an insert race with the same audit id as success", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { client, auditOutboxDeleteMany, auditOutboxUpdateMany } = makeClient({
      createFailure: "unique",
      existingAuditAfterFailure: true,
    });

    const result = await flushAuditOutbox(client);

    expect(auditOutboxDeleteMany).toHaveBeenCalledWith({ where: { id: "outbox-1" } });
    expect(auditOutboxUpdateMany).not.toHaveBeenCalled();
    expect(result).toEqual({ flushed: 1, failed: 0 });
    expect(errorSpy).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it("schedules a retry when the audit insert fails", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { client, auditOutboxUpdateMany } = makeClient({ createFailure: "database" });

    const result = await flushAuditOutbox(client);

    expect(result).toEqual({ flushed: 0, failed: 1 });
    expect(auditOutboxUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "outbox-1" } }),
    );
    expect(errorSpy).toHaveBeenCalledTimes(1);
    errorSpy.mockRestore();
  });
});
