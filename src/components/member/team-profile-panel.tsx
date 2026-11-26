"use client";

import { useTranslations } from "next-intl";
import { ArrowUpRight, Building2, Info, Users } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { buttonVariants } from "@/components/ui/button";
import { RankBadge } from "@/components/ui/rank-badge";
import { statusLabelKey } from "@/components/member/status-labels";
import { localizedRankName } from "@/lib/rank-label";
import { rankAccent } from "@/lib/rank-accent";
import { formatSP } from "@/lib/money";
import { cn } from "@/lib/utils";
import type { TeamOverviewDto } from "@/lib/services/team";
import { StatusPill, TeamAvatar } from "./team-ui";

type Details = NonNullable<TeamOverviewDto["details"]>;

export function TeamProfilePanel({ details, locale }: { details: Details | null; locale: string }) {
  const t = useTranslations("memberPanel");

  if (!details) {
    return (
      <aside className="glass h-fit rounded-3xl p-6" aria-live="polite">
        <h2 className="font-display text-base font-bold">{t("teamProfileTitle")}</h2>
        <div className="mt-8 rounded-2xl border border-dashed border-border px-4 py-12 text-center">
          <Users className="mx-auto size-6 text-muted-foreground" aria-hidden="true" />
          <p className="mt-3 text-sm text-muted-foreground">{t("teamSelectMember")}</p>
        </div>
      </aside>
    );
  }

  const joined = new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(
    new Date(details.joinedAt),
  );
  const rankStyle = details.rank ? rankAccent(details.rank.rankKey) : null;
  const futureItems = [
    { label: t("teamRankProgress"), value: t("rankComingSoon") },
    { label: t("teamPlacementBasedRewards"), value: t("placementRewardsComingSoon") },
    { label: t("teamPerformanceRewards"), value: t("rankComingSoon") },
    { label: t("teamAchievementRewards"), value: t("rankComingSoon") },
  ];

  return (
    <aside className="glass h-fit rounded-3xl p-5 sm:p-6" aria-live="polite">
      <h2 className="font-display text-base font-bold">{t("teamProfileTitle")}</h2>

      <div className="mt-5 flex min-w-0 items-start gap-3">
        <TeamAvatar name={details.fullName} image={details.profileImage} className="size-12" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold">{details.fullName}</p>
          <p
            className="mt-0.5 truncate font-mono text-[11px] text-muted-foreground"
            translate="no"
          >
            {details.memberId}
          </p>
          <div className="mt-2">
            <StatusPill label={t(statusLabelKey(details.status))} />
          </div>
        </div>
      </div>

      <Link
        href={`/member/team?member=${encodeURIComponent(details.memberId)}`}
        className={`${buttonVariants({ variant: "outline", size: "sm" })} mt-5 w-full`}
      >
        {t("teamViewTeam")}
        <ArrowUpRight className="size-3.5" aria-hidden="true" />
      </Link>

      <Panel title={t("teamProfileOverview")}>
        <div
          className={cn(
            "flex items-center justify-between gap-3 rounded-xl border border-border/70 px-3 py-2.5",
            rankStyle?.border,
          )}
        >
          <span className="text-[11px] font-semibold text-muted-foreground">{t("rank")}</span>
          <span className="flex min-w-0 items-center gap-1.5 text-sm font-semibold">
            {details.rank ? (
              <RankBadge
                src={details.rank.badgeImageUrl}
                rankKey={details.rank.rankKey}
                size={40}
              />
            ) : null}
            <span className={cn("truncate", rankStyle?.title)}>
              {details.rank ? localizedRankName(details.rank, locale) : t("noRankYet")}
            </span>
          </span>
        </div>
        <Detail label={t("joiningDate")} value={joined} />
        <Detail label={t("teamSize")} value={String(details.teamMembers)} />
        <Detail label={t("teamActiveTeamMembers")} value={String(details.activeTeamMembers)} />
      </Panel>

      <Panel title={t("teamRelationships")}>
        <Detail
          label={t("sponsor")}
          value={
            details.sponsor
              ? `${details.sponsor.memberId} — ${details.sponsor.fullName}`
              : "—"
          }
        />
        <Detail
          label={t("placementParent")}
          value={
            details.placementParent
              ? `${details.placementParent.memberId} — ${details.placementParent.fullName}`
              : "—"
          }
        />
      </Panel>

      <Panel title={t("teamPerformanceSection")}>
        <Detail label={t("teamInvestment")} value={formatSP(BigInt(details.teamInvestmentPaisa))} />
        <Detail label={t("teamReturnsSummary")} value={formatSP(BigInt(details.teamReturnsPaisa))} />
        <Detail
          label={t("teamAffiliateRewards")}
          value={formatSP(BigInt(details.teamAffiliateRewardsPaisa))}
        />
        <p className="mt-3 flex gap-2 rounded-xl bg-muted/60 p-3 text-[11px] leading-relaxed text-muted-foreground">
          <Info className="mt-0.5 size-3.5 shrink-0 text-primary" aria-hidden="true" />
          {t("teamAffiliateRewardsInfo")}
        </p>
      </Panel>

      <Panel title={t("teamPlacementSection")}>
        <Detail
          label={t("teamDirectPlacementMembers")}
          value={String(details.directPlacements)}
        />
        <Detail
          label={t("teamOccupiedPositions")}
          value={`${details.occupiedSlots}/3`}
        />
        <Detail label={t("teamAvailablePositions")} value={String(3 - details.occupiedSlots)} />
        <div className="mt-3 flex gap-1.5" aria-hidden="true">
          {[1, 2, 3].map((slot) => (
            <span
              key={slot}
              className={`h-1.5 flex-1 rounded-full ${
                slot <= details.occupiedSlots ? "bg-primary" : "bg-muted"
              }`}
            />
          ))}
        </div>
        <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
          {t("teamPlacementHint")}
        </p>
      </Panel>

      <Panel title={t("teamFutureSection")}>
        <div className="space-y-2">
          {futureItems.map((item) => (
            <div
              key={item.label}
              className="flex items-center justify-between gap-3 rounded-xl border border-border/70 px-3 py-2.5"
            >
              <span className="flex min-w-0 items-center gap-2 text-xs font-semibold text-muted-foreground">
                <Building2 className="size-3.5 shrink-0" aria-hidden="true" />
                <span className="truncate">{item.label}</span>
              </span>
              <span className="shrink-0 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                {item.value}
              </span>
            </div>
          ))}
        </div>
      </Panel>
    </aside>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-6 border-t border-border pt-5">
      <h3 className="text-[11px] font-bold uppercase tracking-[0.12em] text-primary">{title}</h3>
      <div className="mt-4 space-y-3">{children}</div>
    </section>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] font-semibold text-muted-foreground">{label}</p>
      <p className="mt-0.5 break-words text-sm font-semibold" translate="no">
        {value}
      </p>
    </div>
  );
}
