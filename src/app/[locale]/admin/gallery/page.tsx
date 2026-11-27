import { getLocale, getTranslations } from "next-intl/server";
import { Images } from "lucide-react";
import { getAdminAccess, hasAdminPermission } from "@/lib/admin-access";
import { redirect } from "@/i18n/navigation";
import { AdminPageIntro } from "@/components/admin/admin-ui";
import { GalleryManager } from "@/components/admin/gallery-manager";
import { getAdminGalleryPosts } from "@/lib/gallery";

export const dynamic = "force-dynamic";

export default async function AdminGalleryPage() {
  const [session, locale, tn, ta] = await Promise.all([
    getAdminAccess(),
    getLocale(),
    getTranslations("nav"),
    getTranslations("adminPanel"),
  ]);
  if (!session || !hasAdminPermission(session, "content.view")) redirect({ href: "/admin-login", locale });

  const posts = await getAdminGalleryPosts(locale === "bn" ? "bn" : "en");

  return (
    <div className="space-y-8 animate-rise">
      <AdminPageIntro
        eyebrow={tn("admin")}
        title={ta("galleryTitle")}
        intro={ta("galleryIntro")}
        icon={<Images className="size-3.5" aria-hidden="true" />}
      />
      <GalleryManager posts={posts} />
    </div>
  );
}
