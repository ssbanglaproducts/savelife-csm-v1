/**
 * Plan rates are stored in basis points (1 bps = 0.01%) so the database and
 * money math stay integer-only. Admin-facing forms and tables use percentages,
 * which is how the plan terms are communicated to members.
 */
export const BPS_PER_PERCENT = 100;

export function bpsToPercent(bps: number): number {
  return bps / BPS_PER_PERCENT;
}

export function percentToBps(percent: number): number {
  return Math.round(percent * BPS_PER_PERCENT);
}

/** Formats basis points as a percentage: 20000 -> "200%", 1050 -> "10.5%". */
export function formatPercent(bps: number): string {
  const value = bpsToPercent(bps);
  if (Number.isInteger(value)) return `${value}%`;
  return `${value.toFixed(2).replace(/\.?0+$/, "")}%`;
}
