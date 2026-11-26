import { getLocale, getTranslations } from "next-intl/server";
import { Landmark } from "lucide-react";
import { auth } from "@/auth";
import { Link, redirect } from "@/i18n/navigation";
import { AdminPageIntro, AdminSection } from "@/components/admin/admin-ui";
import { InvestmentCards } from "@/components/admin/investment-cards";
import { getInvestmentCardRows } from "@/lib/services/admin-investments";

export const dynamic = "force-dynamic";

export default async function AdminInvestmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ proof?: string | string[] | undefined }>;
}) {
  const [session, locale, tn, ta, query] = await Promise.all([
    auth(),
    getLocale(),
    getTranslations("nav"),
    getTranslations("adminPanel"),
    searchParams,
  ]);
  if (session?.user?.role !== "ADMIN") redirect({ href: "/login", locale });

  const rows = await getInvestmentCardRows();
  const pendingProofOnly = query.proof === "pending";

  return (
    <div className="space-y-8 animate-rise">
      <AdminPageIntro
        eyebrow={tn("admin")}
        title={ta("investmentsTitle")}
        intro={ta("investmentsIntro")}
        icon={<Landmark className="size-3.5" aria-hidden="true" />}
      />

      <AdminSection id="operations" title={ta("quickActions")}>
        <div className="glass flex flex-col gap-3 rounded-2xl p-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="min-w-0 text-sm text-muted-foreground">
            {ta("approveViaProofNote")}{" "}
            <Link
              href={pendingProofOnly ? "/admin/investments" : "/admin/investments?proof=pending"}
              className="font-semibold text-primary hover:underline focus-visible:rounded focus-visible:ring-2 focus-visible:ring-ring"
            >
              {pendingProofOnly ? ta("showAllRecords") : ta("pendingProofFilter")}
            </Link>
          </p>
          <p className="text-sm text-muted-foreground">{ta("automationNote")}</p>
        </div>
      </AdminSection>

      <AdminSection id="investments" title={ta("overview")}>
        <InvestmentCards rows={rows} pendingProofOnly={pendingProofOnly} />
      </AdminSection>
    </div>
  );
}
