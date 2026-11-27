import { getLocale, getTranslations } from "next-intl/server";
import { getAdminAccess, hasAdminPermission } from "@/lib/admin-access";
import { AdminSection } from "@/components/admin/admin-ui";
import { AuthBannerVideoForm } from "@/components/admin/auth-banner-video-form";
import { redirect } from "@/i18n/navigation";
import { loadAuthBannerSetting } from "@/lib/auth-banner-video";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function AdminAuthBannerSettingsPage() {
  const [session, locale, ta] = await Promise.all([
    getAdminAccess(),
    getLocale(),
    getTranslations("adminPanel"),
  ]);
  if (!session || !hasAdminPermission(session, "content.manage")) {
    redirect({ href: "/admin-login", locale });
    return null;
  }

  const initialSetting = await loadAuthBannerSetting(prisma);

  return (
    <AdminSection id="auth-banner-video" title={ta("authBannerVideoTitle")}>
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">{ta("authBannerVideoIntro")}</p>
        <AuthBannerVideoForm initialSetting={initialSetting} />
      </div>
    </AdminSection>
  );
}
