-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'STAFF';

-- CreateTable
CREATE TABLE "StaffPermissionGrant" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "permission" TEXT NOT NULL,
    "grantedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StaffPermissionGrant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffMutation" (
    "id" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "targetId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StaffMutation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StaffPermissionGrant_memberId_permission_key" ON "StaffPermissionGrant"("memberId", "permission");

-- CreateIndex
CREATE INDEX "StaffPermissionGrant_grantedById_idx" ON "StaffPermissionGrant"("grantedById");

-- CreateIndex
CREATE UNIQUE INDEX "StaffMutation_idempotencyKey_key" ON "StaffMutation"("idempotencyKey");

-- CreateIndex
CREATE INDEX "StaffMutation_actorId_createdAt_idx" ON "StaffMutation"("actorId", "createdAt");

-- AddForeignKey
ALTER TABLE "StaffPermissionGrant" ADD CONSTRAINT "StaffPermissionGrant_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffPermissionGrant" ADD CONSTRAINT "StaffPermissionGrant_grantedById_fkey" FOREIGN KEY ("grantedById") REFERENCES "Member"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffMutation" ADD CONSTRAINT "StaffMutation_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffMutation" ADD CONSTRAINT "StaffMutation_targetId_fkey" FOREIGN KEY ("targetId") REFERENCES "Member"("id") ON DELETE SET NULL ON UPDATE CASCADE;
