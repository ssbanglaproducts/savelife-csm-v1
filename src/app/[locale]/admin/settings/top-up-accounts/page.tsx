import { getLocale, getTranslations } from "next-intl/server";
import { auth } from "@/auth";
import { AdminSection } from "@/components/admin/admin-ui";
import { TopUpAccountsForm } from "@/components/admin/top-up-accounts-form";
import { redirect } from "@/i18n/navigation";
import { prisma } from "@/lib/prisma";
import { loadTopUpAccounts } from "@/lib/topup-accounts";

export const dynamic = "force-dynamic";

export default async function AdminTopUpAccountsSettingsPage() {
  const [session, locale, ta] = await Promise.all([
    auth(),
    getLocale(),
    getTranslations("adminPanel"),
  ]);
  if (!session?.user?.id || session.user.role !== "ADMIN") {
    redirect({ href: "/admin-login", locale });
    return null;
  }

  const topUpAccounts = await loadTopUpAccounts(prisma);

  return (
    <AdminSection id="top-up-accounts" title={ta("topUpAccountsTitle")}>
      <TopUpAccountsForm initialAccounts={topUpAccounts} />
    </AdminSection>
  );
}
