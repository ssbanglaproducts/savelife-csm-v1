-- CreateEnum
CREATE TYPE "RankAchievementStatus" AS ENUM ('PENDING', 'ACHIEVED');

-- CreateEnum
CREATE TYPE "RankQualificationMethod" AS ENUM ('DIRECT_SALES', 'TEAM_SALES');

-- CreateEnum
CREATE TYPE "RankRewardType" AS ENUM ('SP', 'PHYSICAL');

-- CreateEnum
CREATE TYPE "RankRewardEventType" AS ENUM ('SP_CREDIT', 'PHYSICAL_COLLECTION');

-- CreateTable
CREATE TABLE "RankPlanVersion" (
    "id" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "activatedAt" TIMESTAMP(3),
    "note" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RankPlanVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RankDefinition" (
    "id" TEXT NOT NULL,
    "planVersionId" TEXT NOT NULL,
    "rankKey" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "nameBn" TEXT,
    "directTargetPaisa" BIGINT NOT NULL,
    "team1TargetPaisa" BIGINT NOT NULL,
    "team2TargetPaisa" BIGINT NOT NULL,
    "team3TargetPaisa" BIGINT NOT NULL,
    "rewardType" "RankRewardType" NOT NULL,
    "rewardSpPaisa" BIGINT,
    "rewardLabel" TEXT,
    "rewardLabelBn" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RankDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RankAchievement" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "planVersionId" TEXT NOT NULL,
    "rankKey" TEXT NOT NULL,
    "rankNameSnapshot" TEXT NOT NULL,
    "rankNameBnSnapshot" TEXT,
    "rankSortOrder" INTEGER NOT NULL,
    "achievedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "primaryMethod" "RankQualificationMethod" NOT NULL,
    "secondaryMethod" "RankQualificationMethod",
    "directEvidence" JSONB,
    "teamEvidence" JSONB,
    "targetsSnapshot" JSONB NOT NULL,
    "rewardType" "RankRewardType" NOT NULL,
    "rewardSpPaisa" BIGINT,
    "rewardLabel" TEXT,
    "rewardLabelBn" TEXT,
    "rewardStatus" "RankAchievementStatus" NOT NULL DEFAULT 'PENDING',
    "walletCreditedAt" TIMESTAMP(3),
    "physicalCollectedAt" TIMESTAMP(3),
    "physicalCollectedById" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RankAchievement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RankRewardEvent" (
    "id" TEXT NOT NULL,
    "achievementId" TEXT NOT NULL,
    "type" "RankRewardEventType" NOT NULL,
    "amountPaisa" BIGINT,
    "referenceType" TEXT,
    "referenceId" TEXT,
    "actorId" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RankRewardEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RankPlanVersion_version_key" ON "RankPlanVersion"("version");

-- CreateIndex
CREATE INDEX "RankPlanVersion_isActive_version_idx" ON "RankPlanVersion"("isActive", "version");

-- CreateIndex
CREATE INDEX "RankDefinition_planVersionId_sortOrder_idx" ON "RankDefinition"("planVersionId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "RankDefinition_planVersionId_rankKey_key" ON "RankDefinition"("planVersionId", "rankKey");

-- CreateIndex
CREATE UNIQUE INDEX "RankDefinition_planVersionId_sortOrder_key" ON "RankDefinition"("planVersionId", "sortOrder");

-- CreateIndex
CREATE INDEX "RankAchievement_memberId_achievedAt_idx" ON "RankAchievement"("memberId", "achievedAt");

-- CreateIndex
CREATE INDEX "RankAchievement_rankKey_achievedAt_idx" ON "RankAchievement"("rankKey", "achievedAt");

-- CreateIndex
CREATE INDEX "RankAchievement_rewardStatus_rewardType_idx" ON "RankAchievement"("rewardStatus", "rewardType");

-- CreateIndex
CREATE UNIQUE INDEX "RankAchievement_memberId_rankKey_key" ON "RankAchievement"("memberId", "rankKey");

-- CreateIndex
CREATE INDEX "RankRewardEvent_achievementId_createdAt_idx" ON "RankRewardEvent"("achievementId", "createdAt");

-- AddForeignKey
ALTER TABLE "RankPlanVersion" ADD CONSTRAINT "RankPlanVersion_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "Member"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RankDefinition" ADD CONSTRAINT "RankDefinition_planVersionId_fkey" FOREIGN KEY ("planVersionId") REFERENCES "RankPlanVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RankAchievement" ADD CONSTRAINT "RankAchievement_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RankAchievement" ADD CONSTRAINT "RankAchievement_planVersionId_fkey" FOREIGN KEY ("planVersionId") REFERENCES "RankPlanVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RankAchievement" ADD CONSTRAINT "RankAchievement_physicalCollectedById_fkey" FOREIGN KEY ("physicalCollectedById") REFERENCES "Member"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RankRewardEvent" ADD CONSTRAINT "RankRewardEvent_achievementId_fkey" FOREIGN KEY ("achievementId") REFERENCES "RankAchievement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RankRewardEvent" ADD CONSTRAINT "RankRewardEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "Member"("id") ON DELETE SET NULL ON UPDATE CASCADE;
