import { getLocale, getTranslations } from "next-intl/server";
import { ArrowLeft, Landmark } from "lucide-react";
import { notFound } from "next/navigation";
import { getAdminAccess, hasAdminPermission } from "@/lib/admin-access";
import { AdminPageIntro, AdminSection } from "@/components/admin/admin-ui";
import { InvestmentDetail } from "@/components/admin/investment-detail";
import { buttonVariants } from "@/components/ui/button";
import { Link, redirect } from "@/i18n/navigation";
import { getInvestmentCardRows } from "@/lib/services/admin-investments";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AdminInvestmentDetailPage({
  params,
}: {
  params: Promise<{ investmentId: string }>;
}) {
  const [session, locale, tn, ta] = await Promise.all([
    getAdminAccess(),
    getLocale(),
    getTranslations("nav"),
    getTranslations("adminPanel"),
  ]);
  if (!session || !hasAdminPermission(session, "investments.view")) redirect({ href: "/admin-login", locale });

  const { investmentId } = await params;
  const rows = await getInvestmentCardRows({ id: investmentId });
  const row = rows[0];
  if (!row) notFound();

  return (
    <div className="space-y-8 animate-rise">
      <AdminPageIntro
        eyebrow={tn("admin")}
        title={ta("investmentDetails")}
        intro={`${row.investmentNumber} · ${row.member.name}`}
        icon={<Landmark className="size-3.5" aria-hidden="true" />}
      />

      <Link
        href="/admin/investments"
        className={cn(buttonVariants({ variant: "outline" }), "w-fit")}
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        {ta("backToInvestments")}
      </Link>

      <AdminSection id="investment-detail" title={ta("detailsTitle")}>
        <InvestmentDetail row={row} />
      </AdminSection>
    </div>
  );
}
