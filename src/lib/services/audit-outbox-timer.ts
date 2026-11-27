import { prisma } from "@/lib/prisma";
import { flushAuditOutbox } from "./audit-outbox";
import { flushInvestmentSideEffects } from "./investment-side-effect-outbox";

const INTERVAL_MS = 60 * 1000;
const START_DELAY_MS = 5_000;

type AuditOutboxTimerGlobal = typeof globalThis & {
  __savelifeAuditOutboxTimer?: NodeJS.Timeout;
  __savelifeAuditOutboxRunning?: boolean;
};

async function runner(): Promise<void> {
  const state = globalThis as AuditOutboxTimerGlobal;
  if (state.__savelifeAuditOutboxRunning) return;

  state.__savelifeAuditOutboxRunning = true;
  try {
    await Promise.all([flushAuditOutbox(prisma), flushInvestmentSideEffects(prisma)]);
  } catch (error) {
    console.error("Outbox flush failed", error);
  } finally {
    state.__savelifeAuditOutboxRunning = false;
  }
}

/** Starts one process-wide timer. Hot reloads reuse the existing timer. */
export function startAuditOutboxTimer(): void {
  const state = globalThis as AuditOutboxTimerGlobal;
  if (state.__savelifeAuditOutboxTimer) return;

  state.__savelifeAuditOutboxTimer = setInterval(() => void runner(), INTERVAL_MS);
  state.__savelifeAuditOutboxTimer.unref?.();

  const initialRun = setTimeout(() => void runner(), START_DELAY_MS);
  initialRun.unref?.();
}
