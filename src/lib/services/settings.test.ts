import { describe, expect, it } from "vitest";
import {
  AFFILIATE_RATES_SETTING_KEY,
  DEFAULT_MIN_WITHDRAWAL_PAISA,
  DEFAULT_WITHDRAWAL_FEE_BPS,
  parseAffiliateRatesSetting,
  parseIntegerSetting,
  parsePaisaSetting,
} from "./settings";

describe("setting parsers", () => {
  it("exposes documented keys and defaults", () => {
    expect(AFFILIATE_RATES_SETTING_KEY).toBe("affiliate.rewardRatesBps");
    expect(DEFAULT_WITHDRAWAL_FEE_BPS).toBe(1000);
    expect(DEFAULT_MIN_WITHDRAWAL_PAISA).toBe(50_000n);
  });

  it("accepts a valid affiliate rate override array", () => {
    expect(parseAffiliateRatesSetting([400, 200, 100])).toEqual([400, 200, 100]);
  });

  it("rejects malformed affiliate rate overrides so defaults are used", () => {
    expect(parseAffiliateRatesSetting([300, "100", 50])).toBeNull();
    expect(parseAffiliateRatesSetting([300, -1, 50])).toBeNull();
    expect(parseAffiliateRatesSetting("300,100,50")).toBeNull();
  });

  it("parses integer and paisa settings", () => {
    expect(parseIntegerSetting(1200)).toBe(1200);
    expect(parseIntegerSetting("1200")).toBe(1200);
    expect(parseIntegerSetting("12.5")).toBeNull();
    expect(parsePaisaSetting(50_000n)).toBe(50_000n);
    expect(parsePaisaSetting("50000")).toBe(50_000n);
    expect(parsePaisaSetting(null)).toBeNull();
  });
});
