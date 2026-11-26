-- Ensure every salary entitlement snapshots the member's highest achieved
-- salary rank. Existing successful-week progress is preserved on repairs.
WITH highest AS (
  SELECT DISTINCT ON ("memberId")
    "id",
    "memberId",
    "rankKey",
    "rankSortOrder",
    "achievedAt"
  FROM "RankAchievement"
  WHERE "rankKey" IN ('R2', 'R3', 'R4', 'R5', 'R6', 'R7', 'R8', 'R9')
  ORDER BY "memberId", "rankSortOrder" DESC, "achievedAt" DESC, "id" DESC
)
UPDATE "SalaryEntitlement" AS entitlement
SET
  "rankKey" = highest."rankKey",
  "rankSortOrder" = highest."rankSortOrder",
  "achievedAt" = highest."achievedAt",
  "updatedAt" = CURRENT_TIMESTAMP
FROM highest
WHERE entitlement."memberId" = highest."memberId"
  AND (
    entitlement."rankKey" <> highest."rankKey"
    OR entitlement."rankSortOrder" <> highest."rankSortOrder"
  );

WITH highest AS (
  SELECT DISTINCT ON ("memberId")
    "id",
    "memberId",
    "rankKey",
    "rankSortOrder",
    "achievedAt"
  FROM "RankAchievement"
  WHERE "rankKey" IN ('R2', 'R3', 'R4', 'R5', 'R6', 'R7', 'R8', 'R9')
  ORDER BY "memberId", "rankSortOrder" DESC, "achievedAt" DESC, "id" DESC
)
INSERT INTO "SalaryEntitlement" (
  "id", "memberId", "rankKey", "rankSortOrder", "achievedAt", "weeksPaid", "createdAt", "updatedAt"
)
SELECT
  'salary-entitlement:' || highest."id",
  highest."memberId",
  highest."rankKey",
  highest."rankSortOrder",
  highest."achievedAt",
  0,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM highest
WHERE NOT EXISTS (
  SELECT 1 FROM "SalaryEntitlement" entitlement
  WHERE entitlement."memberId" = highest."memberId"
)
ON CONFLICT ("id") DO NOTHING;
