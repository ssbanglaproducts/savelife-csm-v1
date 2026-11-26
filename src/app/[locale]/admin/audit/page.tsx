import { getLocale, getTranslations } from "next-intl/server";
import { ScrollText } from "lucide-react";
import { auth } from "@/auth";
import { redirect } from "@/i18n/navigation";
import {
  AdminPageIntro,
  AdminSection,
  EmptyState,
  formatDate,
  prettyJson,
} from "@/components/admin/admin-ui";
import { AuditTable, type AuditRow } from "@/components/admin/audit-table";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function AdminAuditPage() {
  const [session, locale, tn, ta] = await Promise.all([
    auth(),
    getLocale(),
    getTranslations("nav"),
    getTranslations("adminPanel"),
  ]);
  if (session?.user?.role !== "ADMIN") redirect({ href: "/login", locale });

  const logs = await prisma.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
    include: { actor: { select: { fullName: true } } },
  });

  const rows: AuditRow[] = logs.map((log) => ({
    id: log.id,
    actor: log.actor?.fullName ?? log.actorRole ?? "System",
    action: log.action,
    entity: log.entityId ? `${log.entityType} · ${log.entityId}` : log.entityType,
    createdAt: formatDate(log.createdAt, locale),
    before: prettyJson(log.before),
    after: prettyJson(log.after),
  }));

  return (
    <div className="space-y-8 animate-rise">
      <AdminPageIntro
        eyebrow={tn("admin")}
        title={ta("auditTitle")}
        intro={ta("auditIntro")}
        icon={<ScrollText className="size-3.5" aria-hidden="true" />}
      />
      <AdminSection id="audit" title={ta("overview")}>
        {rows.length === 0 ? (
          <EmptyState message={ta("noActivity")} />
        ) : (
          <AuditTable rows={rows} />
        )}
      </AdminSection>
    </div>
  );
}
