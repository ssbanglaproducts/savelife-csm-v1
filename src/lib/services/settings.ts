import type { PrismaClient } from "../../generated/prisma/client";
import type { Paisa } from "../money";
import {
  DEFAULT_AFFILIATE_RATES_BPS,
  normalizeAffiliateRatesBps,
  type AffiliateRateConfig,
} from "./affiliate";
import type { WithdrawalFeeConfig } from "./withdrawal";

/** SystemSetting key for an override array such as [300, 100, 50]. */
export const AFFILIATE_RATES_SETTING_KEY = "affiliate.rewardRatesBps";

export const DEFAULT_WITHDRAWAL_FEE_BPS = 1000;
export const DEFAULT_MIN_WITHDRAWAL_PAISA: Paisa = 50_000n;

export interface FinancialSettings {
  readonly affiliateRates: AffiliateRateConfig;
  readonly withdrawal: WithdrawalFeeConfig;
}

export function parseAffiliateRatesSetting(value: unknown): readonly number[] | null {
  if (!Array.isArray(value) || !value.every((item) => typeof item === "number")) return null;
  try {
    return normalizeAffiliateRatesBps(value as number[]);
  } catch {
    return null;
  }
}

export function parseIntegerSetting(value: unknown): number | null {
  if (typeof value === "number" && Number.isInteger(value)) return value;
  if (typeof value === "string" && /^\d+$/.test(value.trim())) return Number(value.trim());
  return null;
}

export function parsePaisaSetting(value: unknown): Paisa | null {
  if (typeof value === "bigint") return value;
  const parsed = parseIntegerSetting(value);
  return parsed === null ? null : BigInt(parsed);
}

/**
 * Fee/minimum come from the active versioned InvestmentSettings; affiliate
 * rates come from SystemSetting with the locked 300/100/50 bps fallback.
 */
export async function loadFinancialSettings(client: PrismaClient): Promise<FinancialSettings> {
  const [rateSetting, investmentSettings] = await Promise.all([
    client.systemSetting.findUnique({ where: { key: AFFILIATE_RATES_SETTING_KEY } }),
    client.investmentSettings.findFirst({
      where: { isActive: true },
      orderBy: { version: "desc" },
    }),
  ]);

  const rates = rateSetting ? parseAffiliateRatesSetting(rateSetting.value) : null;
  const feeBps = investmentSettings
    ? parseIntegerSetting(investmentSettings.withdrawalFeeBps)
    : null;
  const minPaisa = investmentSettings
    ? parsePaisaSetting(investmentSettings.minWithdrawalPaisa)
    : null;

  return {
    affiliateRates: {
      ratesBps: rates ?? DEFAULT_AFFILIATE_RATES_BPS,
    },
    withdrawal: {
      feeBps: feeBps ?? DEFAULT_WITHDRAWAL_FEE_BPS,
      minWithdrawalPaisa: minPaisa ?? DEFAULT_MIN_WITHDRAWAL_PAISA,
    },
  };
}

export async function loadAffiliateRateConfig(
  client: PrismaClient,
): Promise<AffiliateRateConfig> {
  return (await loadFinancialSettings(client)).affiliateRates;
}

export async function loadWithdrawalFeeConfig(
  client: PrismaClient,
): Promise<WithdrawalFeeConfig> {
  return (await loadFinancialSettings(client)).withdrawal;
}
