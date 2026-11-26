-- Complete salary system: eight separate rank treasuries, idempotent funding
-- from eligible investments, active rank entitlements, and weekly postings.

-- AlterEnum
ALTER TYPE "WalletCategory" ADD VALUE 'SALARY';

-- AlterEnum
ALTER TYPE "LedgerEntryType" ADD VALUE 'SALARY_PAYMENT';

-- CreateEnum
CREATE TYPE "SalaryPaymentStatus" AS ENUM ('SUCCESS', 'FAILED');

-- AlterTable
ALTER TABLE "Wallet" ADD COLUMN "salaryPaisa" BIGINT NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "SalaryTreasury" (
    "rankKey" TEXT NOT NULL,
    "balancePaisa" BIGINT NOT NULL DEFAULT 0,
    "totalAllocatedPaisa" BIGINT NOT NULL DEFAULT 0,
    "totalPaidPaisa" BIGINT NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SalaryTreasury_pkey" PRIMARY KEY ("rankKey")
);

-- CreateTable
CREATE TABLE "SalaryFunding" (
    "id" TEXT NOT NULL,
    "investmentId" TEXT NOT NULL,
    "rankKey" TEXT NOT NULL,
    "amountPaisa" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SalaryFunding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalaryEntitlement" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "rankKey" TEXT NOT NULL,
    "rankSortOrder" INTEGER NOT NULL,
    "achievedAt" TIMESTAMP(3) NOT NULL,
    "weeksPaid" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SalaryEntitlement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalaryEntitlementChange" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "previousRankKey" TEXT,
    "previousRankSortOrder" INTEGER,
    "rankKey" TEXT NOT NULL,
    "rankSortOrder" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SalaryEntitlementChange_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalaryDistribution" (
    "id" TEXT NOT NULL,
    "weekEndAt" TIMESTAMP(3) NOT NULL,
    "status" "DistributionStatus" NOT NULL DEFAULT 'DRAFT',
    "totalTreasuryPaisa" BIGINT NOT NULL,
    "totalPaidPaisa" BIGINT NOT NULL DEFAULT 0,
    "recipientCount" INTEGER NOT NULL DEFAULT 0,
    "postedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SalaryDistribution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalaryPayment" (
    "id" TEXT NOT NULL,
    "distributionId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "entitlementId" TEXT NOT NULL,
    "rankKey" TEXT NOT NULL,
    "amountPaisa" BIGINT NOT NULL,
    "weekNumber" INTEGER NOT NULL,
    "status" "SalaryPaymentStatus" NOT NULL DEFAULT 'SUCCESS',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SalaryPayment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SalaryFunding_rankKey_createdAt_idx" ON "SalaryFunding"("rankKey", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "SalaryFunding_investmentId_rankKey_key" ON "SalaryFunding"("investmentId", "rankKey");

-- CreateIndex
CREATE UNIQUE INDEX "SalaryEntitlement_memberId_key" ON "SalaryEntitlement"("memberId");

-- CreateIndex
CREATE INDEX "SalaryEntitlementChange_memberId_changedAt_idx" ON "SalaryEntitlementChange"("memberId", "changedAt");

-- CreateIndex
CREATE UNIQUE INDEX "SalaryDistribution_weekEndAt_key" ON "SalaryDistribution"("weekEndAt");

-- CreateIndex
CREATE INDEX "SalaryDistribution_createdAt_idx" ON "SalaryDistribution"("createdAt");

-- CreateIndex
CREATE INDEX "SalaryPayment_rankKey_createdAt_idx" ON "SalaryPayment"("rankKey", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "SalaryPayment_distributionId_memberId_key" ON "SalaryPayment"("distributionId", "memberId");

-- AddForeignKey
ALTER TABLE "SalaryFunding" ADD CONSTRAINT "SalaryFunding_investmentId_fkey" FOREIGN KEY ("investmentId") REFERENCES "Investment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalaryFunding" ADD CONSTRAINT "SalaryFunding_rankKey_fkey" FOREIGN KEY ("rankKey") REFERENCES "SalaryTreasury"("rankKey") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalaryEntitlement" ADD CONSTRAINT "SalaryEntitlement_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalaryEntitlementChange" ADD CONSTRAINT "SalaryEntitlementChange_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalaryPayment" ADD CONSTRAINT "SalaryPayment_distributionId_fkey" FOREIGN KEY ("distributionId") REFERENCES "SalaryDistribution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalaryPayment" ADD CONSTRAINT "SalaryPayment_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalaryPayment" ADD CONSTRAINT "SalaryPayment_entitlementId_fkey" FOREIGN KEY ("entitlementId") REFERENCES "SalaryEntitlement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalaryPayment" ADD CONSTRAINT "SalaryPayment_rankKey_fkey" FOREIGN KEY ("rankKey") REFERENCES "SalaryTreasury"("rankKey") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Seed one treasury row per salary-paying rank.
INSERT INTO "SalaryTreasury" ("rankKey", "balancePaisa", "totalAllocatedPaisa", "totalPaidPaisa", "updatedAt")
VALUES
  ('R2', 0, 0, 0, CURRENT_TIMESTAMP),
  ('R3', 0, 0, 0, CURRENT_TIMESTAMP),
  ('R4', 0, 0, 0, CURRENT_TIMESTAMP),
  ('R5', 0, 0, 0, CURRENT_TIMESTAMP),
  ('R6', 0, 0, 0, CURRENT_TIMESTAMP),
  ('R7', 0, 0, 0, CURRENT_TIMESTAMP),
  ('R8', 0, 0, 0, CURRENT_TIMESTAMP),
  ('R9', 0, 0, 0, CURRENT_TIMESTAMP);

-- Backfill every eligible investment that existed before this migration. The
-- unique (investmentId, rankKey) index guarantees each one is counted once.
INSERT INTO "SalaryFunding" ("id", "investmentId", "rankKey", "amountPaisa", "createdAt")
SELECT
  'salary-funding:' || i."id" || ':' || allocation.rank_key,
  i."id",
  allocation.rank_key,
  (i."amountPaisa" * allocation.bps) / 10000,
  CURRENT_TIMESTAMP
FROM "Investment" i
CROSS JOIN (
  VALUES
    ('R2', 200),
    ('R3', 150),
    ('R4', 125),
    ('R5', 125),
    ('R6', 100),
    ('R7', 100),
    ('R8', 100),
    ('R9', 50)
) AS allocation(rank_key, bps)
WHERE i."status" = 'ACTIVE'
  AND i."remainingPrincipalPaisa" > 0
ON CONFLICT ("investmentId", "rankKey") DO NOTHING;

UPDATE "SalaryTreasury" st
SET
  "totalAllocatedPaisa" = funding.total,
  "balancePaisa" = funding.total,
  "updatedAt" = CURRENT_TIMESTAMP
FROM (
  SELECT "rankKey", COALESCE(SUM("amountPaisa"), 0) AS total
  FROM "SalaryFunding"
  GROUP BY "rankKey"
) AS funding
WHERE st."rankKey" = funding."rankKey";

-- Backfill the highest achieved salary rank for existing members.
INSERT INTO "SalaryEntitlement" (
  "id", "memberId", "rankKey", "rankSortOrder", "achievedAt", "weeksPaid", "createdAt", "updatedAt"
)
SELECT DISTINCT ON (achievement."memberId")
  'salary-entitlement:' || achievement."id",
  achievement."memberId",
  achievement."rankKey",
  achievement."rankSortOrder",
  achievement."achievedAt",
  0,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "RankAchievement" achievement
WHERE achievement."rankSortOrder" >= 2
ORDER BY achievement."memberId", achievement."rankSortOrder" DESC, achievement."achievedAt" DESC, achievement."id" DESC
ON CONFLICT ("memberId") DO NOTHING;

INSERT INTO "SalaryEntitlementChange" (
  "id", "memberId", "previousRankKey", "previousRankSortOrder", "rankKey", "rankSortOrder", "reason", "changedAt"
)
SELECT
  'salary-entitlement-change:' || entitlement."id",
  entitlement."memberId",
  NULL,
  NULL,
  entitlement."rankKey",
  entitlement."rankSortOrder",
  'BACKFILL',
  CURRENT_TIMESTAMP
FROM "SalaryEntitlement" entitlement
ON CONFLICT DO NOTHING;
