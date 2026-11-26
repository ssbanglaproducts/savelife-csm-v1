-- Registration now happens in one atomic request. The old resumable draft
-- table is no longer written to or read by the application.
DROP TABLE IF EXISTS "RegistrationDraft";
