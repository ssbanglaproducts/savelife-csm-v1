-- Drop the one-per-month restriction so multiple distributions can be posted
-- on the same day. Each distribution is uniquely identified by its own id.
DROP INDEX "ProfitDistribution_month_key";

-- Keep the history ordered efficiently by its auto timestamp.
CREATE INDEX "ProfitDistribution_createdAt_idx" ON "ProfitDistribution"("createdAt");
