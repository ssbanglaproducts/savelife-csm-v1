-- Reset all member-generated data. Product catalogue and system settings stay.
TRUNCATE TABLE "Member" CASCADE;
UPDATE "MemberSequence" SET "lastValue" = 0 WHERE "id" = 1;

-- AlterTable
ALTER TABLE "Member" ADD COLUMN     "placementParentId" TEXT,
ADD COLUMN     "placementSlot" INTEGER;

-- Only slots 1, 2 and 3 are valid.
ALTER TABLE "Member" ADD CONSTRAINT "Member_placementSlot_check"
  CHECK ("placementSlot" IS NULL OR ("placementSlot" >= 1 AND "placementSlot" <= 3));

-- CreateIndex
CREATE INDEX "Member_placementParentId_idx" ON "Member"("placementParentId");

-- CreateIndex
CREATE UNIQUE INDEX "Member_placementParentId_placementSlot_key" ON "Member"("placementParentId", "placementSlot");

-- AddForeignKey
ALTER TABLE "Member" ADD CONSTRAINT "Member_placementParentId_fkey" FOREIGN KEY ("placementParentId") REFERENCES "Member"("id") ON DELETE SET NULL ON UPDATE CASCADE;
