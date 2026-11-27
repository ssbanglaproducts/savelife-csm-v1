import { createHash } from "node:crypto";

/**
 * Small injectable state store shared by the login, admin re-auth and public
 * upload limiters. The default implementation is process-local; a Redis-backed
 * store can be supplied later without changing the call sites.
 */
export interface KeyValueStore<T> {
  read(key: string): Promise<T | undefined> | T | undefined;
  write(key: string, value: T): Promise<void> | void;
  remove(key: string): Promise<void> | void;
  prune?(cutoffAt: number): Promise<void> | void;
}

export class InMemoryKeyValueStore<T> implements KeyValueStore<T> {
  private readonly entries = new Map<string, T>();

  constructor(private readonly maxKeys = 10_000) {}

  read(key: string): T | undefined {
    return this.entries.get(key);
  }

  write(key: string, value: T): void {
    this.entries.set(key, value);
    if (this.entries.size > this.maxKeys) {
      // Callers pass a timestamp cutoff through prune(); an oversized store
      // without a pruner simply keeps the newest maxKeys entries by dropping
      // the oldest insertion first.
      const oldest = this.entries.keys().next().value;
      if (oldest !== undefined) this.entries.delete(oldest);
    }
  }

  remove(key: string): void {
    this.entries.delete(key);
  }

  prune(cutoffAt: number): void {
    for (const [key, value] of this.entries) {
      const updatedAt = (value as { updatedAt?: unknown })?.updatedAt;
      if (typeof updatedAt === "number" && updatedAt < cutoffAt) this.entries.delete(key);
    }
  }
}

export type AttemptState = {
  failures: number;
  lockedUntil: number;
  updatedAt: number;
};

export type FailureLimiterOptions = {
  maxFailures: number;
  lockoutMs: number;
  maxLockoutMs?: number;
  stateTtlMs: number;
  maxTrackedKeys?: number;
  /** Admin re-auth resets after a lockout; login keeps escalating backoff. */
  resetAfterLockout?: boolean;
};

export type FailureCheck = {
  blocked: boolean;
  retryAfterMs: number;
  failures: number;
};

/** Failure counter with optional exponential backoff and time-based reset. */
export class FailureLimiter {
  private readonly store: KeyValueStore<AttemptState>;
  private readonly options: FailureLimiterOptions;
  private readonly now: () => number;

  constructor(
    store: KeyValueStore<AttemptState>,
    options: FailureLimiterOptions,
    now: () => number = Date.now,
  ) {
    this.store = store;
    this.options = options;
    this.now = now;
  }

  private isStale(state: AttemptState, now: number): boolean {
    return state.updatedAt + this.options.stateTtlMs < now;
  }

  async check(key: string): Promise<FailureCheck> {
    const now = this.now();
    const state = await this.store.read(key);
    if (!state) return { blocked: false, retryAfterMs: 0, failures: 0 };

    if (
      this.isStale(state, now) ||
      (this.options.resetAfterLockout !== false && state.lockedUntil > 0 && state.lockedUntil <= now)
    ) {
      await this.store.remove(key);
      return { blocked: false, retryAfterMs: 0, failures: 0 };
    }

    if (state.lockedUntil > now) {
      return {
        blocked: true,
        retryAfterMs: state.lockedUntil - now,
        failures: state.failures,
      };
    }
    return { blocked: false, retryAfterMs: 0, failures: state.failures };
  }

  async recordFailure(key: string): Promise<{ failures: number; lockedUntil: number }> {
    const now = this.now();
    const previous = await this.store.read(key);
    const state = previous && !this.isStale(previous, now) ? previous : undefined;
    const failures = (state?.failures ?? 0) + 1;
    const step = Math.max(0, failures - this.options.maxFailures);
    const maxLockoutMs = this.options.maxLockoutMs ?? this.options.lockoutMs;
    const lockedUntil =
      failures >= this.options.maxFailures
        ? now + Math.min(maxLockoutMs, this.options.lockoutMs * 2 ** step)
        : 0;

    await this.store.write(key, { failures, lockedUntil, updatedAt: now });
    await this.store.prune?.(now - this.options.stateTtlMs);
    return { failures, lockedUntil };
  }

  async reset(key: string): Promise<void> {
    await this.store.remove(key);
  }
}

export type WindowState = {
  count: number;
  windowStart: number;
  updatedAt: number;
};

export type WindowCheck = {
  allowed: boolean;
  remaining: number;
  retryAfterMs: number;
};

/** Fixed-window request counter used by unauthenticated endpoints. */
export class FixedWindowLimiter {
  private readonly store: KeyValueStore<WindowState>;
  private readonly windowMs: number;
  private readonly limit: number;
  private readonly maxTrackedKeys: number;
  private readonly now: () => number;

  constructor(
    store: KeyValueStore<WindowState>,
    options: { limit: number; windowMs: number; maxTrackedKeys?: number },
    now: () => number = Date.now,
  ) {
    this.store = store;
    this.limit = options.limit;
    this.windowMs = options.windowMs;
    this.maxTrackedKeys = options.maxTrackedKeys ?? 5_000;
    this.now = now;
  }

  async consume(key: string): Promise<WindowCheck> {
    const now = this.now();
    const previous = await this.store.read(key);
    const windowStart = previous && now - previous.windowStart < this.windowMs ? previous.windowStart : now;
    const count = previous && windowStart === previous.windowStart ? previous.count + 1 : 1;
    const allowed = count <= this.limit;
    await this.store.write(key, {
      count: allowed ? count : this.limit + 1,
      windowStart,
      updatedAt: now,
    });
    await this.store.prune?.(now - this.windowMs);
    return {
      allowed,
      remaining: Math.max(0, this.limit - count),
      retryAfterMs: allowed ? 0 : Math.max(1, windowStart + this.windowMs - now),
    };
  }
}

/** Hashed, non-reversible key material for in-memory counters and log lines. */
export function hashRateLimitKey(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 32);
}

type GlobalWithLimiters = typeof globalThis & {
  __savelifeRateLimiters?: Map<string, unknown>;
};

/** Keep default limiters stable across dev hot reloads and module copies. */
export function sharedRateLimiter<T>(name: string, factory: () => T): T {
  const globalRef = globalThis as GlobalWithLimiters;
  const registry = (globalRef.__savelifeRateLimiters ??= new Map<string, unknown>());
  if (!registry.has(name)) registry.set(name, factory());
  return registry.get(name) as T;
}

function firstHeader(headers: Headers, names: readonly string[]): string | null {
  for (const name of names) {
    const raw = headers.get(name);
    const candidate = raw?.split(",")[0]?.trim();
    if (candidate) return candidate;
  }
  return null;
}

/** Client identity from proxy-supplied headers, hashed before storage. */
export function requestIpKey(request: Request): string {
  const value = firstHeader(request.headers, [
    "cf-connecting-ip",
    "x-real-ip",
    "x-forwarded-for",
  ]);
  return hashRateLimitKey(value ?? "unknown");
}
