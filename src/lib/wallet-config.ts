/**
 * Single source of truth for collectible reward wallets.
 *
 * Adding a future reward program should only require:
 * 1. a new Wallet field and WalletCategory/LedgerEntryType value in Prisma, and
 * 2. one entry in this list plus its EN/BN labels.
 *
 * The wallet page and Collect All API both read this list, so the UI never has
 * to be redesigned for another reward category.
 */
export const REWARD_WALLETS = [
  {
    field: "profitPaisa",
    category: "PROFIT",
    labelKey: "profit",
    icon: "gift",
    tone: "gold",
  },
  {
    field: "affiliatePaisa",
    category: "AFFILIATE",
    labelKey: "affiliate",
    icon: "users",
    tone: "violet",
  },
  {
    field: "rankRewardPaisa",
    category: "RANK_REWARD",
    labelKey: "rankReward",
    icon: "trophy",
    tone: "emerald",
  },
  {
    field: "salaryPaisa",
    category: "SALARY",
    labelKey: "salary",
    icon: "calendar",
    tone: "sky",
  },
  {
    field: "roiPaisa",
    category: "ROI_COMMISSION",
    labelKey: "roiCommission",
    icon: "trending",
    tone: "rose",
  },
] as const;

export type RewardWalletDefinition = (typeof REWARD_WALLETS)[number];
export type RewardWalletField = RewardWalletDefinition["field"];

export type RewardWalletBalances = Record<RewardWalletField, bigint>;

export function sumRewardWallets(wallet: RewardWalletBalances): bigint {
  return REWARD_WALLETS.reduce<bigint>(
    (total, walletDefinition) => total + wallet[walletDefinition.field],
    0n,
  );
}
