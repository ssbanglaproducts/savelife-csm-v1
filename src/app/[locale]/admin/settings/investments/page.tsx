import { getLocale, getTranslations } from "next-intl/server";
import { auth } from "@/auth";
import {
  AdminSection,
  AdminTable,
  EmptyState,
  StatusBadge,
  formatDate,
} from "@/components/admin/admin-ui";
import { SettingsForm } from "@/components/admin/config-forms";
import { redirect } from "@/i18n/navigation";
import { formatSP, paisaToSP } from "@/lib/money";
import { bpsToPercent, formatPercent } from "@/lib/rates";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function AdminInvestmentSettingsPage() {
  const [session, locale, ta, tc, tm] = await Promise.all([
    auth(),
    getLocale(),
    getTranslations("adminPanel"),
    getTranslations("common"),
    getTranslations("memberPanel"),
  ]);
  if (!session?.user?.id || session.user.role !== "ADMIN") {
    redirect({ href: "/login", locale });
    return null;
  }

  const settings = await prisma.investmentSettings.findMany({ orderBy: { version: "desc" } });
  const nextVersion = settings.reduce((max, item) => Math.max(max, item.version), 0) + 1;
  const active = settings.find((item) => item.isActive) ?? settings[0];
  const defaults = {
    installmentDurationMonths: active?.installmentDurationMonths ?? 14,
    profitOnlyLockInMonths: active?.profitOnlyLockInMonths ?? 12,
    withdrawalFeePercent: bpsToPercent(active?.withdrawalFeeBps ?? 1000),
    minWithdrawal: active ? paisaToSP(active.minWithdrawalPaisa) : "500",
  };

  return (
    <div className="space-y-8">
      <AdminSection id="new-version" title={ta("createVersion")}>
        <SettingsForm version={nextVersion} defaults={defaults} />
      </AdminSection>

      <AdminSection id="versions" title={ta("settingsTitle")}>
        {settings.length === 0 ? <EmptyState message={tc("noResults")} /> : null}
        <AdminTable
          caption={ta("settingsTitle")}
          headers={[
            ta("version"),
            tc("status"),
            ta("installmentMonths"),
            ta("capitalRepayment"),
            ta("lockInMonths"),
            ta("withdrawalFeePercent"),
            ta("minWithdrawal"),
            tc("date"),
          ]}
        >
          {settings.map((item) => (
            <tr key={item.id} className="align-top">
              <td className="whitespace-nowrap px-4 py-3 font-mono text-sm">{item.version}</td>
              <td className="px-4 py-3">
                <StatusBadge
                  tone={item.isActive ? "success" : "neutral"}
                  label={item.isActive ? tm("active") : tc("previous")}
                />
              </td>
              <td className="px-4 py-3 tabular-nums">{item.installmentDurationMonths}</td>
              <td className="px-4 py-3 tabular-nums">{ta("capitalOnly")}</td>
              <td className="px-4 py-3 tabular-nums">{item.profitOnlyLockInMonths}</td>
              <td className="px-4 py-3 tabular-nums">{formatPercent(item.withdrawalFeeBps)}</td>
              <td className="whitespace-nowrap px-4 py-3 tabular-nums">
                {formatSP(item.minWithdrawalPaisa)}
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground">
                {formatDate(item.effectiveFrom, locale)}
              </td>
            </tr>
          ))}
        </AdminTable>
      </AdminSection>
    </div>
  );
}
