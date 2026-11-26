"use client";

import { useState, type KeyboardEvent, type ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  Check,
  ChevronDown,
  ChevronUp,
  Info,
  Lock,
  RefreshCw,
  Trophy,
} from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "@/i18n/navigation";
import { rankAccent } from "@/lib/rank-accent";
import { formatSP } from "@/lib/money";
import { cn } from "@/lib/utils";
import type { SalaryPlanRankDto } from "@/lib/services/salary-plan";
import { RankBadge as Badge } from "@/components/ui/rank-badge";
import { UserAvatar } from "@/components/ui/user-avatar";
import { SalaryTab } from "./salary-tab";
import type { MemberSalaryDto } from "@/lib/services/member-salary";
import type {
  MemberRankDto,
  NextRankDto,
  RankHistoryDto,
  RankRewardDto,
  RankRowDto,
} from "@/lib/services/rank-rewards";
import { formatMemberDate } from "./format-date";

type Tab = "overview" | "all" | "salary";
type Translator = (key: string, values?: Record<string, string | number>) => string;
type ProgressStatus = "completed" | "inProgress" | "notStarted";
type RankViewStatus = "achieved" | "currentTarget" | "upcoming";

function localizedName(value: { name: string; nameBn: string | null }, locale: string): string {
  return locale === "bn" && value.nameBn ? value.nameBn : value.name;
}

function rewardText(reward: RankRewardDto, locale: string, t: Translator): string {
  if (reward.type === "SP") {
    return formatSP(BigInt(reward.amountPaisa ?? "0"));
  }
  const label = locale === "bn" && reward.labelBn ? reward.labelBn : reward.label;
  return label ?? t("physicalReward");
}

function progressStatus(completed: boolean, hasValue: boolean): ProgressStatus {
  if (completed) return "completed";
  return hasValue ? "inProgress" : "notStarted";
}

function statusText(t: Translator, status: ProgressStatus): string {
  if (status === "completed") return t("completed");
  if (status === "inProgress") return t("inProgress");
  return t("notStarted");
}

function statusClasses(status: ProgressStatus): string {
  if (status === "completed") {
    return "bg-emerald-500/15 text-emerald-700 ring-emerald-500/30 dark:text-emerald-300";
  }
  if (status === "inProgress") {
    return "bg-amber-500/15 text-amber-700 ring-amber-500/30 dark:text-amber-300";
  }
  return "bg-muted text-muted-foreground ring-border";
}

function percent(value: bigint, target: bigint): number {
  if (target <= 0n) return value > 0n ? 100 : 0;
  const calculated = (value * 100n) / target;
  return Number(calculated > 100n ? 100n : calculated);
}

function StatusPill({
  status,
  t,
  label,
}: {
  status: ProgressStatus;
  t: Translator;
  label?: string;
}) {
  return (
    <span
      className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-bold ring-1 ring-inset ${statusClasses(status)}`}
    >
      {label ?? statusText(t, status)}
    </span>
  );
}

function InfoDot({ text }: { text: string }) {
  return (
    <span role="img" aria-label={text} title={text} className="inline-flex cursor-help text-muted-foreground">
      <Info className="size-3.5" aria-hidden="true" />
    </span>
  );
}

function Section({
  title,
  info,
  children,
}: {
  title: string;
  info?: string;
  children: ReactNode;
}) {
  return (
    <section className="glass rounded-2xl p-4 sm:p-5">
      <div className="flex items-center gap-2">
        <h2 className="text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">{title}</h2>
        {info ? <InfoDot text={info} /> : null}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function MobileRankHeader({
  rank,
  t,
  locale,
}: {
  rank: MemberRankDto["currentRank"];
  t: Translator;
  locale: string;
}) {
  if (!rank) {
    return (
      <section className="glass flex items-center rounded-2xl px-4 py-3 sm:hidden">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
            {t("currentRankLabel")}
          </p>
          <p className="mt-0.5 truncate font-display text-base font-bold">{t("noRankYet")}</p>
        </div>
      </section>
    );
  }

  const accent = rankAccent(rank.rankKey);

  return (
    <section
      className={cn(
        "relative flex items-center justify-between gap-3 overflow-hidden rounded-2xl border border-amber-400/35 bg-gradient-to-r from-amber-300/20 via-amber-500/10 to-transparent px-4 py-3 sm:hidden",
        accent.border,
        accent.gradient,
      )}
    >
      <div
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute -right-12 -top-16 size-40 rounded-full bg-amber-400/15 blur-2xl",
          accent.glow,
        )}
      />
      <div className="relative flex min-w-0 items-center gap-2.5">
        <Badge src={rank.badgeImageUrl} rankKey={rank.rankKey} size={64} />
        <div className="min-w-0">
          <p
            className={cn(
              "text-[10px] font-bold uppercase tracking-[0.14em] text-amber-700 dark:text-amber-300",
              accent.eyebrow,
            )}
          >
            {t("currentRankLabel")}
          </p>
          <p
            className={cn(
              "truncate font-display text-base font-bold text-amber-900 dark:text-amber-100",
              accent.title,
            )}
          >
            {localizedName(rank, locale)}
          </p>
        </div>
      </div>
      <div className="relative shrink-0 text-right">
        <p
          className={cn(
            "text-[10px] font-bold uppercase tracking-wider text-amber-700/80 dark:text-amber-300/80",
            accent.value,
          )}
        >
          {t("reward")}
        </p>
        <p
          className={cn(
            "mt-0.5 text-sm font-bold tabular-nums text-amber-900 dark:text-amber-100",
            accent.title,
          )}
        >
          {rewardText(rank.reward, locale, t)}
        </p>
      </div>
    </section>
  );
}

function CurrentRankCard({
  rank,
  t,
  locale,
}: {
  rank: MemberRankDto["currentRank"];
  t: Translator;
  locale: string;
}) {
  if (!rank) {
    return (
      <section className="glass hidden rounded-2xl p-4 sm:block">
        <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
          {t("currentRankLabel")}
        </p>
        <p className="mt-2 font-display text-xl font-bold">{t("noRankYet")}</p>
      </section>
    );
  }

  const rewardStatus: ProgressStatus =
    rank.status === "ACHIEVED" ? "completed" : rank.status === "PENDING" ? "inProgress" : "notStarted";
  const rewardStatusLabel =
    rank.status === "ACHIEVED"
      ? t("statusAchieved")
      : rank.status === "PENDING"
        ? t("statusPending")
        : t("statusNotAchieved");

  const accent = rankAccent(rank.rankKey);

  return (
    <section
      className={cn(
        "relative hidden overflow-hidden rounded-2xl border border-amber-400/35 bg-gradient-to-r from-amber-300/20 via-amber-500/10 to-transparent p-4 sm:block",
        accent.border,
        accent.gradient,
      )}
    >
      <div
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute -right-14 -top-20 size-44 rounded-full bg-amber-400/15 blur-2xl",
          accent.glow,
        )}
      />
      <div className="relative flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
        <div className="flex min-w-0 items-center gap-3">
          <Badge src={rank.badgeImageUrl} rankKey={rank.rankKey} size={76} preload />
          <div className="min-w-0">
            <p
              className={cn(
                "text-[10px] font-bold uppercase tracking-[0.16em] text-amber-700 dark:text-amber-300",
                accent.eyebrow,
              )}
            >
              {t("currentRankLabel")}
            </p>
            <p
              className={cn(
                "font-display text-xl font-bold text-amber-900 dark:text-amber-100",
                accent.title,
              )}
            >
              {localizedName(rank, locale).toUpperCase()}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4 sm:gap-5">
          <div>
            <p
              className={cn(
                "text-[10px] font-bold uppercase tracking-wider text-amber-700/80 dark:text-amber-300/80",
                accent.value,
              )}
            >
              {t("reward")}
            </p>
            <p
              className={cn(
                "mt-0.5 text-lg font-bold tabular-nums text-amber-900 dark:text-amber-100",
                accent.title,
              )}
            >
              {rewardText(rank.reward, locale, t)}
            </p>
          </div>
          <div className={cn("h-9 w-px bg-amber-400/30", accent.divider)} aria-hidden="true" />
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-amber-700/80 dark:text-amber-300/80">
              {t("status")}
            </p>
            <div className="mt-1">
              <StatusPill status={rewardStatus} t={t} label={rewardStatusLabel} />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function NextRankCard({
  nextRank,
  overall,
  t,
  locale,
}: {
  nextRank: NextRankDto | null;
  overall: ProgressStatus;
  t: Translator;
  locale: string;
}) {
  if (!nextRank) {
    return (
      <Section title={t("nextRank")}>
        <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">
          {t("nextRankNone")}
        </p>
      </Section>
    );
  }

  const accent = rankAccent(nextRank.rankKey);

  return (
    <Section title={t("nextRank")}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Badge src={nextRank.badgeImageUrl} rankKey={nextRank.rankKey} size={64} />
          <div className="min-w-0">
            <p
              className={cn("font-display text-xl font-bold", accent.title)}
            >
              {localizedName(nextRank, locale).toUpperCase()}
            </p>
            <p
              className={cn("mt-0.5 text-xs font-semibold text-muted-foreground", accent.value)}
            >
              {t("reward")}: {rewardText(nextRank.reward, locale, t)}
            </p>
          </div>
        </div>
        <StatusPill status={overall} t={t} />
      </div>
      <p className="mt-3 text-[11px] text-muted-foreground">{t("eitherMethodNote")}</p>
    </Section>
  );
}

function ThreeTeamSection({ nextRank, t }: { nextRank: NextRankDto; t: Translator }) {
  const totals = nextRank.teamTotalsPaisa.map((value) => BigInt(value));
  const targets = nextRank.teamTargetsPaisa.map((value) => BigInt(value));
  const lead = targets[0] ?? 0n;
  const higher = targets[1] ?? 0n;
  const lower = targets[2] ?? 0n;
  const scale = [lead, ...totals].reduce((max, value) => (value > max ? value : max), 1n);

  const markers: Array<{ label: string; value: bigint }> = [];
  if (lead > higher) markers.push({ label: t("leadTarget"), value: lead });
  markers.push({ label: t("higherTarget"), value: higher });
  markers.push({ label: t("lowerTarget"), value: lower });

  const hasValue = totals.some((total) => total > 0n);
  const status = progressStatus(nextRank.teamQualified, hasValue);

  return (
    <Section title={t("threeTeamQualification")} info={t("teamTooltip")}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">{t("flexibleRuleShort")}</p>
        <StatusPill status={status} t={t} />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        {totals.map((total, index) => {
          const complete = total >= higher;
          const width = percent(total, scale);
          return (
            <div key={index} className="min-w-0 rounded-xl border border-border/60 bg-background/40 p-3">
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="font-semibold text-muted-foreground">{t(`team${index + 1}`)}</span>
                <span className="font-bold tabular-nums">{formatSP(total)}</span>
              </div>
              <div className="relative mt-3 h-2.5 overflow-visible rounded-full bg-muted">
                <div
                  className={`h-full rounded-full ${complete ? "bg-emerald-500" : "bg-amber-500/70"}`}
                  style={{ width: `${width}%` }}
                />
                {markers.map((marker, markerIndex) => (
                  <span
                    key={`${marker.label}-${markerIndex}`}
                    title={`${marker.label}: ${formatSP(marker.value)}`}
                    className="absolute -top-1 h-4.5 w-0.5 rounded bg-foreground/45"
                    style={{ left: `${percent(marker.value, scale)}%` }}
                  />
                ))}
              </div>
              <div className="mt-2 flex flex-wrap gap-x-2 gap-y-1 text-[10px] text-muted-foreground">
                {markers.map((marker, markerIndex) => (
                  <span key={`${marker.label}-value-${markerIndex}`}>
                    {marker.label}: {formatSP(marker.value)}
                  </span>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </Section>
  );
}

function DirectSponsorSection({
  nextRank,
  best,
  t,
  locale,
}: {
  nextRank: NextRankDto;
  best: MemberRankDto["progress"]["bestDirectInvestment"];
  t: Translator;
  locale: string;
}) {
  const target = BigInt(nextRank.directTargetPaisa);
  const amount = best ? BigInt(best.amountPaisa) : 0n;
  const remaining = target > amount ? target - amount : 0n;
  const status = progressStatus(nextRank.directQualified, amount > 0n);

  return (
    <Section title={t("directSponsorQualification")} info={t("directTooltip")}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">{t("oneReferral")} · {t("singleTransaction")}</p>
        <StatusPill status={status} t={t} />
      </div>
      {!best ? (
        <div className="rounded-xl border border-dashed border-border/70 bg-background/40 px-4 py-8 text-center">
          <Trophy className="mx-auto size-6 text-muted-foreground" aria-hidden="true" />
          <p className="mt-2 text-sm font-semibold">{t("noDirectInvestment")}</p>
          <p className="mt-1 text-xs text-muted-foreground">{t("noDirectInvestmentDetail")}</p>
        </div>
      ) : (
        <div className="rounded-xl border border-border/60 bg-background/40 p-4">
          <div className="flex items-center gap-3">
            <UserAvatar name={best.referralName} src={best.profileImage} className="size-12 rounded-2xl" />
            <div className="min-w-0">
              <p className="truncate text-sm font-bold">{best.referralName}</p>
              <p className="text-xs text-muted-foreground">
                {t("memberId")}: {best.referralMemberId}
              </p>
            </div>
          </div>
          <div className="mt-4 grid gap-2 text-xs sm:grid-cols-2">
            <div className="flex justify-between gap-2 rounded-lg bg-muted/50 px-3 py-2">
              <span className="text-muted-foreground">{t("highestSingleInvestment")}</span>
              <span className="font-bold tabular-nums">{formatSP(amount)}</span>
            </div>
            <div className="flex justify-between gap-2 rounded-lg bg-muted/50 px-3 py-2">
              <span className="text-muted-foreground">{t("requiredTarget")}</span>
              <span className="font-bold tabular-nums">{formatSP(target)}</span>
            </div>
          </div>
          <div className="relative mt-4 h-2.5 rounded-full bg-muted">
            <div
              className={`h-full rounded-full ${nextRank.directQualified ? "bg-emerald-500" : "bg-amber-500/70"}`}
              style={{ width: `${percent(amount, target)}%` }}
            />
          </div>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="font-semibold tabular-nums">
              {percent(amount, target)}% {t("percentCompleted")}
            </span>
            <span className="text-muted-foreground">
              {t("remainingSp")}: <span className="font-semibold tabular-nums">{formatSP(remaining)}</span>
            </span>
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">
            {t("fromReferral")}: {best.investmentNumber} · {formatMemberDate(new Date(best.investedAt), locale, true)}
          </p>
        </div>
      )}
    </Section>
  );
}

function OverallSection({
  nextRank,
  best,
  t,
}: {
  nextRank: NextRankDto;
  best: MemberRankDto["progress"]["bestDirectInvestment"];
  t: Translator;
}) {
  const teamStatus = progressStatus(
    nextRank.teamQualified,
    nextRank.teamTotalsPaisa.some((value) => BigInt(value) > 0n),
  );
  const directStatus = progressStatus(
    nextRank.directQualified,
    best ? BigInt(best.amountPaisa) > 0n : false,
  );
  const overall = progressStatus(
    nextRank.teamQualified || nextRank.directQualified,
    teamStatus !== "notStarted" || directStatus !== "notStarted",
  );

  return (
    <Section title={t("overallQualification")}>
      <div className="grid gap-2 sm:grid-cols-2">
        <div className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-background/40 px-3 py-2.5">
          <span className="text-xs font-semibold">{t("threeTeamQualification")}</span>
          <StatusPill status={teamStatus} t={t} />
        </div>
        <div className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-background/40 px-3 py-2.5">
          <span className="text-xs font-semibold">{t("directSponsorQualification")}</span>
          <StatusPill status={directStatus} t={t} />
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between gap-3 rounded-xl bg-muted/40 px-3 py-2.5">
        <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{t("status")}</span>
        <StatusPill status={overall} t={t} />
      </div>
    </Section>
  );
}

function RankJourney({ data, t, locale }: { data: MemberRankDto; t: Translator; locale: string }) {
  return (
    <Section title={t("rankJourney")}>
      <div className="flex flex-wrap gap-2">
        {data.ranks.map((rank) => {
          const status: RankViewStatus = rank.achievedAt
            ? "achieved"
            : rank.rankKey === data.nextRank?.rankKey
              ? "currentTarget"
              : "upcoming";
          const accent = rankAccent(rank.rankKey);
          const ring =
            status === "achieved"
              ? "ring-2 ring-emerald-500/60"
              : status === "currentTarget"
                ? "ring-2 ring-amber-500/60"
                : "ring-1 ring-border opacity-75";
          return (
            <div
              key={rank.rankKey}
              title={status === "achieved" ? t("statusAchieved") : status === "currentTarget" ? t("currentTarget") : t("upcoming")}
              className={cn(
                "flex min-w-[7.5rem] items-center gap-2 rounded-xl border border-border/60 bg-background/40 px-2.5 py-2",
                ring,
                accent.border,
              )}
            >
              <Badge src={rank.badgeImageUrl} rankKey={rank.rankKey} size={40} />
              <span className={cn("truncate text-[11px] font-bold", accent.title)}>
                {localizedName(rank, locale)}
              </span>
              {status === "achieved" ? (
                <Check className="ml-auto size-3.5 shrink-0 text-emerald-600" aria-hidden="true" />
              ) : status === "upcoming" ? (
                <Lock className="ml-auto size-3 shrink-0 text-muted-foreground" aria-hidden="true" />
              ) : null}
            </div>
          );
        })}
      </div>
    </Section>
  );
}

function History({ history, t, locale }: { history: RankHistoryDto[]; t: Translator; locale: string }) {
  return (
    <Section title={t("achievementHistory")}>
      {history.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("noHistory")}</p>
      ) : (
        <div className="space-y-2">
          {history.map((entry) => {
            const reward: RankRewardDto = {
              type: entry.rewardType,
              amountPaisa: entry.rewardSpPaisa,
              label: entry.rewardLabel,
              labelBn: entry.rewardLabelBn,
              imageUrl: entry.rewardImageUrl,
            };
            const rewardStatus: ProgressStatus =
              entry.rewardStatus === "ACHIEVED" ? "completed" : "inProgress";
            const rewardStatusLabel =
              entry.rewardStatus === "ACHIEVED" ? t("statusAchieved") : t("statusPending");
            const accent = rankAccent(entry.rankKey);
            return (
              <div
                key={entry.id}
                className={cn(
                  "flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/60 bg-background/40 px-3 py-2.5",
                  accent.border,
                )}
              >
                <div className="flex min-w-0 items-center gap-2">
                  <Badge src={entry.badgeImageUrl} rankKey={entry.rankKey} size={40} />
                  <div className="min-w-0">
                    <p className={cn("truncate text-xs font-bold", accent.title)}>
                      {localizedName({ name: entry.rankName, nameBn: entry.rankNameBn }, locale)}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {t("achievedOn")}: {formatMemberDate(new Date(entry.achievedAt), locale)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold tabular-nums">{rewardText(reward, locale, t)}</span>
                  <StatusPill status={rewardStatus} t={t} label={rewardStatusLabel} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Section>
  );
}

function rankStatus(
  row: RankRowDto,
  nextRankKey: string | undefined,
): RankViewStatus {
  if (row.achievedAt) return "achieved";
  if (row.rankKey === nextRankKey) return "currentTarget";
  return "upcoming";
}

function rankStatusText(t: Translator, status: RankViewStatus): string {
  if (status === "achieved") return t("statusAchieved");
  if (status === "currentTarget") return t("currentTarget");
  return t("upcoming");
}

function AllRanks({
  data,
  salaryRanks,
  expandedKey,
  onToggle,
  onViewSalaryDetails,
  t,
  locale,
}: {
  data: MemberRankDto;
  salaryRanks: readonly SalaryPlanRankDto[];
  expandedKey: string | null;
  onToggle: (key: string) => void;
  onViewSalaryDetails: () => void;
  t: Translator;
  locale: string;
}) {
  return (
    <div className="space-y-3">
      {data.ranks.map((row) => {
        const status = rankStatus(row, data.nextRank?.rankKey);
        const expanded = expandedKey === row.rankKey;
        const targets = row.teamTargetsPaisa.map((value) => BigInt(value));
        const lead = targets[0] ?? 0n;
        const higher = targets[1] ?? 0n;
        const lower = targets[2] ?? 0n;
        const reward: RankRewardDto = {
          type: row.rewardType,
          amountPaisa: row.rewardSpPaisa,
          label: row.rewardLabel,
          labelBn: row.rewardLabelBn,
          imageUrl: row.rewardImageUrl,
        };
        const salaryConfig = salaryRanks.find((rank) => rank.rankKey === row.rankKey);
        const salaryEnabled = salaryConfig?.enabled === true;
        const salaryWeeks =
          salaryConfig?.maxWeeks === null || salaryConfig?.maxWeeks === undefined
            ? null
            : Number.parseInt(salaryConfig.maxWeeks, 10);

        const accent = rankAccent(row.rankKey);

        return (
          <section
            key={row.rankKey}
            style={accent.backgroundImage ? { backgroundImage: accent.backgroundImage } : undefined}
            className={cn("glass rounded-2xl", accent.border)}
          >
            <button
              type="button"
              aria-expanded={expanded}
              onClick={() => onToggle(row.rankKey)}
              className="flex w-full items-center gap-3 px-4 py-3 text-left sm:px-5"
            >
              <Badge
                src={row.badgeImageUrl}
                rankKey={row.rankKey}
                size={56}
                className={status === "upcoming" ? "opacity-75" : undefined}
              />
              <span className="min-w-0 flex-1">
                <span className={cn("block truncate text-sm font-bold", accent.title)}>
                  {localizedName(row, locale)}
                </span>
                <span
                  className={cn(
                    "block truncate text-xs font-semibold text-amber-700 dark:text-amber-300",
                    accent.value,
                  )}
                >
                  {rewardText(reward, locale, t)}
                </span>
              </span>
              <span
                className={`whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-bold ring-1 ring-inset ${
                  status === "achieved"
                    ? "bg-emerald-500/15 text-emerald-700 ring-emerald-500/30 dark:text-emerald-300"
                    : status === "currentTarget"
                      ? "bg-amber-500/15 text-amber-700 ring-amber-500/30 dark:text-amber-300"
                      : "bg-muted text-muted-foreground ring-border"
                }`}
              >
                {rankStatusText(t, status)}
              </span>
              {expanded ? (
                <ChevronUp className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              ) : (
                <ChevronDown className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              )}
            </button>

            {expanded ? (
              <div className="grid gap-3 border-t border-border/60 bg-background/30 px-4 py-4 sm:grid-cols-2 sm:px-5">
                <div className="rounded-xl border border-border/60 p-3">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    {t("threeTeamQualification")}
                  </p>
                  <div className="mt-2 space-y-1 text-xs">
                    {lead > higher ? (
                      <p className="flex justify-between gap-2">
                        <span className="text-muted-foreground">{t("leadTarget")}</span>
                        <span className="font-bold tabular-nums">{formatSP(lead)}</span>
                      </p>
                    ) : null}
                    <p className="flex justify-between gap-2">
                      <span className="text-muted-foreground">{t("higherTarget")}</span>
                      <span className="font-bold tabular-nums">{formatSP(higher)}</span>
                    </p>
                    <p className="flex justify-between gap-2">
                      <span className="text-muted-foreground">{t("lowerTarget")}</span>
                      <span className="font-bold tabular-nums">{formatSP(lower)}</span>
                    </p>
                  </div>
                  <p className="mt-2 text-[11px] text-muted-foreground">{t("flexibleRuleShort")}</p>
                </div>
                <div className="rounded-xl border border-border/60 p-3">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    {t("directSponsorQualification")}
                  </p>
                  <p className="mt-2 flex justify-between gap-2 text-xs">
                    <span className="text-muted-foreground">{t("requiredTarget")}</span>
                    <span className="font-bold tabular-nums">{formatSP(BigInt(row.directTargetPaisa))}</span>
                  </p>
                  <p className="mt-2 text-[11px] text-muted-foreground">
                    {t("oneReferral")} · {t("singleTransaction")}
                  </p>
                </div>
                <div className="rounded-xl border border-border/60 p-3">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    {t("rankReward")}
                  </p>
                  <div className="mt-2 flex items-center gap-2">
                    {row.rewardImageUrl ? (
                      <Badge src={row.rewardImageUrl} rankKey={row.rankKey} size={28} />
                    ) : null}
                    <span className="text-sm font-bold tabular-nums text-amber-700 dark:text-amber-300">
                      {rewardText(reward, locale, t)}
                    </span>
                  </div>
                </div>
                <div className="rounded-xl border border-border/60 p-3">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    {t("salaryTitle")}
                  </p>
                  <p className="mt-2 flex justify-between gap-2 text-xs">
                    <span className="text-muted-foreground">{t("salaryMaximumWeekly")}</span>
                    <span className="font-bold tabular-nums">
                      {salaryConfig && salaryEnabled
                        ? formatSP(BigInt(salaryConfig.maxWeeklySalary))
                        : t("salaryNone")}
                    </span>
                  </p>
                  <p className="mt-1.5 flex justify-between gap-2 text-xs">
                    <span className="text-muted-foreground">{t("salaryDuration")}</span>
                    <span className="font-bold tabular-nums">
                      {!salaryEnabled
                        ? "—"
                        : salaryWeeks === null
                          ? t("salaryOngoing")
                          : t("salaryWeeksDuration", { count: salaryWeeks })}
                    </span>
                  </p>
                  <button
                    type="button"
                    onClick={onViewSalaryDetails}
                    className="mt-2.5 inline-flex items-center gap-1 text-xs font-bold text-primary hover:underline focus-visible:rounded focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {t("viewSalaryDetails")}
                    <span aria-hidden="true">→</span>
                  </button>
                </div>
                <div className="rounded-xl border border-border/60 p-3">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    {t("memberStatus")}
                  </p>
                  <p className="mt-2 text-sm font-bold">{rankStatusText(t, status)}</p>
                </div>
              </div>
            ) : null}
          </section>
        );
      })}
    </div>
  );
}

export function RankRewardsWorkspace({
  initialData,
  initialSalary,
}: {
  initialData: MemberRankDto;
  initialSalary: MemberSalaryDto;
}) {
  const [snapshot, setSnapshot] = useState(initialData);
  const [salarySnapshot, setSalarySnapshot] = useState(initialSalary);
  const [data, setData] = useState(initialData);
  const [salary, setSalary] = useState(initialSalary);
  const [tab, setTab] = useState<Tab>("overview");
  const [expandedRank, setExpandedRank] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const t = useTranslations("memberPanel");
  const locale = useLocale();
  const router = useRouter();

  if (snapshot !== initialData) {
    setSnapshot(initialData);
    setData(initialData);
  }
  if (salarySnapshot !== initialSalary) {
    setSalarySnapshot(initialSalary);
    setSalary(initialSalary);
  }

  async function refresh() {
    setRefreshing(true);
    try {
      const evaluateResponse = await fetch("/api/member/ranks/evaluate", { method: "POST" });
      if (!evaluateResponse.ok) throw new Error("evaluate failed");
      const readResponse = await fetch("/api/member/ranks", { cache: "no-store" });
      if (!readResponse.ok) throw new Error("read failed");
      setData((await readResponse.json()) as MemberRankDto);
      const salaryResponse = await fetch("/api/member/salary", { cache: "no-store" });
      if (!salaryResponse.ok) throw new Error("salary read failed");
      setSalary((await salaryResponse.json()) as MemberSalaryDto);
      toast.success(t("refreshSuccess"));
      router.refresh();
    } catch {
      toast.error(t("refreshFailed"));
    } finally {
      setRefreshing(false);
    }
  }

  const tabs: Array<{ id: Tab; label: string }> = [
    { id: "overview", label: t("overviewTab") },
    { id: "all", label: t("allRanksTab") },
    { id: "salary", label: t("salaryTab") },
  ];
  const refreshLabel = refreshing ? t("refreshing") : t("refreshQualification");

  function onTabKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const next = event.key === "ArrowRight" ? (index + 1) % tabs.length : (index - 1 + tabs.length) % tabs.length;
    setTab(tabs[next].id);
  }

  const nextRank = data.nextRank;
  const best = data.progress.bestDirectInvestment;
  const overallStatus = nextRank
    ? progressStatus(
        nextRank.teamQualified || nextRank.directQualified,
        nextRank.teamTotalsPaisa.some((value) => BigInt(value) > 0n) ||
          (best ? BigInt(best.amountPaisa) > 0n : false),
      )
    : "completed";

  return (
    <div className="space-y-4">
      <MobileRankHeader rank={data.currentRank} t={t} locale={locale} />
      <div className="flex w-full items-center gap-2">
        <div role="tablist" aria-label={t("rankRewardsTitle")} className="glass flex min-w-0 flex-1 rounded-xl p-1">
          {tabs.map((item, index) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              id={`rank-tab-${item.id}`}
              aria-controls={`rank-panel-${item.id}`}
              aria-selected={tab === item.id}
              tabIndex={tab === item.id ? 0 : -1}
              onKeyDown={(event) => onTabKeyDown(event, index)}
              onClick={() => setTab(item.id)}
              className={`flex-1 rounded-lg px-3 py-2 text-xs font-bold transition-colors ${
                tab === item.id
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={refresh}
          disabled={refreshing}
          aria-label={refreshLabel}
          title={refreshLabel}
          className="glass inline-flex size-9 shrink-0 items-center justify-center rounded-xl disabled:opacity-60"
        >
          <RefreshCw className={`size-4 ${refreshing ? "animate-spin" : ""}`} aria-hidden="true" />
        </button>
      </div>

      {tab === "overview" ? (
        <div role="tabpanel" id="rank-panel-overview" aria-labelledby="rank-tab-overview" className="space-y-4">
          <CurrentRankCard rank={data.currentRank} t={t} locale={locale} />
          <NextRankCard nextRank={nextRank} overall={overallStatus} t={t} locale={locale} />
          {nextRank ? (
            <>
              <ThreeTeamSection nextRank={nextRank} t={t} />
              <DirectSponsorSection nextRank={nextRank} best={best} t={t} locale={locale} />
              <OverallSection nextRank={nextRank} best={best} t={t} />
            </>
          ) : null}
          <RankJourney data={data} t={t} locale={locale} />
          <History history={data.history} t={t} locale={locale} />
        </div>
      ) : tab === "all" ? (
        <div role="tabpanel" id="rank-panel-all" aria-labelledby="rank-tab-all">
          <AllRanks
            data={data}
            salaryRanks={salary.salaryRanks}
            expandedKey={expandedRank}
            onToggle={(key) => setExpandedRank((current) => (current === key ? null : key))}
            onViewSalaryDetails={() => setTab("salary")}
            t={t}
            locale={locale}
          />
        </div>
      ) : (
        <div role="tabpanel" id="rank-panel-salary" aria-labelledby="rank-tab-salary">
          <SalaryTab salary={salary} />
        </div>
      )}
    </div>
  );
}
