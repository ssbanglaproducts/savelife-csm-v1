import {
  parseAssignedPermissions,
  type AdminPermission,
} from "@/lib/admin-permissions";

export type StaffAccountView = {
  id: string;
  memberId: string | null;
  fullName: string;
  email: string;
  phone: string;
  role: "ADMIN" | "STAFF";
  status: "ACTIVE" | "INACTIVE" | "SUSPENDED";
  permissions: AdminPermission[];
  createdAt: string;
  updatedAt: string;
};

type StaffRow = {
  id: string;
  memberId: string | null;
  fullName: string;
  email: string;
  phone: string;
  role: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  staffPermissions: Array<{ permission: string }>;
};

/** Minimal DTO for the staff workspace; never includes secrets or money data. */
export function serializeStaffAccount(row: StaffRow): StaffAccountView {
  return {
    id: row.id,
    memberId: row.memberId,
    fullName: row.fullName,
    email: row.email,
    phone: row.phone,
    role: row.role as StaffAccountView["role"],
    status: row.status as StaffAccountView["status"],
    permissions: parseAssignedPermissions(
      row.staffPermissions.map((grant) => grant.permission),
    ).sort(),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
