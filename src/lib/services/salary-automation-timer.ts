import { runSalaryAutomation } from "./salary-automation";

const INTERVAL_MS = 5 * 60 * 1000;
const START_DELAY_MS = 10_000;

type SalaryTimerGlobal = typeof globalThis & {
  __savelifeSalaryTimer?: NodeJS.Timeout;
  __savelifeSalaryRunning?: boolean;
};

async function runner(): Promise<void> {
  const state = globalThis as SalaryTimerGlobal;
  if (state.__savelifeSalaryRunning) return;

  state.__savelifeSalaryRunning = true;
  try {
    const result = await runSalaryAutomation();
    if (!result.ok) {
      console.error("Salary automation completed with errors", result);
    }
  } catch (error) {
    console.error("Salary automation run failed", error);
  } finally {
    state.__savelifeSalaryRunning = false;
  }
}

/** Starts one process-wide timer. Hot reloads reuse the existing timer. */
export function startSalaryAutomationTimer(): void {
  const state = globalThis as SalaryTimerGlobal;
  if (state.__savelifeSalaryTimer) return;

  state.__savelifeSalaryTimer = setInterval(() => void runner(), INTERVAL_MS);
  state.__savelifeSalaryTimer.unref?.();

  const initialRun = setTimeout(() => void runner(), START_DELAY_MS);
  initialRun.unref?.();
}
