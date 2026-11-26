-- Editable, versioned salary plan plus an R1 treasury (disabled at 0% / 0 cap).

-- CreateTable
CREATE TABLE "SalaryPlanVersion" (
    "id" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "activatedAt" TIMESTAMP(3),
    "note" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SalaryPlanVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalaryPlanDefinition" (
    "id" TEXT NOT NULL,
    "planVersionId" TEXT NOT NULL,
    "rankKey" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "allocationBps" INTEGER NOT NULL,
    "maxWeeklySalaryPaisa" BIGINT NOT NULL,
    "maxWeeks" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SalaryPlanDefinition_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "SalaryEntitlement" ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "SalaryDistribution" ADD COLUMN "salaryPlanVersionId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "SalaryPlanVersion_version_key" ON "SalaryPlanVersion"("version");

-- CreateIndex
CREATE INDEX "SalaryPlanVersion_isActive_version_idx" ON "SalaryPlanVersion"("isActive", "version");

-- CreateIndex
CREATE UNIQUE INDEX "SalaryPlanDefinition_planVersionId_rankKey_key" ON "SalaryPlanDefinition"("planVersionId", "rankKey");

-- CreateIndex
CREATE UNIQUE INDEX "SalaryPlanDefinition_planVersionId_sortOrder_key" ON "SalaryPlanDefinition"("planVersionId", "sortOrder");

-- CreateIndex
CREATE INDEX "SalaryPlanDefinition_planVersionId_sortOrder_idx" ON "SalaryPlanDefinition"("planVersionId", "sortOrder");

-- CreateIndex
CREATE INDEX "SalaryDistribution_salaryPlanVersionId_idx" ON "SalaryDistribution"("salaryPlanVersionId");

-- AddForeignKey
ALTER TABLE "SalaryPlanVersion" ADD CONSTRAINT "SalaryPlanVersion_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "Member"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalaryPlanDefinition" ADD CONSTRAINT "SalaryPlanDefinition_planVersionId_fkey" FOREIGN KEY ("planVersionId") REFERENCES "SalaryPlanVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalaryDistribution" ADD CONSTRAINT "SalaryDistribution_salaryPlanVersionId_fkey" FOREIGN KEY ("salaryPlanVersionId") REFERENCES "SalaryPlanVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Seed the R1 treasury. It receives 0% funding until the admin enables it.
INSERT INTO "SalaryTreasury" ("rankKey", "balancePaisa", "totalAllocatedPaisa", "totalPaidPaisa", "updatedAt")
VALUES ('R1', 0, 0, 0, CURRENT_TIMESTAMP)
ON CONFLICT ("rankKey") DO NOTHING;

-- Seed version 1 from the previous locked configuration.
INSERT INTO "SalaryPlanVersion" (
    "id", "version", "isActive", "effectiveFrom", "activatedAt", "note", "createdById", "createdAt"
)
VALUES (
    'salary-plan-version:1', 1, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP,
    'Official initial salary plan', NULL, CURRENT_TIMESTAMP
)
ON CONFLICT ("version") DO NOTHING;

INSERT INTO "SalaryPlanDefinition" (
    "id", "planVersionId", "rankKey", "sortOrder", "allocationBps", "maxWeeklySalaryPaisa", "maxWeeks", "createdAt"
)
VALUES
    ('salary-plan-definition:1:R1', 'salary-plan-version:1', 'R1', 1, 0, 0, NULL, CURRENT_TIMESTAMP),
    ('salary-plan-definition:1:R2', 'salary-plan-version:1', 'R2', 2, 200, 1000000, 12, CURRENT_TIMESTAMP),
    ('salary-plan-definition:1:R3', 'salary-plan-version:1', 'R3', 3, 150, 2500000, 16, CURRENT_TIMESTAMP),
    ('salary-plan-definition:1:R4', 'salary-plan-version:1', 'R4', 4, 125, 3500000, 24, CURRENT_TIMESTAMP),
    ('salary-plan-definition:1:R5', 'salary-plan-version:1', 'R5', 5, 125, 10000000, 36, CURRENT_TIMESTAMP),
    ('salary-plan-definition:1:R6', 'salary-plan-version:1', 'R6', 6, 100, 20000000, 48, CURRENT_TIMESTAMP),
    ('salary-plan-definition:1:R7', 'salary-plan-version:1', 'R7', 7, 100, 30000000, NULL, CURRENT_TIMESTAMP),
    ('salary-plan-definition:1:R8', 'salary-plan-version:1', 'R8', 8, 100, 40000000, NULL, CURRENT_TIMESTAMP),
    ('salary-plan-definition:1:R9', 'salary-plan-version:1', 'R9', 9, 50, 50000000, NULL, CURRENT_TIMESTAMP)
ON CONFLICT ("planVersionId", "rankKey") DO NOTHING;

-- Existing postings used the locked configuration, which is now version 1.
UPDATE "SalaryDistribution"
SET "salaryPlanVersionId" = 'salary-plan-version:1'
WHERE "salaryPlanVersionId" IS NULL;
