import { getLocale, getTranslations } from "next-intl/server";
import { ReceiptText } from "lucide-react";
import { getAdminAccess, hasAdminPermission } from "@/lib/admin-access";
import { redirect } from "@/i18n/navigation";
import {
  AdminPageIntro,
  AdminSection,
  AdminTable,
  EmptyState,
  StatusBadge,
  adminStatusKey,
  formatDate,
  statusTone,
} from "@/components/admin/admin-ui";
import { DistributionForm } from "@/components/admin/config-forms";
import { formatSP } from "@/lib/money";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function AdminDistributionsPage() {
  const [session, locale, tn, ta, tc] = await Promise.all([
    getAdminAccess(),
    getLocale(),
    getTranslations("nav"),
    getTranslations("adminPanel"),
    getTranslations("common"),
  ]);
  if (!session || !hasAdminPermission(session, "distributions.view")) redirect({ href: "/admin-login", locale });

  const [distributions, total] = await Promise.all([
    prisma.profitDistribution.findMany({
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { lines: true } } },
    }),
    prisma.profitDistribution.aggregate({
      where: { status: "POSTED" },
      _sum: { distributablePaisa: true },
    }),
  ]);

  return (
    <div className="space-y-8 animate-rise">
      <AdminPageIntro
        eyebrow={tn("admin")}
        title={ta("distributionsTitle")}
        intro={ta("distributionsIntro")}
        icon={<ReceiptText className="size-3.5" aria-hidden="true" />}
      />

      <AdminSection id="post" title={ta("post")}>
        <DistributionForm />
      </AdminSection>

      <AdminSection id="distributions" title={ta("overview")}>
        <p className="mb-3 text-sm text-muted-foreground">
          {ta("distributionsTotalTransactionAmount")}:{" "}
          <span className="font-semibold tabular-nums text-foreground">
            {formatSP(total._sum.distributablePaisa ?? 0n)}
          </span>
        </p>
        {distributions.length === 0 ? (
          <EmptyState message={ta("noDistributions")} />
        ) : (
          <AdminTable
            caption={ta("distributionsTitle")}
            headers={[
              ta("dateTime"),
              tc("amount"),
              ta("eligible"),
              ta("profitPerThousand"),
              tc("status"),
              ta("recipients"),
            ]}
          >
            {distributions.map((distribution) => (
              <tr key={distribution.id} className="align-top">
                <td
                  className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground"
                  title={distribution.createdAt.toISOString()}
                >
                  {formatDate(distribution.createdAt, locale)}
                </td>
                <td className="whitespace-nowrap px-4 py-3 font-semibold tabular-nums">
                  {formatSP(distribution.distributablePaisa)}
                </td>
                <td className="whitespace-nowrap px-4 py-3 tabular-nums">
                  {formatSP(distribution.totalEligiblePaisa)}
                </td>
                <td className="whitespace-nowrap px-4 py-3 tabular-nums">
                  {formatSP(distribution.profitPerThousandPaisa)}
                </td>
                <td className="px-4 py-3">
                  <StatusBadge
                    tone={statusTone(distribution.status)}
                    label={ta(adminStatusKey(distribution.status))}
                  />
                </td>
                <td className="px-4 py-3 text-center tabular-nums">
                  {distribution._count.lines}
                </td>
              </tr>
            ))}
          </AdminTable>
        )}
      </AdminSection>
    </div>
  );
}
