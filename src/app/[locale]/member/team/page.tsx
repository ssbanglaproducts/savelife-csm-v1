import { setRequestLocale } from "next-intl/server";
import { auth } from "@/auth";
import { redirect } from "@/i18n/navigation";
import { TeamWorkspace } from "@/components/member/team-workspace";
import { prisma } from "@/lib/prisma";
import {
  getGenealogyView,
  getTeamPerformance,
  serializeTeamPerformance,
} from "@/lib/services/team-performance";

export const dynamic = "force-dynamic";

export default async function TeamPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const session = await auth();
  if (!session?.user?.id) {
    redirect({ href: "/login", locale });
    return null;
  }

  const [view, performance] = await Promise.all([
    getGenealogyView(prisma, session.user.id, session.user.id),
    getTeamPerformance(prisma, session.user.id, new Date()),
  ]);
  if (!view) {
    redirect({ href: "/login", locale });
    return null;
  }

  return (
    <TeamWorkspace
      initialView={view}
      performance={serializeTeamPerformance(performance)}
      viewerMemberId={session.user.memberId}
    />
  );
}
