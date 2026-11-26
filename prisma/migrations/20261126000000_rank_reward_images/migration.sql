-- Transparent reward artwork attached to physical rank rewards.
ALTER TABLE "RankDefinition" ADD COLUMN "rewardImageUrl" TEXT;
ALTER TABLE "RankAchievement" ADD COLUMN "rewardImageUrl" TEXT;

-- Backfill every existing plan version so old plans display the official art.
UPDATE "RankDefinition"
SET "rewardImageUrl" = CASE "rankKey"
  WHEN 'R4' THEN '/images/rank-rewards/motorcycle.png'
  WHEN 'R6' THEN '/images/rank-rewards/luxury-car.png'
  WHEN 'R7' THEN '/images/rank-rewards/world-tour.png'
  WHEN 'R8' THEN '/images/rank-rewards/flat.png'
  WHEN 'R9' THEN '/images/rank-rewards/duplex-house.png'
  ELSE NULL
END
WHERE "rankKey" IN ('R4', 'R6', 'R7', 'R8', 'R9');

-- Existing achievements keep the same immutable reward image snapshot.
UPDATE "RankAchievement"
SET "rewardImageUrl" = CASE "rankKey"
  WHEN 'R4' THEN '/images/rank-rewards/motorcycle.png'
  WHEN 'R6' THEN '/images/rank-rewards/luxury-car.png'
  WHEN 'R7' THEN '/images/rank-rewards/world-tour.png'
  WHEN 'R8' THEN '/images/rank-rewards/flat.png'
  WHEN 'R9' THEN '/images/rank-rewards/duplex-house.png'
  ELSE NULL
END
WHERE "rankKey" IN ('R4', 'R6', 'R7', 'R8', 'R9');
