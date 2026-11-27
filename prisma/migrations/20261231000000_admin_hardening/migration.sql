-- AlterTable
ALTER TABLE "ProfitDistribution" ADD COLUMN "idempotencyKey" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "ProfitDistribution_idempotencyKey_key" ON "ProfitDistribution"("idempotencyKey");

-- CreateTable
CREATE TABLE "AuditOutbox" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "actorRole" "Role",
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "before" JSONB,
    "after" JSONB,
    "ip" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditOutbox_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AuditOutbox_nextAttemptAt_createdAt_idx" ON "AuditOutbox"("nextAttemptAt", "createdAt");

-- CreateIndex
CREATE INDEX "AuditOutbox_entityType_entityId_idx" ON "AuditOutbox"("entityType", "entityId");

-- CreateTable
CREATE TABLE "InvestmentSideEffectOutbox" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "investmentId" TEXT NOT NULL,
    "proofId" TEXT NOT NULL,
    "actorId" TEXT,
    "uplines" JSONB,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),

    CONSTRAINT "InvestmentSideEffectOutbox_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "InvestmentSideEffectOutbox_investmentId_kind_proofId_key" ON "InvestmentSideEffectOutbox"("investmentId", "kind", "proofId");

-- CreateIndex
CREATE INDEX "InvestmentSideEffectOutbox_nextAttemptAt_createdAt_idx" ON "InvestmentSideEffectOutbox"("nextAttemptAt", "createdAt");

-- CreateIndex
CREATE INDEX "InvestmentSideEffectOutbox_investmentId_kind_idx" ON "InvestmentSideEffectOutbox"("investmentId", "kind");
