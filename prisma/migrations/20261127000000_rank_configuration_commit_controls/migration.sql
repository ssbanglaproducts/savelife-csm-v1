-- Rank configuration commit controls: reviewed changes, idempotency, and
-- dedicated physical reward description fields.

-- AlterTable
ALTER TABLE "RankPlanVersion"
    ADD COLUMN "approvedChanges" JSONB,
    ADD COLUMN "commitToken" TEXT;

-- AlterTable
ALTER TABLE "RankDefinition"
    ADD COLUMN "rewardDescription" TEXT,
    ADD COLUMN "rewardDescriptionBn" TEXT;

-- AlterTable
ALTER TABLE "RankAchievement"
    ADD COLUMN "rewardDescriptionSnapshot" TEXT,
    ADD COLUMN "rewardDescriptionBnSnapshot" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "RankPlanVersion_commitToken_key" ON "RankPlanVersion"("commitToken");
