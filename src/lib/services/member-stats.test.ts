import { describe, expect, it } from "vitest";
import { buildMemberLevelStats, type RewardStatRow, type UplineStatRow } from "./member-stats";

const uplines: UplineStatRow[] = [
  { uplineId: "a", level: 1, investedPaisa: 100_000n },
  { uplineId: "a", level: 1, investedPaisa: 50_000n },
  { uplineId: "a", level: 2, investedPaisa: 200_000n },
  { uplineId: "a", level: 3, investedPaisa: 30_000n },
  { uplineId: "b", level: 1, investedPaisa: 999_999n },
  { uplineId: "a", level: 4, investedPaisa: 999_999n },
];

const rewards: RewardStatRow[] = [
  { beneficiaryId: "a", level: 1, amountPaisa: 3_000n },
  { beneficiaryId: "a", level: 2, amountPaisa: 1_000n },
  { beneficiaryId: "a", level: 3, amountPaisa: 500n },
  { beneficiaryId: "b", level: 1, amountPaisa: 999_999n },
  { beneficiaryId: "a", level: 4, amountPaisa: 999_999n },
];

describe("buildMemberLevelStats", () => {
  it("counts, sums and labels each level", () => {
    const stats = buildMemberLevelStats("a", uplines, rewards);

    expect(stats.levels).toEqual([
      { level: 1, count: 2, investedPaisa: 150_000n, rewardPaisa: 3_000n },
      { level: 2, count: 1, investedPaisa: 200_000n, rewardPaisa: 1_000n },
      { level: 3, count: 1, investedPaisa: 30_000n, rewardPaisa: 500n },
    ]);
    expect(stats.teamSize).toBe(4);
  });

  it("returns zeroes for a member with no downline", () => {
    const stats = buildMemberLevelStats("c", uplines, rewards);
    expect(stats.teamSize).toBe(0);
    expect(stats.levels.every((level) => level.count === 0 && level.rewardPaisa === 0n)).toBe(true);
  });
});
