-- Per-rank badge artwork, snapshotted into achievements like reward images.
ALTER TABLE "RankDefinition" ADD COLUMN "badgeImageUrl" TEXT;
ALTER TABLE "RankAchievement" ADD COLUMN "badgeImageUrl" TEXT;

-- Backfill existing plan versions and achievements with the generated level badge.
UPDATE "RankDefinition"
SET "badgeImageUrl" = CASE "rankKey"
  WHEN 'R1' THEN '/images/ranks/r1.svg'
  WHEN 'R2' THEN '/images/ranks/r2.svg'
  WHEN 'R3' THEN '/images/ranks/r3.svg'
  WHEN 'R4' THEN '/images/ranks/r4.svg'
  WHEN 'R5' THEN '/images/ranks/r5.svg'
  WHEN 'R6' THEN '/images/ranks/r6.svg'
  WHEN 'R7' THEN '/images/ranks/r7.svg'
  WHEN 'R8' THEN '/images/ranks/r8.svg'
  WHEN 'R9' THEN '/images/ranks/r9.svg'
  ELSE NULL
END;

UPDATE "RankAchievement"
SET "badgeImageUrl" = CASE "rankKey"
  WHEN 'R1' THEN '/images/ranks/r1.svg'
  WHEN 'R2' THEN '/images/ranks/r2.svg'
  WHEN 'R3' THEN '/images/ranks/r3.svg'
  WHEN 'R4' THEN '/images/ranks/r4.svg'
  WHEN 'R5' THEN '/images/ranks/r5.svg'
  WHEN 'R6' THEN '/images/ranks/r6.svg'
  WHEN 'R7' THEN '/images/ranks/r7.svg'
  WHEN 'R8' THEN '/images/ranks/r8.svg'
  WHEN 'R9' THEN '/images/ranks/r9.svg'
  ELSE NULL
END;
