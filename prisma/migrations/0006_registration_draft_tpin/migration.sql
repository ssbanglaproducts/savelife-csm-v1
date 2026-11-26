-- Separate financial credential for active members.
ALTER TABLE "Member" ADD COLUMN "tPinHash" TEXT,
ADD COLUMN "tPinUpdatedAt" TIMESTAMP(3);

-- Provisional identity used by the resumable four-step registration flow.
CREATE TABLE "RegistrationDraft" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "profileImage" TEXT,
    "sponsorMemberId" TEXT,
    "placementMemberId" TEXT,
    "placementSlot" INTEGER,
    "tPinHash" TEXT,
    "tPinAcknowledged" BOOLEAN NOT NULL DEFAULT false,
    "currentStep" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RegistrationDraft_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RegistrationDraft_memberId_key" ON "RegistrationDraft"("memberId");
CREATE UNIQUE INDEX "RegistrationDraft_email_key" ON "RegistrationDraft"("email");
CREATE UNIQUE INDEX "RegistrationDraft_phone_key" ON "RegistrationDraft"("phone");
CREATE INDEX "RegistrationDraft_currentStep_idx" ON "RegistrationDraft"("currentStep");
