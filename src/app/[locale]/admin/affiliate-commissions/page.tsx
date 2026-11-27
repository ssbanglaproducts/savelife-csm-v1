import { getLocale, getTranslations } from "next-intl/server";
import { GitBranch } from "lucide-react";
import { getAdminAccess, hasAdminPermission } from "@/lib/admin-access";
import { redirect } from "@/i18n/navigation";
import {
  AdminPageIntro,
  AdminSection,
  AdminTable,
  EmptyState,
  adminInputClass,
  adminLabelClass,
  formatDate,
} from "@/components/admin/admin-ui";
import { Button, buttonVariants } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { formatSP } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import { loadAffiliateCommissionHistory } from "@/lib/services/affiliate-commissions-history";

export const dynamic = "force-dynamic";

type QueryValue = string | string[] | undefined;

function first(value: QueryValue): string | undefined {
  const resolved = Array.isArray(value) ? value[0] : value;
  return resolved?.trim() ? resolved.trim() : undefined;
}

function parseLevel(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) ? parsed : undefined;
}

function parsePage(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}

function ratePercent(bps: number): string {
  return `${(bps / 100).toFixed(2)}%`;
}

function listHref(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") search.set(key, String(value));
  }
  const query = search.toString();
  return `/admin/affiliate-commissions${query ? `?${query}` : ""}`;
}

export default async function AdminAffiliateCommissionsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: QueryValue }>;
}) {
  const [query, session, locale, tn, ta, tc] = await Promise.all([
    searchParams,
    getAdminAccess(),
    getLocale(),
    getTranslations("nav"),
    getTranslations("adminPanel"),
    getTranslations("common"),
  ]);
  if (
    !session ||
    !hasAdminPermission(session, "affiliateCommissions.view")
  ) {
    redirect({ href: "/admin-login", locale });
  }

  const filters = {
    q: first(query.q),
    level: parseLevel(first(query.level)),
    month: first(query.month),
    page: parsePage(first(query.page)),
  };
  const result = await loadAffiliateCommissionHistory(prisma, filters);

  const base = {
    q: filters.q,
    level: filters.level,
    month: filters.month,
  };
  const previousHref = listHref({ ...base, page: result.page - 1 });
  const nextHref = listHref({ ...base, page: result.page + 1 });
  const start = (result.page - 1) * result.pageSize + 1;
  const end = Math.min(result.page * result.pageSize, result.total);

  return (
    <div className="space-y-8 animate-rise">
      <AdminPageIntro
        eyebrow={tn("admin")}
        title={ta("affiliateCommissionsTitle")}
        intro={ta("affiliateCommissionsIntro")}
        icon={<GitBranch className="size-3.5" aria-hidden="true" />}
      />

      <AdminSection id="affiliate-commissions" title={ta("overview")}>
        <div className="space-y-5">
          <p className="text-sm text-muted-foreground">
            {ta("affiliateCommissionsTotal")}:{" "}
            <span className="font-semibold tabular-nums text-foreground">
              {formatSP(result.totalPaisa)}
            </span>
          </p>

          <form method="get" className="glass rounded-2xl p-5 sm:p-6">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <div>
                <label htmlFor="affiliate-q" className={adminLabelClass}>
                  {ta("affiliateCommissionsSearch")}
                </label>
                <input
                  id="affiliate-q"
                  name="q"
                  defaultValue={filters.q ?? ""}
                  placeholder={ta("affiliateCommissionsSearchPlaceholder")}
                  className={`${adminInputClass} mt-2`}
                />
              </div>
              <div>
                <label htmlFor="affiliate-level" className={adminLabelClass}>
                  {ta("affiliateCommissionsLevel")}
                </label>
                <select
                  id="affiliate-level"
                  name="level"
                  defaultValue={filters.level ? String(filters.level) : ""}
                  className={`${adminInputClass} mt-2`}
                >
                  <option value="">{ta("affiliateCommissionsAllLevels")}</option>
                  {[1, 2, 3, 4, 5].map((level) => (
                    <option key={level} value={level}>
                      {ta("roiLevelValue", { level })}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="affiliate-month" className={adminLabelClass}>
                  {ta("affiliateCommissionsMonth")}
                </label>
                <input
                  id="affiliate-month"
                  name="month"
                  inputMode="numeric"
                  placeholder="YYYY-MM"
                  defaultValue={filters.month ?? ""}
                  className={`${adminInputClass} mt-2`}
                />
              </div>
              <div className="flex items-end">
                <Button type="submit" className="w-full">
                  {ta("affiliateCommissionsApplyFilters")}
                </Button>
              </div>
            </div>
          </form>

          {result.rows.length === 0 ? (
            <EmptyState
              message={
                filters.q || filters.level || filters.month
                  ? ta("affiliateCommissionsNoMatches")
                  : ta("affiliateCommissionsNoRecords")
              }
            />
          ) : (
            <div className="space-y-4">
              <AdminTable
                caption={ta("affiliateCommissionsTitle")}
                headers={[
                  ta("dateTime"),
                  ta("affiliateCommissionsBeneficiary"),
                  ta("affiliateCommissionsSource"),
                  ta("affiliateCommissionsInvestment"),
                  ta("affiliateCommissionsLevel"),
                  ta("affiliateCommissionsRate"),
                  ta("affiliateCommissionsAmount"),
                ]}
              >
                {result.rows.map((row) => (
                  <tr key={row.id} className="align-top">
                    <td
                      className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground"
                      title={row.createdAt.toISOString()}
                    >
                      {formatDate(row.createdAt, locale)}
                    </td>
                    <td className="px-4 py-3">
                      <span className="block font-semibold">{row.beneficiary.fullName}</span>
                      <span className="block text-xs text-muted-foreground">
                        {row.beneficiary.memberId}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="block text-sm">{row.sourceMember.fullName}</span>
                      <span className="block text-xs text-muted-foreground">
                        {row.sourceMember.memberId}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs tabular-nums">
                      {row.investmentNumber}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs tabular-nums">
                      {ta("roiLevelValue", { level: row.level })}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs tabular-nums">
                      {ratePercent(row.rateBps)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 font-semibold tabular-nums text-primary">
                      {formatSP(row.amountPaisa)}
                    </td>
                  </tr>
                ))}
              </AdminTable>

              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs text-muted-foreground">
                  {ta("affiliateCommissionsShowing", { start, end, total: result.total })}
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  {result.page > 1 ? (
                    <Link href={previousHref} className={buttonVariants({ variant: "outline", size: "sm" })}>
                      {tc("previous")}
                    </Link>
                  ) : null}
                  <span className="text-xs tabular-nums text-muted-foreground">
                    {ta("affiliateCommissionsPage", {
                      page: result.page,
                      totalPages: result.totalPages,
                    })}
                  </span>
                  {result.page < result.totalPages ? (
                    <Link href={nextHref} className={buttonVariants({ variant: "outline", size: "sm" })}>
                      {tc("next")}
                    </Link>
                  ) : null}
                </div>
              </div>
            </div>
          )}
        </div>
      </AdminSection>
    </div>
  );
}
