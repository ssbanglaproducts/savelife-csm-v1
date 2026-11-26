import { runInvestmentAutomation } from "./investment-automation";

const INTERVAL_MS = 5 * 60 * 1000;
const START_DELAY_MS = 5_000;

type AutomationGlobal = typeof globalThis & {
  __savelifeAutomationTimer?: NodeJS.Timeout;
  __savelifeAutomationRunning?: boolean;
};

function runner(): void {
  const state = globalThis as AutomationGlobal;
  if (state.__savelifeAutomationRunning) return;

  state.__savelifeAutomationRunning = true;
  void runInvestmentAutomation()
    .then((result) => {
      if (!result.ok) {
        console.error("Investment automation completed with errors", result);
      }
    })
    .catch((error) => {
      console.error("Investment automation run failed", error);
    })
    .finally(() => {
      state.__savelifeAutomationRunning = false;
    });
}

/** Starts one process-wide timer. Hot reloads reuse the existing timer. */
export function startInvestmentAutomationTimer(): void {
  const state = globalThis as AutomationGlobal;
  if (state.__savelifeAutomationTimer) return;

  state.__savelifeAutomationTimer = setInterval(runner, INTERVAL_MS);
  state.__savelifeAutomationTimer.unref?.();

  const initialRun = setTimeout(runner, START_DELAY_MS);
  initialRun.unref?.();
}
