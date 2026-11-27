import { beforeEach, describe, expect, it, vi } from "vitest";
import { createAdminPasswordLimiter, createAdminPasswordVerifier } from "./admin-password";
import { InMemoryKeyValueStore, type AttemptState } from "./rate-limit";

function verifier(now: () => number) {
  const store = new InMemoryKeyValueStore<AttemptState>();
  const events: Array<{ event: string; failures?: number }> = [];
  const verify = createAdminPasswordVerifier({
    limiter: createAdminPasswordLimiter(store, now),
    findPasswordHash: async (memberId) => (memberId === "admin-1" ? "hash" : null),
    comparePassword: async (password) => password === "correct",
    onEvent: (event, details) => {
      events.push({ event, failures: details.failures });
    },
  });
  return { verify, store, events };
}

describe("admin password re-auth lockout", () => {
  beforeEach(() => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  it("locks after five failures and rejects even the correct password while locked", async () => {
    let now = 1_000;
    const { verify, events } = verifier(() => now);

    for (let attempt = 0; attempt < 4; attempt += 1) {
      expect(await verify("admin-1", "wrong")).toBe(false);
    }
    expect(await verify("admin-1", "wrong")).toBe(false);
    expect(await verify("admin-1", "correct")).toBe(false);

    now += 30_001;
    expect(await verify("admin-1", "correct")).toBe(true);
    expect(events.filter((item) => item.event === "LOCKED")).toHaveLength(1);
  });

  it("resets failures after a successful verification", async () => {
    const { verify, store } = verifier(() => 2_000);

    expect(await verify("admin-1", "wrong")).toBe(false);
    expect(await verify("admin-1", "correct")).toBe(true);
    expect(store.read("admin-1")).toBeUndefined();
  });

  it("uses an injected store without any database access", async () => {
    const store = new InMemoryKeyValueStore<AttemptState>();
    const verify = createAdminPasswordVerifier({
      limiter: createAdminPasswordLimiter(store, () => 3_000),
      findPasswordHash: async () => "hash",
      comparePassword: async () => false,
      onEvent: () => {},
    });

    expect(await verify("other-admin", "wrong")).toBe(false);
    expect(store.read("other-admin")).toMatchObject({ failures: 1, updatedAt: 3_000 });
  });
});
