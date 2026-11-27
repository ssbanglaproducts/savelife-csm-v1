-- Add a one-level category tree. Existing categories remain main categories.
ALTER TABLE "Category" ADD COLUMN "parentId" TEXT;

CREATE INDEX "Category_parentId_sortOrder_name_idx"
  ON "Category"("parentId", "sortOrder", "name");

ALTER TABLE "Category"
  ADD CONSTRAINT "Category_parentId_fkey"
  FOREIGN KEY ("parentId") REFERENCES "Category"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
