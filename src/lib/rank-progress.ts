/**
 * Dashboard rank progress is the average of the active qualification paths:
 * the best direct investment and the three team targets. Each path is capped
 * at 100% so one very large investment cannot hide an unmet target.
 */
type RankProgressSource = {
  nextRank: {
    directTargetPaisa: string;
    teamTargetsPaisa: readonly string[];
    teamTotalsPaisa: readonly string[];
  } | null;
  bestDirectPaisa?: string | null;
};

function toPaisa(value: string | null | undefined): bigint {
  try {
    const amount = BigInt(value ?? "0");
    return amount > 0n ? amount : 0n;
  } catch {
    return 0n;
  }
}

function ratio(part: bigint, target: bigint): number {
  if (target <= 0n) return 0;
  const basisPoints = (part * 10_000n) / target;
  return Math.min(100, Math.max(0, Number(basisPoints) / 100));
}

export function rankProgressPercent({ nextRank, bestDirectPaisa }: RankProgressSource): number {
  if (!nextRank) return 100;

  const ratios: number[] = [];
  const directTarget = toPaisa(nextRank.directTargetPaisa);
  if (directTarget > 0n) {
    ratios.push(ratio(toPaisa(bestDirectPaisa), directTarget));
  }

  // Targets are stored highest-to-lowest, so match them to sorted team totals.
  const totals = nextRank.teamTotalsPaisa
    .map(toPaisa)
    .sort((left, right) => (left === right ? 0 : left > right ? -1 : 1));
  nextRank.teamTargetsPaisa.forEach((targetValue, index) => {
    const target = toPaisa(targetValue);
    if (target > 0n) {
      ratios.push(ratio(totals[index] ?? 0n, target));
    }
  });

  if (ratios.length === 0) return 0;
  return Math.round(ratios.reduce((sum, value) => sum + value, 0) / ratios.length);
}
