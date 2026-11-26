import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { RankMembersContent } from "@/components/admin/rank-salary/rank-members-content";
import { isSalaryRankKey } from "@/lib/salary";

export const dynamic = "force-dynamic";

export default async function RankMembersRankPage({
  params,
}: {
  params: Promise<{ rankKey: string }>;
}) {
  const { rankKey } = await params;
  if (!isSalaryRankKey(rankKey)) notFound();

  const ta = await getTranslations("adminPanel");

  return (
    <div className="space-y-5 animate-rise">
      <header>
        <h1 className="font-display text-xl font-bold tracking-tight sm:text-2xl">
          {ta("rankMembersTitle")}
        </h1>
      </header>
      <RankMembersContent rankKey={rankKey} />
    </div>
  );
}
