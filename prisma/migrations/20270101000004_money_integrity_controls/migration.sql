-- Money/API integrity controls: top-up reference dedupe, ROI rate CAS and
-- defense-in-depth negative-balance prevention.

-- AlterTable
ALTER TABLE "SystemSetting" ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE UNIQUE INDEX "WalletTopUp_memberId_method_transactionRef_key" ON "WalletTopUp"("memberId", "method", "transactionRef");

-- Prisma schema doesn't model CHECK constraints. NOT VALID keeps the migration
-- deployable even if legacy rows are already negative, while still rejecting
-- every new or updated wallet row that would go below zero.
ALTER TABLE "Wallet"
ADD CONSTRAINT "Wallet_bucket_balances_nonnegative"
CHECK (
  "availablePaisa" >= 0
  AND "pendingPaisa" >= 0
  AND "investmentPaisa" >= 0
  AND "profitPaisa" >= 0
  AND "affiliatePaisa" >= 0
  AND "rankRewardPaisa" >= 0
  AND "salaryPaisa" >= 0
  AND "roiPaisa" >= 0
) NOT VALID;
