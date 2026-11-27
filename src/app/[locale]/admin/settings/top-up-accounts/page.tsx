import { getLocale, getTranslations } from "next-intl/server";
import { getAdminAccess, hasAdminPermission } from "@/lib/admin-access";
import { AdminSection } from "@/components/admin/admin-ui";
import { TopUpAccountsForm } from "@/components/admin/top-up-accounts-form";
import { redirect } from "@/i18n/navigation";
import { prisma } from "@/lib/prisma";
import { loadTopUpAccountSettings } from "@/lib/topup-accounts";

export const dynamic = "force-dynamic";

export default async function AdminTopUpAccountsSettingsPage() {
  const [session, locale, ta] = await Promise.all([
    getAdminAccess(),
    getLocale(),
    getTranslations("adminPanel"),
  ]);
  if (!session || !hasAdminPermission(session, "topUps.manage")) {
    redirect({ href: "/admin-login", locale });
    return null;
  }

  const settings = await loadTopUpAccountSettings(prisma);

  return (
    <AdminSection id="top-up-accounts" title={ta("topUpAccountsTitle")}>
      <TopUpAccountsForm initialSettings={settings} />
    </AdminSection>
  );
}
