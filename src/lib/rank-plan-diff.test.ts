import { describe, expect, it } from "vitest";
import { buildRankPlanDiff, rankPlanSettingMessageKey } from "./rank-plan-diff";
import type { RankPlanDefinitionDto } from "./rank-plan-dto";

function row(overrides: Partial<RankPlanDefinitionDto> = {}): RankPlanDefinitionDto {
  return {
    id: "definition:R1",
    rankKey: "R1",
    sortOrder: 1,
    name: "1 Star",
    nameBn: "১ স্টার",
    directTarget: "500000",
    team1Target: "200000",
    team2Target: "200000",
    team3Target: "100000",
    rewardType: "SP",
    rewardSp: "10000",
    rewardLabel: null,
    rewardLabelBn: null,
    rewardDescription: null,
    rewardDescriptionBn: null,
    badgeImageUrl: "/images/ranks/r1.png",
    rewardImageUrl: null,
    ...overrides,
  };
}

describe("buildRankPlanDiff", () => {
  it("returns only changed values in stable rank order", () => {
    const before = [row(), row({ id: "definition:R2", rankKey: "R2", sortOrder: 2, name: "2 Star" })];
    const after = [
      row({ name: "1 Star Elite" }),
      row({ id: "definition:R2", rankKey: "R2", sortOrder: 2, name: "2 Star" }),
    ];

    expect(buildRankPlanDiff(before, after)).toEqual([
      expect.objectContaining({
        id: "R1:name",
        rankKey: "R1",
        settingKey: "name",
        previous: "1 Star",
        next: "1 Star Elite",
      }),
    ]);
  });

  it("tracks physical reward description changes", () => {
    const before = [row({ rewardType: "PHYSICAL", rewardLabel: "Motorcycle", rewardSp: "" })];
    const after = [
      row({
        rewardType: "PHYSICAL",
        rewardLabel: "Motorcycle",
        rewardSp: "",
        rewardDescription: "New motorcycle",
      }),
    ];

    expect(buildRankPlanDiff(before, after)).toEqual([
      expect.objectContaining({
        settingKey: "rewardDescription",
        previous: null,
        next: "New motorcycle",
      }),
    ]);
  });

  it("maps settings to translation keys", () => {
    expect(rankPlanSettingMessageKey("badgeImageUrl")).toBe("rankConfigSettingBadgeImageUrl");
    expect(rankPlanSettingMessageKey("rewardDescriptionBn")).toBe("rankConfigSettingRewardDescriptionBn");
  });
});
