-- Phone is contact-only, just like email: multiple members may share a number.
-- Sign-in uses Member ID, and unfinished drafts are resumed by matching the
-- password against drafts on the same number rather than by unique phone.
DROP INDEX IF EXISTS "Member_phone_key";
DROP INDEX IF EXISTS "RegistrationDraft_phone_key";

CREATE INDEX IF NOT EXISTS "RegistrationDraft_phone_idx" ON "RegistrationDraft"("phone");
