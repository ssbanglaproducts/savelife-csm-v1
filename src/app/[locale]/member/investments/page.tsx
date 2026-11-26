import { getTranslations, setRequestLocale } from "next-intl/server";
import { Info, Landmark } from "lucide-react";
import { auth } from "@/auth";
import { InvestmentsWorkspace } from "@/components/member/investments-workspace";
import { PageHeader } from "@/components/member/page-header";
import { redirect } from "@/i18n/navigation";
import { getInvestmentCardRows } from "@/lib/services/admin-investments";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function InvestmentsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
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

  const [rows, activeCount, pendingCount] = await Promise.all([
    getInvestmentCardRows({
      memberId: session.user.id,
      audience: "member",
      includeAudit: false,
    }),
    prisma.investment.count({ where: { memberId: session.user.id, status: "ACTIVE" } }),
    prisma.investment.count({ where: { memberId: session.user.id, status: "PENDING" } }),
  ]);

  return (
    <div className="space-y-8 animate-rise">
      <PageHeader
        eyebrow={tn("investments")}
        title={tm("investmentsTitle")}
        intro={tm("investmentsIntro")}
        icon={<Landmark className="size-3.5" aria-hidden="true" />}
      />

      <InvestmentsWorkspace
        rows={rows}
        activeCount={activeCount}
        pendingCount={pendingCount}
      />

      <section className="glass flex min-w-0 gap-3 rounded-2xl border-l-2 border-l-primary p-5">
        <Info className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
        <p className="text-sm leading-relaxed text-muted-foreground">{tm("disclosure")}</p>
      </section>
    </div>
  );
}
