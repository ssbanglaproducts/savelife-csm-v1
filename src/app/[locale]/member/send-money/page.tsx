import { getTranslations, setRequestLocale } from "next-intl/server";
import { Send } from "lucide-react";
import { auth } from "@/auth";
import { PageHeader } from "@/components/member/page-header";
import { SendMoneyForm } from "@/components/member/send-money-form";
import { redirect } from "@/i18n/navigation";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function SendMoneyPage({
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

  const [wallet, member] = await Promise.all([
    prisma.wallet.findUnique({
      where: { memberId: session.user.id },
      select: { availablePaisa: true },
    }),
    prisma.member.findUnique({
      where: { id: session.user.id },
      select: { memberId: true },
    }),
  ]);

  return (
    <div className="space-y-8 animate-rise">
      <PageHeader
        eyebrow={tn("wallet")}
        title={tm("sendMoneyTitle")}
        intro={tm("sendMoneyIntro")}
        icon={<Send className="size-3.5" aria-hidden="true" />}
      />
      <SendMoneyForm
        availablePaisa={wallet?.availablePaisa ?? 0n}
        currentMemberId={member?.memberId ?? ""}
      />
    </div>
  );
}
