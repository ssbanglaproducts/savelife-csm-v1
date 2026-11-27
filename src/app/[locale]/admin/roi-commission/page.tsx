import { getLocale, getTranslations } from "next-intl/server";
import { ReceiptText } from "lucide-react";
import { getAdminAccess, hasAdminPermission } from "@/lib/admin-access";
import {
  AdminPageIntro,
  AdminSection,
  AdminTable,
  EmptyState,
  adminInputClass,
  adminLabelClass,
  formatDate,
} from "@/components/admin/admin-ui";
import { RoiCommissionForm } from "@/components/admin/roi-commission-form";
import { Button, buttonVariants } from "@/components/ui/button";
import { Link, redirect } from "@/i18n/navigation";
import { formatSP } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import {
  loadRoiOverview,
  loadRoiSponsorHistory,
} from "@/lib/services/roi-commission-history";
import { loadRoiRateConfig } from "@/lib/services/roi-commission";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

type RoiTab = "rates" | "overview" | "history";
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

function tabHref(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") search.set(key, String(value));
  }
  const query = search.toString();
  return `/admin/roi-commission${query ? `?${query}` : ""}`;
}

function ratePercent(bps: number): string {
  return `${(bps / 100).toFixed(2)}%`;
}

export default async function AdminRoiCommissionPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: QueryValue }>;
}) {
  const [query, session, locale, tn, ta] = await Promise.all([
    searchParams,
    getAdminAccess(),
    getLocale(),
    getTranslations("nav"),
    getTranslations("adminPanel"),
  ]);
  if (!session || !hasAdminPermission(session, "roiCommission.view")) redirect({ href: "/admin-login", locale });

  const requestedTab = first(query.tab);
  const tab: RoiTab =
    requestedTab === "overview" || requestedTab === "history" ? requestedTab : "rates";

  const config = await loadRoiRateConfig(prisma);
  const tabs: Array<{ key: RoiTab; label: string }> = [
    { key: "rates", label: ta("roiTabRates") },
    { key: "overview", label: ta("roiTabOverview") },
    { key: "history", label: ta("roiTabHistory") },
  ];

  const filters = {
    q: first(query.q),
    level: parseLevel(first(query.level)),
    month: first(query.month),
    page: parsePage(first(query.page)),
  };

  return (
    <div className="space-y-8 animate-rise">
      <AdminPageIntro
        eyebrow={tn("admin")}
        title={ta("roiCommissionTitle")}
        intro={ta("roiCommissionIntro")}
        icon={<ReceiptText className="size-3.5" aria-hidden="true" />}
      />

      <nav aria-label={ta("roiTabsLabel")} className="flex flex-wrap gap-2">
        {tabs.map(({ key, label }) => {
          const active = tab === key;
          return (
            <Link
              key={key}
              href={tabHref({ tab: key })}
              aria-current={active ? "page" : undefined}
              className={cn(
                "inline-flex items-center rounded-xl border px-3 py-2 text-sm font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-ring",
                active
                  ? "border-primary/40 bg-primary/15 text-foreground"
                  : "border-border bg-background/50 text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              {label}
            </Link>
          );
        })}
      </nav>

      {tab === "rates" ? (
        <AdminSection id="roi-rates" title={ta("roiTabRates")}>
          <RoiCommissionForm initialRatesBps={config.ratesBps} />
        </AdminSection>
      ) : null}

      {tab === "overview" ? (
        <AdminSection id="roi-overview" title={ta("roiTabOverview")}>
          <ROIOverview locale={locale} />
        </AdminSection>
      ) : null}

      {tab === "history" ? (
        <AdminSection id="roi-history" title={ta("roiTabHistory")}>
          <div className="space-y-5">
            <form method="get" className="glass rounded-2xl p-5 sm:p-6">
              <input type="hidden" name="tab" value="history" />
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <div>
                  <label htmlFor="roi-history-q" className={adminLabelClass}>
                    {ta("roiHistorySearch")}
                  </label>
                  <input
                    id="roi-history-q"
                    name="q"
                    defaultValue={filters.q ?? ""}
                    placeholder={ta("roiHistorySearchPlaceholder")}
                    className={`${adminInputClass} mt-2`}
                  />
                </div>
                <div>
                  <label htmlFor="roi-history-level" className={adminLabelClass}>
                    {ta("roiLevel")}
                  </label>
                  <select
                    id="roi-history-level"
                    name="level"
                    defaultValue={filters.level ? String(filters.level) : ""}
                    className={`${adminInputClass} mt-2`}
                  >
                    <option value="">{ta("roiAllLevels")}</option>
                    {[1, 2, 3, 4, 5].map((level) => (
                      <option key={level} value={level}>
                        {ta("roiLevelValue", { level })}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="roi-history-month" className={adminLabelClass}>
                    {ta("roiMonth")}
                  </label>
                  <input
                    id="roi-history-month"
                    name="month"
                    inputMode="numeric"
                    placeholder="YYYY-MM"
                    defaultValue={filters.month ?? ""}
                    className={`${adminInputClass} mt-2`}
                  />
                </div>
                <div className="flex items-end">
                  <Button type="submit" className="w-full">
                    {ta("roiApplyFilters")}
                  </Button>
                </div>
              </div>
            </form>

            <ROIHistory locale={locale} filters={filters} />
          </div>
        </AdminSection>
      ) : null}
    </div>
  );
}

async function ROIOverview({ locale }: { locale: string }) {
  const ta = await getTranslations("adminPanel");
  const [rows, total] = await Promise.all([
    loadRoiOverview(prisma),
    prisma.roiCommissionDistribution.aggregate({
      _sum: { totalCommissionPaisa: true },
    }),
  ]);

  return (
    <div className="space-y-3">
    <p className="text-sm text-muted-foreground">
      {ta("roiCommissionsTotal")}:{" "}
      <span className="font-semibold tabular-nums text-foreground">
        {formatSP(total._sum.totalCommissionPaisa ?? 0n)}
      </span>
    </p>
    {rows.length === 0 ? (
      <EmptyState message={ta("roiNoDistributions")} />
    ) : (
    <AdminTable
      caption={ta("roiTabOverview")}
      headers={[
        ta("roiMonth"),
        ta("roiPostedAt"),
        ta("roiOriginalProfit"),
        ta("roiTotalCommission"),
        ta("roiPayoutCount"),
        ta("roiRecipients"),
        ta("roiRateSnapshot"),
      ]}
    >
      {rows.map((row) => (
        <tr key={row.id} className="align-top">
          <td className="whitespace-nowrap px-4 py-3 font-semibold tabular-nums">{row.month}</td>
          <td
            className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground"
            title={row.postedAt.toISOString()}
          >
            {formatDate(row.postedAt, locale)}
          </td>
          <td className="whitespace-nowrap px-4 py-3 tabular-nums">
            {formatSP(row.originalProfitPaisa)}
          </td>
          <td className="whitespace-nowrap px-4 py-3 font-semibold tabular-nums text-primary">
            {formatSP(row.totalCommissionPaisa)}
          </td>
          <td className="whitespace-nowrap px-4 py-3 text-center tabular-nums">
            {row.lineCount}
          </td>
          <td className="whitespace-nowrap px-4 py-3 text-center tabular-nums">
            {row.recipientCount}
          </td>
          <td className="px-4 py-3 text-xs tabular-nums text-muted-foreground">
            {row.ratesBps.map(ratePercent).join(" / ")}
          </td>
        </tr>
      ))}
    </AdminTable>
    )}
    </div>
  );
}

async function ROIHistory({
  locale,
  filters,
}: {
  locale: string;
  filters: {
    q?: string;
    level?: number;
    month?: string;
    page?: number;
  };
}) {
  const [ta, tc] = await Promise.all([
    getTranslations("adminPanel"),
    getTranslations("common"),
  ]);
  const result = await loadRoiSponsorHistory(prisma, filters);

  if (result.rows.length === 0) {
    return (
      <EmptyState message={filters.q || filters.level || filters.month ? ta("roiNoHistoryMatches") : ta("roiNoHistory")} />
    );
  }

  const base = {
    q: filters.q,
    level: filters.level,
    month: filters.month,
  };
  const previousHref = tabHref({ ...base, tab: "history", page: result.page - 1 });
  const nextHref = tabHref({ ...base, tab: "history", page: result.page + 1 });
  const start = (result.page - 1) * result.pageSize + 1;
  const end = Math.min(result.page * result.pageSize, result.total);

  return (
    <div className="space-y-4">
      <AdminTable
        caption={ta("roiTabHistory")}
        headers={[
          ta("roiSponsor"),
          ta("roiLevel"),
          ta("roiSourceMember"),
          ta("roiInvestment"),
          ta("roiBasis"),
          ta("roiRate"),
          ta("roiAmount"),
          ta("roiPostedAt"),
        ]}
      >
        {result.rows.map((row) => (
          <tr key={row.id} className="align-top">
            <td className="px-4 py-3">
              <span className="block font-semibold">{row.beneficiary.fullName}</span>
              <span className="block text-xs text-muted-foreground">{row.beneficiary.memberId}</span>
            </td>
            <td className="whitespace-nowrap px-4 py-3 text-xs tabular-nums">
              {ta("roiLevelValue", { level: row.level })}
            </td>
            <td className="px-4 py-3">
              <span className="block text-sm">{row.sourceMember.fullName}</span>
              <span className="block text-xs text-muted-foreground">{row.sourceMember.memberId}</span>
            </td>
            <td className="whitespace-nowrap px-4 py-3 text-xs tabular-nums">
              {row.investmentNumber}
            </td>
            <td className="whitespace-nowrap px-4 py-3 tabular-nums">
              {formatSP(row.basisPaisa)}
            </td>
            <td className="whitespace-nowrap px-4 py-3 text-xs tabular-nums">
              {ratePercent(row.rateBps)}
            </td>
            <td className="whitespace-nowrap px-4 py-3 font-semibold tabular-nums text-primary">
              {formatSP(row.amountPaisa)}
            </td>
            <td
              className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground"
              title={row.createdAt.toISOString()}
            >
              {formatDate(row.createdAt, locale)}
            </td>
          </tr>
        ))}
      </AdminTable>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          {ta("roiShowing", { start, end, total: result.total })}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {result.page > 1 ? (
            <Link
              href={previousHref}
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              {tc("previous")}
            </Link>
          ) : null}
          <span className="text-xs tabular-nums text-muted-foreground">
            {ta("roiPage", { page: result.page, totalPages: result.totalPages })}
          </span>
          {result.page < result.totalPages ? (
            <Link href={nextHref} className={buttonVariants({ variant: "outline", size: "sm" })}>
              {tc("next")}
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  );
}
