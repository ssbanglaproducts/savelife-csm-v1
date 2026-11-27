import { getLocale, getTranslations } from "next-intl/server";
import { Megaphone } from "lucide-react";
import { auth } from "@/auth";
import { redirect } from "@/i18n/navigation";
import {
  AdminPageIntro,
  AdminSection,
  EmptyState,
  StatusBadge,
} from "@/components/admin/admin-ui";
import { AnnouncementsForm } from "@/components/admin/announcements-form";
import {
  formatNotificationDate,
  getBroadcasts,
  localizedText,
} from "@/lib/services/notifications";

export const dynamic = "force-dynamic";

export default async function AdminAnnouncementsPage() {
  const [session, locale, tn, t] = await Promise.all([
    auth(),
    getLocale(),
    getTranslations("nav"),
    getTranslations("notifications"),
  ]);
  if (session?.user?.role !== "ADMIN") redirect({ href: "/admin-login", locale });

  const broadcasts = await getBroadcasts();

  return (
    <div className="space-y-8 animate-rise">
      <AdminPageIntro
        eyebrow={tn("admin")}
        title={t("adminTitle")}
        intro={t("adminIntro")}
        icon={<Megaphone className="size-3.5" aria-hidden="true" />}
      />

      <AnnouncementsForm />

      <AdminSection id="recent" title={t("recent")}>
        {broadcasts.length === 0 ? (
          <EmptyState message={t("noRecent")} />
        ) : (
          <div className="grid gap-3">
            {broadcasts.map((item) => (
              <article key={item.id} className="glass rounded-2xl p-4 sm:p-5">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge tone="neutral" label={t(`kinds.${item.kind}`)} />
                  <span className="text-xs text-muted-foreground">
                    {formatNotificationDate(item.createdAt, locale)} ·{" "}
                    {t("readBy", { count: item._count.reads })}
                  </span>
                </div>
                <h3 className="mt-3 font-display text-base font-bold">
                  {localizedText(item.title, locale)}
                </h3>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  {localizedText(item.body, locale)}
                </p>
                {item.href ? (
                  <p className="mt-2 font-mono text-[11px] text-primary" dir="ltr">
                    {item.href}
                  </p>
                ) : null}
              </article>
            ))}
          </div>
        )}
      </AdminSection>
    </div>
  );
}
