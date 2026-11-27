import { getLocale, getTranslations } from "next-intl/server";
import { Landmark } from "lucide-react";
import { auth } from "@/auth";
import { redirect } from "@/i18n/navigation";
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
  if (session?.user?.role !== "ADMIN") redirect({ href: "/admin-login", locale });

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

      <AdminSection id="investments" title={ta("overview")}>
        <InvestmentCards rows={rows} pendingProofOnly={pendingProofOnly} />
      </AdminSection>
    </div>
  );
}
