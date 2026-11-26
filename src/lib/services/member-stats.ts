import type { Paisa } from "../money";

export const MEMBER_LEVELS = [1, 2, 3] as const;
export type MemberLevel = (typeof MEMBER_LEVELS)[number];

export interface UplineStatRow {
  readonly uplineId: string;
  readonly level: number;
  readonly investedPaisa: Paisa;
}

export interface RewardStatRow {
  readonly beneficiaryId: string;
  readonly level: number;
  readonly amountPaisa: Paisa;
}

export interface LevelStat {
  readonly level: MemberLevel;
  readonly count: number;
  readonly investedPaisa: Paisa;
  readonly rewardPaisa: Paisa;
}

export interface MemberLevelStats {
  readonly levels: readonly [LevelStat, LevelStat, LevelStat];
  readonly teamSize: number;
}

/**
 * Rolls a member's three-level downline into display stats. `investedPaisa`
 * is the total principal invested by downline members; `rewardPaisa` is the
 * affiliate reward the member actually earned at that level.
 */
export function buildMemberLevelStats(
  memberId: string,
  uplines: readonly UplineStatRow[],
  rewards: readonly RewardStatRow[],
): MemberLevelStats {
  const stats: { level: MemberLevel; count: number; investedPaisa: Paisa; rewardPaisa: Paisa }[] =
    MEMBER_LEVELS.map((level) => ({ level, count: 0, investedPaisa: 0n, rewardPaisa: 0n }));

  for (const row of uplines) {
    if (row.uplineId !== memberId) continue;
    const stat = stats[row.level - 1];
    if (!stat) continue;
    stat.count += 1;
    stat.investedPaisa += row.investedPaisa;
  }

  for (const row of rewards) {
    if (row.beneficiaryId !== memberId) continue;
    const stat = stats[row.level - 1];
    if (!stat) continue;
    stat.rewardPaisa += row.amountPaisa;
  }

  return {
    levels: [stats[0]!, stats[1]!, stats[2]!],
    teamSize: stats.reduce((total, stat) => total + stat.count, 0),
  };
}
