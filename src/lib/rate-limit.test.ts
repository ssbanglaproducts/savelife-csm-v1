import { describe, expect, it } from "vitest";
import {
  FailureLimiter,
  FixedWindowLimiter,
  InMemoryKeyValueStore,
  type AttemptState,
  type WindowState,
} from "./rate-limit";

describe("FailureLimiter", () => {
  it("locks after the configured failure count and resets on success path", async () => {
    let now = 1_000;
    const store = new InMemoryKeyValueStore<AttemptState>();
    const limiter = new FailureLimiter(
      store,
      {
        maxFailures: 3,
        lockoutMs: 1_000,
        stateTtlMs: 10_000,
        resetAfterLockout: true,
      },
      () => now,
    );

    expect((await limiter.check("a")).blocked).toBe(false);
    await limiter.recordFailure("a");
    await limiter.recordFailure("a");
    expect((await limiter.check("a")).blocked).toBe(false);
    await limiter.recordFailure("a");
    expect((await limiter.check("a"))).toMatchObject({ blocked: true, retryAfterMs: 1_000 });

    now += 1_001;
    expect((await limiter.check("a")).blocked).toBe(false);
    expect((await limiter.check("a")).failures).toBe(0);
  });

  it("escalates backoff when resetAfterLockout is false", async () => {
    let now = 5_000;
    const limiter = new FailureLimiter(
      new InMemoryKeyValueStore<AttemptState>(),
      {
        maxFailures: 2,
        lockoutMs: 1_000,
        maxLockoutMs: 4_000,
        stateTtlMs: 60_000,
        resetAfterLockout: false,
      },
      () => now,
    );

    await limiter.recordFailure("account");
    await limiter.recordFailure("account");
    expect((await limiter.check("account")).retryAfterMs).toBe(1_000);

    now += 1_001;
    expect((await limiter.check("account")).blocked).toBe(false);
    await limiter.recordFailure("account");
    expect((await limiter.check("account")).retryAfterMs).toBe(2_000);
  });

  it("accepts an injected store", async () => {
    const store = new InMemoryKeyValueStore<AttemptState>();
    const limiter = new FailureLimiter(
      store,
      { maxFailures: 1, lockoutMs: 500, stateTtlMs: 5_000 },
      () => 100,
    );

    await limiter.recordFailure("injected");
    expect(store.read("injected")).toMatchObject({
      failures: 1,
      lockedUntil: 600,
      updatedAt: 100,
    });
    await limiter.reset("injected");
    expect(store.read("injected")).toBeUndefined();
  });
});

describe("FixedWindowLimiter", () => {
  it("allows up to the limit per window and reports retry delay", async () => {
    let now = 10_000;
    const limiter = new FixedWindowLimiter(
      new InMemoryKeyValueStore<WindowState>(),
      { limit: 2, windowMs: 1_000 },
      () => now,
    );

    expect((await limiter.consume("ip")).allowed).toBe(true);
    expect((await limiter.consume("ip")).allowed).toBe(true);
    const blocked = await limiter.consume("ip");
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterMs).toBe(1_000);

    now += 1_001;
    expect((await limiter.consume("ip")).allowed).toBe(true);
  });
});
