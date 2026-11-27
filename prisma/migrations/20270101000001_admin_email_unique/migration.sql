-- Admin and staff accounts sign in with email, so their emails must be unique.
-- Members may still share an email address; the filter is intentionally narrow.
CREATE UNIQUE INDEX "Member_adminEmail_key" ON "Member" (lower("email")) WHERE "role" IN ('ADMIN', 'STAFF');
