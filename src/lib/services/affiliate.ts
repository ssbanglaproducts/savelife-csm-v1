import { applyBps, sumPaisa, type Paisa } from "../money";
import { invalidInput } from "./errors";

/** Locked defaults: 3%, 1%, 0.5% for levels 1, 2 and 3. */
export const DEFAULT_AFFILIATE_RATES_BPS: readonly [number, number, number] = [300, 100, 50];

export interface AffiliateRateConfig {
  readonly ratesBps: readonly number[];
}

export const DEFAULT_AFFILIATE_RATE_CONFIG: AffiliateRateConfig = {
  ratesBps: DEFAULT_AFFILIATE_RATES_BPS,
};

/** A row from the materialised Upline table, which mirrors the sponsor chain only. */
export interface AffiliateUplineCandidate {
  readonly memberId: string;
  readonly level: number;
}

export interface AffiliateRewardCalculation {
  readonly level: number;
  readonly beneficiaryId: string;
  readonly rateBps: number;
  readonly amountPaisa: Paisa;
}

export function normalizeAffiliateRatesBps(ratesBps: readonly number[]): readonly number[] {
  if (ratesBps.length < 1 || ratesBps.length > 3) {
    throw invalidInput("Exactly one to three affiliate reward rates are supported");
  }
  for (const rate of ratesBps) {
    if (!Number.isInteger(rate) || rate < 0 || rate > 10_000) {
      throw invalidInput(`Invalid affiliate reward rate in basis points: ${rate}`);
    }
  }
  return ratesBps;
}

export function getAffiliateRateBps(
  level: number,
  config: AffiliateRateConfig = DEFAULT_AFFILIATE_RATE_CONFIG,
): number {
  const rates = normalizeAffiliateRatesBps(config.ratesBps);
  if (!Number.isInteger(level) || level < 1 || level > rates.length) {
    throw invalidInput(`Invalid affiliate level: ${level}`);
  }
  return rates[level - 1] ?? 0;
}

export function rewardAmountForLevel(
  amountPaisa: Paisa,
  level: number,
  config: AffiliateRateConfig = DEFAULT_AFFILIATE_RATE_CONFIG,
): Paisa {
  if (amountPaisa < 0n) throw invalidInput("Investment amount cannot be negative");
  return applyBps(amountPaisa, getAffiliateRateBps(level, config));
}

/**
 * Plans rewards using the materialised level of each upline. A missing level is
 * skipped permanently: no other upline is promoted into the gap and no rate is
 * substituted, so skipped rewards are never backfilled.
 */
export function planAffiliateRewards(
  investmentAmountPaisa: Paisa,
  uplines: readonly AffiliateUplineCandidate[],
  config: AffiliateRateConfig = DEFAULT_AFFILIATE_RATE_CONFIG,
): readonly AffiliateRewardCalculation[] {
  if (investmentAmountPaisa < 0n) throw invalidInput("Investment amount cannot be negative");

  const rates = normalizeAffiliateRatesBps(config.ratesBps);
  const rewards: AffiliateRewardCalculation[] = [];

  for (let level = 1; level <= rates.length; level += 1) {
    const candidate = uplines.find((upline) => upline.level === level);
    if (!candidate) continue;

    const rateBps = rates[level - 1] ?? 0;
    rewards.push({
      level,
      beneficiaryId: candidate.memberId,
      rateBps,
      amountPaisa: applyBps(investmentAmountPaisa, rateBps),
    });
  }

  return rewards;
}

/** Levels with no upline at plan time. They stay skipped; nothing is promoted. */
export function findSkippedAffiliateLevels(
  uplines: readonly AffiliateUplineCandidate[],
  config: AffiliateRateConfig = DEFAULT_AFFILIATE_RATE_CONFIG,
): readonly number[] {
  const rates = normalizeAffiliateRatesBps(config.ratesBps);
  const skipped: number[] = [];
  for (let level = 1; level <= rates.length; level += 1) {
    if (!uplines.some((upline) => upline.level === level)) skipped.push(level);
  }
  return skipped;
}

export function totalAffiliateRewardPaisa(
  rewards: readonly AffiliateRewardCalculation[],
): Paisa {
  return sumPaisa(rewards.map((reward) => reward.amountPaisa));
}
