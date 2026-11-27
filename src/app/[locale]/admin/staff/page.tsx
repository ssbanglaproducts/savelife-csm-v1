import { getLocale, getTranslations } from "next-intl/server";
import { ShieldCheck } from "lucide-react";
import { redirect } from "@/i18n/navigation";
import {
  getAdminAccess,
  hasAdminPermission,
} from "@/lib/admin-access";
import { AdminPageIntro, AdminSection } from "@/components/admin/admin-ui";
import { StaffManager } from "@/components/admin/staff-manager";
import { prisma } from "@/lib/prisma";
import { serializeStaffAccount } from "@/lib/staff";

export const dynamic = "force-dynamic";

export default async function AdminStaffPage() {
  const [access, locale, tn, ta] = await Promise.all([
    getAdminAccess(),
    getLocale(),
    getTranslations("nav"),
    getTranslations("adminPanel"),
  ]);
  if (!access || !hasAdminPermission(access, "staff.view")) {
    redirect({ href: "/admin-login", locale });
    return null;
  }

  const rows = await prisma.member.findMany({
    where: { role: "STAFF" },
    select: {
      id: true,
      memberId: true,
      fullName: true,
      email: true,
      phone: true,
      role: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      staffPermissions: { select: { permission: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-8 animate-rise">
      <AdminPageIntro
        eyebrow={tn("admin")}
        title={ta("staffTitle")}
        intro={ta("staffIntro")}
        icon={<ShieldCheck className="size-4" aria-hidden="true" />}
      />
      <AdminSection id="staff-accounts" title={ta("staffAccountsTitle")}>
        <StaffManager
          staff={rows.map(serializeStaffAccount)}
          canManage={hasAdminPermission(access, "staff.manage")}
          currentUserId={access.id}
          grantablePermissions={[...access.permissions]}
        />
      </AdminSection>
    </div>
  );
}
