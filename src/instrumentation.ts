export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { startInvestmentAutomationTimer } = await import(
    "@/lib/services/investment-automation-timer"
  );
  startInvestmentAutomationTimer();

  const { startSalaryAutomationTimer } = await import(
    "@/lib/services/salary-automation-timer"
  );
  startSalaryAutomationTimer();
}
