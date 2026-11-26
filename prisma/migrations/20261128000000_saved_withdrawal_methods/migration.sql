-- CreateTable
CREATE TABLE "WithdrawalMethod" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "accountDetails" JSONB NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WithdrawalMethod_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WithdrawalMethod_memberId_label_key" ON "WithdrawalMethod"("memberId", "label");

-- CreateIndex
CREATE INDEX "WithdrawalMethod_memberId_createdAt_idx" ON "WithdrawalMethod"("memberId", "createdAt");

-- AddForeignKey
ALTER TABLE "WithdrawalMethod" ADD CONSTRAINT "WithdrawalMethod_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;
