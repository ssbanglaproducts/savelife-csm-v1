-- AlterEnum
ALTER TYPE "WalletCategory" ADD VALUE 'ROI_COMMISSION';

-- AlterEnum
ALTER TYPE "LedgerEntryType" ADD VALUE 'ROI_COMMISSION_CREDIT';

-- AlterTable
ALTER TABLE "Wallet" ADD COLUMN "roiPaisa" BIGINT NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "RoiCommissionDistribution" (
    "id" TEXT NOT NULL,
    "distributionId" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "ratesBps" JSONB NOT NULL,
    "totalBasisPaisa" BIGINT NOT NULL,
    "totalCommissionPaisa" BIGINT NOT NULL,
    "recipientCount" INTEGER NOT NULL,
    "postedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RoiCommissionDistribution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoiCommissionLine" (
    "id" TEXT NOT NULL,
    "distributionId" TEXT NOT NULL,
    "sourceMemberId" TEXT NOT NULL,
    "sourceInvestmentId" TEXT NOT NULL,
    "beneficiaryId" TEXT NOT NULL,
    "level" INTEGER NOT NULL,
    "rateBps" INTEGER NOT NULL,
    "basisPaisa" BIGINT NOT NULL,
    "amountPaisa" BIGINT NOT NULL,
    "ledgerEntryId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RoiCommissionLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RoiCommissionDistribution_distributionId_key" ON "RoiCommissionDistribution"("distributionId");

-- CreateIndex
CREATE INDEX "RoiCommissionDistribution_month_postedAt_idx" ON "RoiCommissionDistribution"("month", "postedAt");

-- CreateIndex
CREATE UNIQUE INDEX "RoiCommissionLine_distributionId_sourceInvestmentId_level_key" ON "RoiCommissionLine"("distributionId", "sourceInvestmentId", "level");

-- CreateIndex
CREATE INDEX "RoiCommissionLine_beneficiaryId_createdAt_idx" ON "RoiCommissionLine"("beneficiaryId", "createdAt");

-- CreateIndex
CREATE INDEX "RoiCommissionLine_sourceMemberId_createdAt_idx" ON "RoiCommissionLine"("sourceMemberId", "createdAt");

-- AddForeignKey
ALTER TABLE "RoiCommissionDistribution" ADD CONSTRAINT "RoiCommissionDistribution_distributionId_fkey" FOREIGN KEY ("distributionId") REFERENCES "ProfitDistribution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoiCommissionLine" ADD CONSTRAINT "RoiCommissionLine_distributionId_fkey" FOREIGN KEY ("distributionId") REFERENCES "RoiCommissionDistribution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoiCommissionLine" ADD CONSTRAINT "RoiCommissionLine_sourceMemberId_fkey" FOREIGN KEY ("sourceMemberId") REFERENCES "Member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoiCommissionLine" ADD CONSTRAINT "RoiCommissionLine_sourceInvestmentId_fkey" FOREIGN KEY ("sourceInvestmentId") REFERENCES "Investment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoiCommissionLine" ADD CONSTRAINT "RoiCommissionLine_beneficiaryId_fkey" FOREIGN KEY ("beneficiaryId") REFERENCES "Member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
