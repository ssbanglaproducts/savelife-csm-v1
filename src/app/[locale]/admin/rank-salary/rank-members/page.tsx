import { getTranslations } from "next-intl/server";
import { RankMembersContent } from "@/components/admin/rank-salary/rank-members-content";

export const dynamic = "force-dynamic";

export default async function RankMembersPage() {
  const ta = await getTranslations("adminPanel");

  return (
    <div className="space-y-5 animate-rise">
      <header className="flex flex-wrap items-center gap-2">
        <h1 className="font-display text-xl font-bold tracking-tight sm:text-2xl">
          {ta("rankMembersTitle")}
        </h1>
        <span className="inline-flex items-center self-center whitespace-nowrap rounded-full bg-primary/15 px-2.5 py-1 text-xs font-semibold text-primary ring-1 ring-inset ring-primary/30">
          {ta("rankConfigRanksCount")}
        </span>
      </header>
      <RankMembersContent />
    </div>
  );
}
