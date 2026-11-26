-- CreateTable
CREATE TABLE "AccountOwnership" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "label" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AccountOwnership_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AccountOwnership_accountId_key" ON "AccountOwnership"("accountId");
CREATE UNIQUE INDEX "AccountOwnership_ownerId_accountId_key" ON "AccountOwnership"("ownerId", "accountId");
CREATE INDEX "AccountOwnership_ownerId_createdAt_idx" ON "AccountOwnership"("ownerId", "createdAt");

-- AddForeignKey
ALTER TABLE "AccountOwnership" ADD CONSTRAINT "AccountOwnership_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AccountOwnership" ADD CONSTRAINT "AccountOwnership_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill self-ownership for every existing member.
INSERT INTO "AccountOwnership" ("id", "ownerId", "accountId", "createdAt")
SELECT 'self_' || "id", "id", "id", COALESCE("createdAt", NOW())
FROM "Member"
ON CONFLICT ("accountId") DO NOTHING;
