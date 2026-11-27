import { describe, expect, it } from "vitest";
import { InMemoryKeyValueStore, hashRateLimitKey, requestIpKey, type AttemptState } from "./rate-limit";
import { createLoginThrottleWithStores, loginContext } from "./login-throttle";

function makeThrottle(now: () => number) {
  const ipStore = new InMemoryKeyValueStore<AttemptState>();
  const accountStore = new InMemoryKeyValueStore<AttemptState>();
  return { throttle: createLoginThrottleWithStores(ipStore, accountStore, now), ipStore, accountStore };
}

const REQUEST = new Request("https://example.test/api/auth/callback/credentials", {
  headers: { "x-forwarded-for": "203.0.113.10, 10.0.0.1", "x-real-ip": "198.51.100.7" },
});

describe("login throttle", () => {
  it("locks an account after five failures without affecting a different account", async () => {
    let now = 1_000;
    const { throttle } = makeThrottle(() => now);
    const first = loginContext(REQUEST, "MEMBER", "SL100001");
    const second = loginContext(REQUEST, "MEMBER", "SL100002");

    for (let attempt = 0; attempt < 5; attempt += 1) {
      expect((await throttle.check(first)).ok).toBe(true);
      await throttle.recordFailure(first);
    }

    expect(await throttle.check(first)).toMatchObject({
      ok: false,
      scope: "account",
      retryAfterMs: 60_000,
    });
    expect((await throttle.check(second)).ok).toBe(true);

    now += 60_001;
    expect((await throttle.check(first)).ok).toBe(true);
    await throttle.recordFailure(first);
    expect(await throttle.check(first)).toMatchObject({ ok: false, retryAfterMs: 120_000 });
  });

  it("locks a source IP after ten failures across different accounts", async () => {
    const { throttle } = makeThrottle(() => 2_000);
    const contexts = Array.from({ length: 10 }, (_, index) =>
      loginContext(REQUEST, "MEMBER", `SL${String(200000 + index)}`),
    );

    for (const context of contexts) {
      await throttle.recordFailure(context);
    }

    const freshAccount = loginContext(REQUEST, "MEMBER", "SL999999");
    expect(await throttle.check(freshAccount)).toMatchObject({ ok: false, scope: "ip" });
  });

  it("clears account backoff on success but keeps the IP counter", async () => {
    const { throttle } = makeThrottle(() => 3_000);
    const context = loginContext(REQUEST, "MEMBER", "SL300001");

    await throttle.recordFailure(context);
    await throttle.clearAccount(context.accountKey);

    expect((await throttle.check(context)).ok).toBe(true);

    for (let index = 0; index < 9; index += 1) {
      await throttle.recordFailure(loginContext(REQUEST, "MEMBER", `SL${400000 + index}`));
    }
    expect(await throttle.check(context)).toMatchObject({ ok: false, scope: "ip" });
  });

  it("hashes and normalizes identifier keys without exposing raw values", () => {
    const member = loginContext(REQUEST, "MEMBER", "sl123456");
    const admin = loginContext(REQUEST, "ADMIN", " Admin@Example.test ");

    expect(member.accountKey).toBe(`login:MEMBER:${hashRateLimitKey("SL123456")}`);
    expect(admin.accountKey).toBe(`login:ADMIN:${hashRateLimitKey("admin@example.test")}`);
    expect(member.accountKey).not.toContain("SL123456");
    // x-real-ip is trusted before x-forwarded-for, whose first value is client-controlled.
    expect(requestIpKey(REQUEST)).toBe(hashRateLimitKey("198.51.100.7"));
  });
});
