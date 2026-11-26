-- R1 is disabled by 0% / 0 cap, and a blank duration means ongoing.
UPDATE "SalaryPlanDefinition"
SET "maxWeeks" = NULL
WHERE "rankKey" = 'R1' AND "maxWeeks" = 0;
