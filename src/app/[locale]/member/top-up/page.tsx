import { getTranslations, setRequestLocale } from "next-intl/server";
import { Plus } from "lucide-react";
import { auth } from "@/auth";
import { PageHeader } from "@/components/member/page-header";
import { TopUpForm } from "@/components/member/top-up-form";
import type { TopUpMethod } from "@/components/member/top-up-form";
import type { TopUpRequest } from "@/components/member/top-up-form";
import { redirect } from "@/i18n/navigation";
import { prisma } from "@/lib/prisma";
import { loadTopUpAccounts } from "@/lib/topup-accounts";

export const dynamic = "force-dynamic";

export default async function TopUpPage({
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

  const [accounts, requests, wallet] = await Promise.all([
    loadTopUpAccounts(prisma),
    prisma.walletTopUp.findMany({
      where: { memberId: session.user.id },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        requestNumber: true,
        amountPaisa: true,
        method: true,
        transactionRef: true,
        status: true,
        note: true,
        createdAt: true,
        reviewedAt: true,
      },
    }),
    prisma.wallet.findUnique({
      where: { memberId: session.user.id },
      select: { availablePaisa: true },
    }),
  ]);

  const initialRequests: TopUpRequest[] = requests.map((request) => ({
    requestNumber: request.requestNumber,
    amountPaisa: request.amountPaisa.toString(),
    method: request.method as TopUpMethod,
    transactionRef: request.transactionRef,
    status: request.status,
    note: request.note,
    createdAt: request.createdAt.toISOString(),
    reviewedAt: request.reviewedAt?.toISOString() ?? null,
  }));

  return (
    <div className="space-y-8 animate-rise">
      <PageHeader
        eyebrow={tn("wallet")}
        title={tm("topUpTitle")}
        intro={tm("topUpIntro")}
        icon={<Plus className="size-3.5" aria-hidden="true" />}
      />
      <TopUpForm
        accounts={accounts}
        initialRequests={initialRequests}
        locale={locale}
        availablePaisa={wallet?.availablePaisa ?? 0n}
      />
    </div>
  );
}
