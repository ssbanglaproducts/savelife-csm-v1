-- AlterEnum
ALTER TYPE "WalletCategory" ADD VALUE 'RANK_REWARD';

-- AlterEnum
ALTER TYPE "LedgerEntryType" ADD VALUE 'RANK_REWARD_CREDIT';

-- AlterEnum
ALTER TYPE "LedgerEntryType" ADD VALUE 'RANK_REWARD_RECLASSIFY';

-- AlterTable
ALTER TABLE "Wallet" ADD COLUMN "rankRewardPaisa" BIGINT NOT NULL DEFAULT 0;
