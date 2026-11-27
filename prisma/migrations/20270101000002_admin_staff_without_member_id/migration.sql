-- Admin and staff identities are not members and are not allocated member IDs.
-- Existing admin/staff rows are intentionally left unchanged; only actual
-- members are required to keep a permanent ID.
ALTER TABLE "Member" ALTER COLUMN "memberId" DROP NOT NULL;

ALTER TABLE "Member" ADD CONSTRAINT "Member_member_id_required_for_members"
  CHECK ("role" <> 'MEMBER' OR "memberId" IS NOT NULL);
