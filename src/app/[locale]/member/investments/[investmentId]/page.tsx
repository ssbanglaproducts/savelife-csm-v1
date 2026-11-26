import { getTranslations, setRequestLocale } from "next-intl/server";
import { ArrowLeft, Landmark } from "lucide-react";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { buttonVariants } from "@/components/ui/button";
import { Link, redirect } from "@/i18n/navigation";
import { PageHeader } from "@/components/member/page-header";
import { MemberInvestmentDetail } from "@/components/member/investment-detail";
import { getInvestmentCardRows } from "@/lib/services/admin-investments";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function MemberInvestmentDetailPage({
  params,
}: {
  params: Promise<{ locale: string; investmentId: string }>;
}) {
  const { locale, investmentId } = await params;
  setRequestLocale(locale);

  const [session, tm, tn] = await Promise.all([
    auth(),
    getTranslations("memberPanel"),
    getTranslations("nav"),
  ]);
  if (!session?.user?.id) {
    redirect({ href: "/login", locale });
    return null;
  }

  const rows = await getInvestmentCardRows({
    id: investmentId,
    memberId: session.user.id,
    audience: "member",
    includeAudit: false,
  });
  const row = rows[0];
  if (!row) notFound();

  return (
    <div className="space-y-8 animate-rise">
      <PageHeader
        eyebrow={tn("investments")}
        title={tm("investmentDetails")}
        intro={`${row.investmentNumber} · ${row.typeLabel}`}
        icon={<Landmark className="size-3.5" aria-hidden="true" />}
      />

      <Link
        href="/member/investments"
        className={cn(buttonVariants({ variant: "outline" }), "w-fit")}
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        {tm("backToInvestments")}
      </Link>

      <MemberInvestmentDetail row={row} />

      <section className="glass flex min-w-0 gap-3 rounded-2xl border-l-2 border-l-primary p-5">
        <p className="text-sm leading-relaxed text-muted-foreground">{tm("disclosure")}</p>
      </section>
    </div>
  );
}
