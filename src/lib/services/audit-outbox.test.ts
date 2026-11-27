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

function makeClient(alreadyInserted = false) {
  const row = makeRow();
  const auditLogCreate = vi.fn(async (args: { data: Record<string, unknown> }) => {
    if (alreadyInserted) {
      const error = new Error("duplicate");
      Object.assign(error, { code: "P2002" });
      throw error;
    }
    return args.data;
  });
  const auditOutboxDelete = vi.fn(async () => row);
  const client = {
    auditLog: {
      create: auditLogCreate,
      findUnique: vi.fn(async () =>
        alreadyInserted ? { id: row.id } : null,
      ),
    },
    auditOutbox: {
      create: vi.fn(async (args: { data: Record<string, unknown> }) => ({
        id: row.id,
        ...args.data,
      })),
      findMany: vi.fn(async () => [row]),
      update: vi.fn(async (args: { data: Record<string, unknown> }) => args.data),
      delete: auditOutboxDelete,
    },
    $transaction: vi.fn(async (run: (tx: unknown) => Promise<unknown>) => run(client)),
  } as unknown as PrismaClient;
  return { client, auditLogCreate, auditOutboxDelete };
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
    const { client, auditLogCreate, auditOutboxDelete } = makeClient();

    const result = await flushAuditOutbox(client);

    expect(auditLogCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ id: "outbox-1" }) }),
    );
    expect(auditOutboxDelete).toHaveBeenCalledWith({ where: { id: "outbox-1" } });
    expect(result).toEqual({ flushed: 1, failed: 0 });
  });

  it("clears a queued row when the audit was already inserted", async () => {
    const { client, auditOutboxDelete } = makeClient(true);
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    const result = await flushAuditOutbox(client);

    expect(auditOutboxDelete).toHaveBeenCalledWith({ where: { id: "outbox-1" } });
    expect(result).toEqual({ flushed: 1, failed: 0 });
  });
});
