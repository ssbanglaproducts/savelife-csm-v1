import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import {
  FailureLimiter,
  InMemoryKeyValueStore,
  sharedRateLimiter,
  type AttemptState,
  type FailureLimiterOptions,
  type KeyValueStore,
} from "@/lib/rate-limit";

const MAX_FAILURES = 5;
const LOCKOUT_MS = 30_000;
const STATE_TTL_MS = 10 * 60_000;
const MAX_TRACKED_ADMINS = 1_000;

const LIMITER_OPTIONS: FailureLimiterOptions = {
  maxFailures: MAX_FAILURES,
  lockoutMs: LOCKOUT_MS,
  maxLockoutMs: LOCKOUT_MS,
  stateTtlMs: STATE_TTL_MS,
  maxTrackedKeys: MAX_TRACKED_ADMINS,
  resetAfterLockout: true,
};

export type AdminPasswordLimiter = Pick<FailureLimiter, "check" | "recordFailure" | "reset">;

export function createAdminPasswordLimiter(
  store: KeyValueStore<AttemptState> = new InMemoryKeyValueStore<AttemptState>(MAX_TRACKED_ADMINS),
  now: () => number = Date.now,
): AdminPasswordLimiter {
  return new FailureLimiter(store, LIMITER_OPTIONS, now);
}

type VerifyDeps = {
  limiter: AdminPasswordLimiter;
  findPasswordHash: (memberId: string) => Promise<string | null | undefined>;
  comparePassword: (password: string, hash: string) => Promise<boolean>;
  onEvent: (event: "LOCKED" | "FAILED", details: { adminId: string; failures?: number }) => void;
};

/**
 * Re-authorizes a sensitive admin mutation with the current account password.
 * Callers must already have verified the session is an ADMIN and must pass the
 * session's member id — never a client-supplied identity.
 *
 * Dependencies are injectable so the process-local limiter can later be backed
 * by Redis (or asserted in tests) without changing the exported API.
 */
export function createAdminPasswordVerifier(deps: VerifyDeps) {
  return async function verifyAdminPassword(
    memberId: string,
    password: string,
  ): Promise<boolean> {
    if (!memberId || !password) return false;

    const check = await deps.limiter.check(memberId);
    if (check.blocked) {
      deps.onEvent("LOCKED", { adminId: memberId });
      return false;
    }

    const hash = await deps.findPasswordHash(memberId);
    const valid = Boolean(hash && (await deps.comparePassword(password, hash)));

    if (valid) {
      await deps.limiter.reset(memberId);
      return true;
    }

    const { failures } = await deps.limiter.recordFailure(memberId);
    deps.onEvent("FAILED", { adminId: memberId, failures });
    return false;
  };
}

const adminPasswordLimiter = sharedRateLimiter("admin-password-limiter", () =>
  createAdminPasswordLimiter(),
);

export const verifyAdminPassword = createAdminPasswordVerifier({
  limiter: adminPasswordLimiter,
  findPasswordHash: async (memberId) => {
    const admin = await prisma.member.findUnique({
      where: { id: memberId },
      select: { passwordHash: true },
    });
    return admin?.passwordHash;
  },
  comparePassword: (password, hash) => bcrypt.compare(password, hash),
  onEvent: (event, details) => {
    if (event === "LOCKED") {
      console.warn("Admin password verification blocked by lockout", details);
    } else {
      console.warn("Admin password verification failed", {
        ...details,
        locked: Boolean(details.failures && details.failures >= MAX_FAILURES),
      });
    }
  },
});
