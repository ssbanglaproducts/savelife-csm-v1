"use client";

import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";
import { CopyableMemberId } from "@/components/member/copyable-member-id";
import { RankBadge } from "@/components/ui/rank-badge";
import { UserAvatar } from "@/components/ui/user-avatar";
import { localizedRankName } from "@/lib/rank-label";
import { rankAccent } from "@/lib/rank-accent";
import { formatSP, formatTaka } from "@/lib/money";
import { cn } from "@/lib/utils";
import type {
  IndividualPerformanceDto,
  TeamPersonSummary,
} from "@/lib/services/team-performance";
import { TeamDialog } from "./team-dialog";

export function TeamMemberDialog({
  member,
  onClose,
}: {
  member: TeamPersonSummary;
  onClose: () => void;
}) {
  const t = useTranslations("memberPanel");
  const locale = useLocale();

  const query = useQuery({
    queryKey: ["team-member-performance", member.id],
    queryFn: async (): Promise<IndividualPerformanceDto> => {
      const response = await fetch(
        `/api/member/team/member-performance?memberId=${encodeURIComponent(member.memberId)}`,
        { cache: "no-store" },
      );
      if (!response.ok) throw new Error("Unable to load member performance");
      const data = (await response.json()) as { performance: IndividualPerformanceDto };
      return data.performance;
    },
    retry: false,
  });

  const rankStyle = query.data?.member.rank
    ? rankAccent(query.data.member.rank.rankKey)
    : null;

  return (
    <TeamDialog title={t("teamMemberStatsTitle")} onClose={onClose}>
      {query.isLoading ? (
        <div className="flex min-h-40 items-center justify-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        </div>
      ) : null}

      {query.isError ? (
        <p role="alert" className="text-sm text-red-600 dark:text-red-300">
          {t("teamLoadFailed")}
        </p>
      ) : null}

      {query.data ? (
        <div className="space-y-5">
          <div className="flex items-center gap-3">
            <UserAvatar
              name={query.data.member.fullName}
              src={query.data.member.profileImage}
              className="size-14 rounded-2xl"
            />
            <div className="min-w-0 flex-1">
              <p className="truncate font-display text-lg font-bold">{query.data.member.fullName}</p>
              <CopyableMemberId memberId={query.data.member.memberId} className="text-xs" />
              <p className="mt-1 text-xs font-semibold text-primary">
                {query.data.member.status === "ACTIVE"
                  ? t("teamStatusActive")
                  : t("teamStatusInactive")}
              </p>
            </div>
            <span
              className={cn(
                "ml-auto inline-flex shrink-0 items-center gap-1.5 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary",
                rankStyle?.softChip,
              )}
            >
              {query.data.member.rank ? (
                <RankBadge
                  src={query.data.member.rank.badgeImageUrl}
                  rankKey={query.data.member.rank.rankKey}
                  size={36}
                  className="-my-2"
                />
              ) : null}
              <span className={cn("truncate", rankStyle?.title)}>
                {query.data.member.rank
                  ? localizedRankName(query.data.member.rank, locale)
                  : t("noRankYet")}
              </span>
            </span>
          </div>

          <dl className="grid gap-3 sm:grid-cols-2">
            <Stat label={t("teamTotalTeamMembers")} value={String(query.data.totalTeamMembers)} />
            <Stat
              label={t("teamActiveTeamMembers")}
              value={String(query.data.activeTeamMembers)}
            />
            <Stat
              label={t("teamInvestmentGenerated")}
              value={formatTaka(BigInt(query.data.investmentPaisa), "en")}
              wide
            />
            <Stat
              label={t("teamOwnEarnings")}
              value={formatSP(BigInt(query.data.individualEarningsPaisa))}
              wide
            />
          </dl>
        </div>
      ) : null}
    </TeamDialog>
  );
}

function Stat({ label, value, wide = false }: { label: string; value: string; wide?: boolean }) {
  return (
    <div className={`rounded-2xl border border-border p-4 ${wide ? "sm:col-span-2" : ""}`}>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-2 truncate font-display text-lg font-bold tabular-nums">{value}</dd>
    </div>
  );
}
