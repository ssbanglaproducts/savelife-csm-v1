import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

const MAX_FAILURES = 5;
const LOCKOUT_MS = 30_000;
const STATE_TTL_MS = 10 * 60_000;
const MAX_TRACKED_ADMINS = 1_000;

type AttemptState = {
  failures: number;
  lockedUntil: number;
  updatedAt: number;
};

// Process-local throttle. `memberId` always comes from the authenticated
// session at the call site; a request body can never select another identity.
const attempts = new Map<string, AttemptState>();

function readState(memberId: string, now: number): AttemptState | undefined {
  const state = attempts.get(memberId);
  if (!state) return undefined;
  if (state.updatedAt + STATE_TTL_MS < now || (state.lockedUntil && state.lockedUntil <= now)) {
    attempts.delete(memberId);
    return undefined;
  }
  return state;
}

function pruneExpired(now: number): void {
  for (const [id, state] of attempts) {
    if (state.updatedAt + STATE_TTL_MS < now) attempts.delete(id);
  }
}

/**
 * Re-authorizes a sensitive admin mutation with the current account password.
 * Callers must already have verified the session is an ADMIN and must pass the
 * session's member id — never a client-supplied identity.
 */
export async function verifyAdminPassword(
  memberId: string,
  password: string,
): Promise<boolean> {
  if (!memberId || !password) return false;

  const now = Date.now();
  const state = readState(memberId, now);
  if (state && state.lockedUntil > now) {
    console.warn("Admin password verification blocked by lockout", { adminId: memberId });
    return false;
  }

  const admin = await prisma.member.findUnique({
    where: { id: memberId },
    select: { passwordHash: true },
  });
  const valid = Boolean(admin && (await bcrypt.compare(password, admin.passwordHash)));

  if (valid) {
    attempts.delete(memberId);
    return true;
  }

  const failures = (state?.failures ?? 0) + 1;
  attempts.set(memberId, {
    failures,
    lockedUntil: failures >= MAX_FAILURES ? now + LOCKOUT_MS : 0,
    updatedAt: now,
  });
  if (attempts.size > MAX_TRACKED_ADMINS) pruneExpired(now);
  console.warn("Admin password verification failed", {
    adminId: memberId,
    failures,
    locked: failures >= MAX_FAILURES,
  });

  return false;
}
