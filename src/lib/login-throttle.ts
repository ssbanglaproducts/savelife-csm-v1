import {
  FailureLimiter,
  InMemoryKeyValueStore,
  hashRateLimitKey,
  requestIpKey,
  sharedRateLimiter,
  type FailureLimiterOptions,
  type KeyValueStore,
  type AttemptState,
} from "@/lib/rate-limit";
import type { LoginRole } from "@/lib/admin-login";

/**
 * Second-layer login protection. It is deliberately process-local (documented
 * in the README); the injectable store/clock make it straightforward to move
 * the counters to Redis later without changing the auth callback.
 */

export type LoginThrottleContext = {
  ipKey: string;
  accountKey: string;
};

export type LoginThrottleDecision =
  | { ok: true }
  | { ok: false; scope: "ip" | "account"; retryAfterMs: number };

export type LoginThrottleOptions = {
  ip?: FailureLimiter;
  account?: FailureLimiter;
  now?: () => number;
};

const IP_OPTIONS: FailureLimiterOptions = {
  maxFailures: 10,
  lockoutMs: 60_000,
  maxLockoutMs: 15 * 60_000,
  stateTtlMs: 60 * 60_000,
  maxTrackedKeys: 20_000,
  resetAfterLockout: false,
};

const ACCOUNT_OPTIONS: FailureLimiterOptions = {
  maxFailures: 5,
  lockoutMs: 60_000,
  maxLockoutMs: 15 * 60_000,
  stateTtlMs: 60 * 60_000,
  maxTrackedKeys: 50_000,
  resetAfterLockout: false,
};

export class LoginThrottle {
  private readonly ip: FailureLimiter;
  private readonly account: FailureLimiter;

  constructor(options: LoginThrottleOptions = {}) {
    const now = options.now ?? Date.now;
    this.ip =
      options.ip ??
      new FailureLimiter(new InMemoryKeyValueStore<AttemptState>(20_000), IP_OPTIONS, now);
    this.account =
      options.account ??
      new FailureLimiter(new InMemoryKeyValueStore<AttemptState>(50_000), ACCOUNT_OPTIONS, now);
  }

  async check(context: LoginThrottleContext): Promise<LoginThrottleDecision> {
    const ip = await this.ip.check(context.ipKey);
    if (ip.blocked) return { ok: false, scope: "ip", retryAfterMs: ip.retryAfterMs };

    const account = await this.account.check(context.accountKey);
    if (account.blocked) return { ok: false, scope: "account", retryAfterMs: account.retryAfterMs };
    return { ok: true };
  }

  async recordFailure(context: LoginThrottleContext): Promise<void> {
    await Promise.all([
      this.ip.recordFailure(context.ipKey),
      this.account.recordFailure(context.accountKey),
    ]);
  }

  /** A successful login clears the account backoff, but never the IP bucket. */
  async clearAccount(accountKey: string): Promise<void> {
    await this.account.reset(accountKey);
  }
}

export function createLoginThrottle(options?: LoginThrottleOptions): LoginThrottle {
  return new LoginThrottle(options);
}

export const loginThrottle = sharedRateLimiter("login-throttle", () => createLoginThrottle());

export function loginContext(request: Request, role: LoginRole, identifier: string): LoginThrottleContext {
  const normalized =
    role === "ADMIN" ? identifier.trim().toLowerCase() : identifier.trim().toUpperCase();
  return {
    ipKey: requestIpKey(request),
    accountKey: `login:${role}:${hashRateLimitKey(normalized)}`,
  };
}

/** Injectable convenience for tests that want a custom store or clock. */
export function createLoginThrottleWithStores(
  ipStore: KeyValueStore<AttemptState>,
  accountStore: KeyValueStore<AttemptState>,
  now: () => number = Date.now,
): LoginThrottle {
  return createLoginThrottle({
    ip: new FailureLimiter(ipStore, IP_OPTIONS, now),
    account: new FailureLimiter(accountStore, ACCOUNT_OPTIONS, now),
    now,
  });
}
