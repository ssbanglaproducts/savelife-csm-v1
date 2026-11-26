-- Installments now return only the invested capital; profit is distributed
-- separately. Track the capital still in the business for profit weighting.
ALTER TABLE "Investment" ADD COLUMN "remainingPrincipalPaisa" BIGINT NOT NULL DEFAULT 0;

-- Legacy installment credits represented capital + a fixed 2x return. Treat
-- every paisa already paid as capital returned so the remaining balance and the
-- new profit weighting stay conservative for existing investments.
UPDATE "Investment"
SET "remainingPrincipalPaisa" = CASE
  WHEN "type" = 'INSTALLMENT'
    THEN GREATEST(
      "amountPaisa" - COALESCE((
        SELECT SUM("amountPaisa")
        FROM "InvestmentInstallment"
        WHERE "investmentId" = "Investment"."id" AND "status" = 'PAID'
      ), 0),
      0
    )
  ELSE "amountPaisa"
END;

ALTER TABLE "Investment" DROP COLUMN "returnBps";
ALTER TABLE "InvestmentSettings" DROP COLUMN "installmentReturnBps";

-- Profit Only principal is withdrawn by notice after the lock-in period.
CREATE TYPE "WithdrawalType" AS ENUM ('AVAILABLE', 'PRINCIPAL');

ALTER TABLE "Withdrawal"
  ADD COLUMN "type" "WithdrawalType" NOT NULL DEFAULT 'AVAILABLE',
  ADD COLUMN "investmentId" TEXT,
  ADD COLUMN "noticeAt" TIMESTAMP(3),
  ADD COLUMN "payableAt" TIMESTAMP(3);

ALTER TABLE "Withdrawal"
  ADD CONSTRAINT "Withdrawal_investmentId_fkey"
  FOREIGN KEY ("investmentId") REFERENCES "Investment"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- One open notice per investment. NULL investment ids (Available withdrawals)
-- are not constrained by this unique index in PostgreSQL.
ALTER TABLE "Withdrawal"
  ADD CONSTRAINT "Withdrawal_investmentId_type_status_key"
  UNIQUE ("investmentId", "type", "status");

CREATE INDEX "Withdrawal_type_status_payableAt_idx"
  ON "Withdrawal"("type", "status", "payableAt");
