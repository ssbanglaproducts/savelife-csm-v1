-- Lock signup identity/contact details and capture the primary address at registration.
ALTER TABLE "RegistrationDraft"
  ADD COLUMN "addressStreet" TEXT,
  ADD COLUMN "addressThana" TEXT,
  ADD COLUMN "addressDistrict" TEXT,
  ADD COLUMN "addressPostalCode" TEXT;

-- Members can nominate contacts from their profile.
CREATE TABLE "Nominee" (
  "id" TEXT NOT NULL,
  "memberId" TEXT NOT NULL,
  "fullName" TEXT NOT NULL,
  "relation" TEXT NOT NULL,
  "phone" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Nominee_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Nominee"
  ADD CONSTRAINT "Nominee_memberId_fkey"
  FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "Nominee_memberId_idx" ON "Nominee"("memberId");
