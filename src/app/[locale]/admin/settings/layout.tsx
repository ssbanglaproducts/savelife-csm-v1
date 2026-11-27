import type { ReactNode } from "react";
import { getLocale, getTranslations } from "next-intl/server";
import { BadgeCheck } from "lucide-react";
import { auth } from "@/auth";
import { AdminPageIntro } from "@/components/admin/admin-ui";
import { SettingsTabs } from "@/components/admin/settings-tabs";
import { redirect } from "@/i18n/navigation";

export default async function AdminSettingsLayout({ children }: { children: ReactNode }) {
  const [session, locale, tn, ta] = await Promise.all([
    auth(),
    getLocale(),
    getTranslations("nav"),
    getTranslations("adminPanel"),
  ]);
  if (!session?.user?.id || session.user.role !== "ADMIN") {
    redirect({ href: "/admin-login", locale });
    return null;
  }

  return (
    <div className="space-y-6 animate-rise">
      <AdminPageIntro
        eyebrow={tn("admin")}
        title={ta("settingsHubTitle")}
        intro={ta("settingsHubIntro")}
        icon={<BadgeCheck className="size-4" aria-hidden="true" />}
      />
      <SettingsTabs />
      {children}
    </div>
  );
}
