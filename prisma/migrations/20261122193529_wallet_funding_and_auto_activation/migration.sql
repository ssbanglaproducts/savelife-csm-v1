-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "LedgerEntryType" ADD VALUE 'REWARD_COLLECTION';
ALTER TYPE "LedgerEntryType" ADD VALUE 'MEMBER_TRANSFER_OUT';
ALTER TYPE "LedgerEntryType" ADD VALUE 'MEMBER_TRANSFER_IN';
ALTER TYPE "LedgerEntryType" ADD VALUE 'ORDER_WALLET_PAYMENT';
ALTER TYPE "LedgerEntryType" ADD VALUE 'WALLET_TOP_UP';

-- AlterEnum
ALTER TYPE "PaymentMethod" ADD VALUE 'WALLET';

-- CreateTable
CREATE TABLE "MemberTransfer" (
    "id" TEXT NOT NULL,
    "transferNumber" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "recipientId" TEXT NOT NULL,
    "amountPaisa" BIGINT NOT NULL,
    "note" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MemberTransfer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WalletTopUp" (
    "id" TEXT NOT NULL,
    "requestNumber" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "amountPaisa" BIGINT NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "transactionRef" TEXT NOT NULL,
    "proofImageUrl" TEXT,
    "note" TEXT,
    "status" "PaymentProofStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WalletTopUp_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MemberTransfer_transferNumber_key" ON "MemberTransfer"("transferNumber");

-- CreateIndex
CREATE UNIQUE INDEX "MemberTransfer_idempotencyKey_key" ON "MemberTransfer"("idempotencyKey");

-- CreateIndex
CREATE INDEX "MemberTransfer_senderId_completedAt_idx" ON "MemberTransfer"("senderId", "completedAt");

-- CreateIndex
CREATE INDEX "MemberTransfer_recipientId_completedAt_idx" ON "MemberTransfer"("recipientId", "completedAt");

-- CreateIndex
CREATE UNIQUE INDEX "WalletTopUp_requestNumber_key" ON "WalletTopUp"("requestNumber");

-- CreateIndex
CREATE INDEX "WalletTopUp_memberId_createdAt_idx" ON "WalletTopUp"("memberId", "createdAt");

-- CreateIndex
CREATE INDEX "WalletTopUp_status_createdAt_idx" ON "WalletTopUp"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "MemberTransfer" ADD CONSTRAINT "MemberTransfer_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "Member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemberTransfer" ADD CONSTRAINT "MemberTransfer_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "Member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletTopUp" ADD CONSTRAINT "WalletTopUp_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;
