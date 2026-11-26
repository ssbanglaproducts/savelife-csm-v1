import { getTranslations, setRequestLocale } from "next-intl/server";
import { Trophy } from "lucide-react";
import { auth } from "@/auth";
import { redirect } from "@/i18n/navigation";
import { RankRewardsWorkspace } from "@/components/member/rank-rewards-workspace";
import { PageHeader } from "@/components/member/page-header";
import { prisma } from "@/lib/prisma";
import { getMemberSalaryData } from "@/lib/services/member-salary";
import {
  evaluateMemberRanks,
  getMemberRankData,
} from "@/lib/services/rank-rewards";

export const dynamic = "force-dynamic";

export default async function MemberRankRewardsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const [session, tm] = await Promise.all([auth(), getTranslations("memberPanel")]);
  if (!session?.user?.id) {
    redirect({ href: "/login", locale });
    return null;
  }

  // Existing members are evaluated on first visit; achievements and wallet
  // credits are idempotent, so a refresh cannot pay a rank twice.
  try {
    await evaluateMemberRanks(prisma, session.user.id);
  } catch (error) {
    console.error("Rank evaluation on page load failed", error);
  }

  const [data, salary] = await Promise.all([
    getMemberRankData(prisma, session.user.id),
    getMemberSalaryData(prisma, session.user.id),
  ]);

  return (
    <div className="space-y-6 animate-rise">
      <div className="hidden sm:block">
        <PageHeader
          eyebrow={tm("rankRewardsTitle")}
          title={tm("ranksRewardsTitle")}
          intro={tm("rankRewardsIntro")}
          icon={<Trophy className="size-3.5" aria-hidden="true" />}
        />
      </div>
      <RankRewardsWorkspace initialData={data} initialSalary={salary} />
    </div>
  );
}
