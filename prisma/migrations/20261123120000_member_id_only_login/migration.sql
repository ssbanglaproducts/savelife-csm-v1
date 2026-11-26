-- Member ID is the only sign-in identity, so the same email address may be
-- shared by multiple member accounts and provisional registration drafts.
DROP INDEX IF EXISTS "Member_email_key";
DROP INDEX IF EXISTS "RegistrationDraft_email_key";
