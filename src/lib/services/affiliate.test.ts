import { describe, expect, it } from "vitest";
import { spToPaisa } from "../money";
import {
  DEFAULT_AFFILIATE_RATES_BPS,
  findSkippedAffiliateLevels,
  getAffiliateRateBps,
  planAffiliateRewards,
  rewardAmountForLevel,
  totalAffiliateRewardPaisa,
} from "./affiliate";

const investment = spToPaisa("100000");

describe("affiliate rates", () => {
  it("uses the locked 300/100/50 bps defaults", () => {
    expect(DEFAULT_AFFILIATE_RATES_BPS).toEqual([300, 100, 50]);
    expect(getAffiliateRateBps(1)).toBe(300);
    expect(getAffiliateRateBps(2)).toBe(100);
    expect(getAffiliateRateBps(3)).toBe(50);
  });

  it("computes per-level reward amounts in paisa", () => {
    expect(rewardAmountForLevel(investment, 1)).toBe(spToPaisa("3000"));
    expect(rewardAmountForLevel(investment, 2)).toBe(spToPaisa("1000"));
    expect(rewardAmountForLevel(investment, 3)).toBe(spToPaisa("500"));
  });

  it("accepts injected rates", () => {
    const config = { ratesBps: [400, 200, 100] };
    expect(planAffiliateRewards(investment, [{ memberId: "a", level: 1 }], config)).toEqual([
      { level: 1, beneficiaryId: "a", rateBps: 400, amountPaisa: spToPaisa("4000") },
    ]);
  });

  it("rejects invalid levels and rate configs", () => {
    expect(() => getAffiliateRateBps(0)).toThrow();
    expect(() => getAffiliateRateBps(4)).toThrow();
    expect(() => getAffiliateRateBps(1, { ratesBps: [300, 100, 50, 25] })).toThrow();
    expect(() => rewardAmountForLevel(-1n, 1)).toThrow();
  });
});

describe("no-backfill planning", () => {
  it("never promotes an upline into a missing level", () => {
    const rewards = planAffiliateRewards(investment, [
      { memberId: "l2", level: 2 },
      { memberId: "l3", level: 3 },
    ]);

    expect(rewards).toEqual([
      { level: 2, beneficiaryId: "l2", rateBps: 100, amountPaisa: spToPaisa("1000") },
      { level: 3, beneficiaryId: "l3", rateBps: 50, amountPaisa: spToPaisa("500") },
    ]);
    expect(findSkippedAffiliateLevels([{ memberId: "l2", level: 2 }, { memberId: "l3", level: 3 }])).toEqual([1]);
    expect(totalAffiliateRewardPaisa(rewards)).toBe(spToPaisa("1500"));
  });

  it("keeps a skipped middle level skipped even when levels 1 and 3 exist", () => {
    const uplines = [
      { memberId: "l3", level: 3 },
      { memberId: "l1", level: 1 },
    ];
    const rewards = planAffiliateRewards(investment, uplines);

    expect(rewards.map((reward) => reward.level)).toEqual([1, 3]);
    expect(rewards.map((reward) => reward.rateBps)).toEqual([300, 50]);
    expect(findSkippedAffiliateLevels(uplines)).toEqual([2]);
  });

  it("returns no rewards and all levels skipped for an empty upline chain", () => {
    expect(planAffiliateRewards(investment, [])).toEqual([]);
    expect(findSkippedAffiliateLevels([])).toEqual([1, 2, 3]);
  });

  it("uses the first candidate when a level is duplicated", () => {
    const rewards = planAffiliateRewards(investment, [
      { memberId: "first", level: 1 },
      { memberId: "second", level: 1 },
    ]);
    expect(rewards).toHaveLength(1);
    expect(rewards[0]?.beneficiaryId).toBe("first");
  });

  it("pays only the sponsor chain and never the placement parent", () => {
    // C is the direct sponsor; B and A are C's sponsor ancestors. F is only the
    // placement parent and is intentionally absent from the Upline input.
    const sponsorUplines = [
      { memberId: "c", level: 1 },
      { memberId: "b", level: 2 },
      { memberId: "a", level: 3 },
    ];
    const placementParentId = "f";

    const rewards = planAffiliateRewards(investment, sponsorUplines);

    expect(rewards.map((reward) => reward.beneficiaryId)).toEqual(["c", "b", "a"]);
    expect(rewards.map((reward) => reward.rateBps)).toEqual([300, 100, 50]);
    expect(rewards.some((reward) => reward.beneficiaryId === placementParentId)).toBe(false);
  });
});
