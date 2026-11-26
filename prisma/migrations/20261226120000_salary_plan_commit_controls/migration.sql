-- Salary plan commit controls: explicit rank toggles, reviewed changes, and
-- idempotency for the final authorized commit.

-- AlterTable
ALTER TABLE "SalaryPlanVersion"
    ADD COLUMN "approvedChanges" JSONB,
    ADD COLUMN "commitToken" TEXT;

-- AlterTable
ALTER TABLE "SalaryPlanDefinition"
    ADD COLUMN "isEnabled" BOOLEAN NOT NULL DEFAULT true;

-- Existing ranks were payable only when both allocation and weekly cap were positive.
UPDATE "SalaryPlanDefinition"
SET "isEnabled" = false
WHERE "allocationBps" = 0 OR "maxWeeklySalaryPaisa" = 0;

-- CreateIndex
CREATE UNIQUE INDEX "SalaryPlanVersion_commitToken_key" ON "SalaryPlanVersion"("commitToken");
