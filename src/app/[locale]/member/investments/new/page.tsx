import { getTranslations, setRequestLocale } from "next-intl/server";
import { ArrowLeft, PlusCircle } from "lucide-react";
import { auth } from "@/auth";
import { InvestmentForm } from "@/components/member/investment-form";
import { PageHeader } from "@/components/member/page-header";
import { Link, redirect } from "@/i18n/navigation";
import { prisma } from "@/lib/prisma";
import { getActiveSettings } from "@/lib/settings";
import { loadTopUpAccounts } from "@/lib/topup-accounts";

export const dynamic = "force-dynamic";

export default async function NewInvestmentPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const [session, tm, settings, accounts] = await Promise.all([
    auth(),
    getTranslations("memberPanel"),
    getActiveSettings(),
    loadTopUpAccounts(prisma),
  ]);
  if (!session?.user?.id) {
    redirect({ href: "/login", locale });
    return null;
  }

  return (
    <div className="space-y-6 animate-rise">
      <PageHeader
        eyebrow={tm("newInvestment")}
        title={tm("applyTitle")}
        intro={tm("applyIntro")}
        icon={<PlusCircle className="size-3.5" aria-hidden="true" />}
      />

      <Link
        href="/member/investments"
        className="inline-flex w-fit items-center gap-1.5 rounded-lg text-xs font-semibold text-muted-foreground transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <ArrowLeft className="size-3.5" aria-hidden="true" />
        {tm("backToInvestments")}
      </Link>

      <InvestmentForm
        installmentDurationMonths={settings.installmentDurationMonths}
        profitOnlyLockInMonths={settings.profitOnlyLockInMonths}
        accounts={accounts}
      />
    </div>
  );
}
