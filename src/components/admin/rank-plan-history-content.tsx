import { getAdminAccess, hasAdminPermission } from "@/lib/admin-access";
import Image from "next/image";
import { ArrowLeft, History } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import {
  AdminPageIntro,
  AdminSection,
  AdminTable,
  EmptyState,
  StatusBadge,
  formatDate,
} from "@/components/admin/admin-ui";
import { RankCollectionButton } from "@/components/admin/rank-plan-manager";
import { RankBadge } from "@/components/ui/rank-badge";
import { buttonVariants } from "@/components/ui/button";
import { Link, redirect } from "@/i18n/navigation";
import {
  rankPlanChangesFromJson,
  rankPlanSettingMessageKey,
} from "@/lib/rank-plan-diff";
import {
  rankRewardDisplay,
  type RankAchievementRowDto,
} from "@/lib/rank-plan-dto";
import { prisma } from "@/lib/prisma";
import { requireMemberId } from "@/lib/member-id";
import { rankAccent } from "@/lib/rank-accent";
import { formatActorLabel } from "@/lib/services/actor-label";
import { ensureDefaultRankPlan } from "@/lib/services/rank-rewards";
import { cn } from "@/lib/utils";

const backLinkClass = cn(buttonVariants({ variant: "outline", size: "sm" }), "h-9");

/** Main rank history content, shared by the tabbed page and the legacy route. */
export async function RankPlanHistoryBody() {
  const [session, locale, ta, tm] = await Promise.all([
    getAdminAccess(),
    getLocale(),
    getTranslations("adminPanel"),
    getTranslations("memberPanel"),
  ]);
  if (!session || !hasAdminPermission(session, "ranks.view")) {
    redirect({ href: "/admin-login", locale });
    return null;
  }

  await ensureDefaultRankPlan(prisma);
  const [versions, achievements] = await Promise.all([
    prisma.rankPlanVersion.findMany({
      orderBy: { version: "desc" },
      include: {
        definitions: { orderBy: { sortOrder: "asc" } },
        createdBy: { select: { memberId: true, fullName: true, email: true } },
      },
    }),
    prisma.rankAchievement.findMany({
      where: { member: { role: "MEMBER" } },
      orderBy: { achievedAt: "desc" },
      include: {
        member: { select: { memberId: true, fullName: true } },
        planVersion: { select: { version: true } },
      },
    }),
  ]);

  const achievementRows: RankAchievementRowDto[] = achievements.map((row) => ({
    id: row.id,
    member: `${row.member.fullName} (${requireMemberId(row.member)})`,
    rankKey: row.rankKey,
    rankName: row.rankNameSnapshot,
    rankNameBn: row.rankNameBnSnapshot,
    planVersion: row.planVersion.version,
    achievedAt: row.achievedAt.toISOString(),
    primaryMethod: row.primaryMethod,
    secondaryMethod: row.secondaryMethod,
    rewardType: row.rewardType === "PHYSICAL" ? "PHYSICAL" : "SP",
    rewardSpPaisa: row.rewardSpPaisa?.toString() ?? null,
    rewardLabel: row.rewardLabel,
    rewardLabelBn: row.rewardLabelBn,
    badgeImageUrl: row.badgeImageUrl,
    rewardImageUrl: row.rewardImageUrl,
    rewardStatus: row.rewardStatus,
  }));

  function methodLabel(method: string): string {
    return method === "DIRECT_SALES" ? tm("directSales") : tm("teamSales");
  }

  function rankName(row: Pick<RankAchievementRowDto, "rankName" | "rankNameBn">): string {
    return locale === "bn" && row.rankNameBn ? row.rankNameBn : row.rankName;
  }

  return (
    <div className="space-y-8">
      <div className="space-y-3">
        {versions.map((version) => {
          const changes = rankPlanChangesFromJson(version.approvedChanges);
          return (
            <section key={version.id} className="glass rounded-2xl p-4 sm:p-5">
              <div className="flex flex-wrap items-center gap-3">
                <h2 className="font-display text-lg font-bold">v{version.version}</h2>
                <StatusBadge
                  tone={version.isActive ? "success" : "neutral"}
                  label={version.isActive ? ta("rankPlanActiveVersion") : ta("salaryPlanArchived")}
                />
                <span className="text-xs text-muted-foreground">
                  {ta("rankPlanEffective")}: {formatDate(version.effectiveFrom, locale)}
                </span>
              </div>

              <dl className="mt-4 grid gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
                <PlanFact
                  label={ta("salaryPlanLastUpdated")}
                  value={
                    version.activatedAt ?? version.createdAt
                      ? formatDate(version.activatedAt ?? version.createdAt, locale)
                      : "—"
                  }
                />
                <PlanFact
                  label={ta("rankConfigUpdatedBy")}
                  value={formatActorLabel(version.createdBy)}
                />
              </dl>

              {version.note ? (
                <p className="mt-3 text-xs text-muted-foreground">{version.note}</p>
              ) : null}

              <details className="mt-4 border-t border-border pt-3" open={version.isActive}>
                <summary className="cursor-pointer text-sm font-semibold">
                  {ta("salaryPlanDetails")}
                </summary>
                <div className="mt-3 overflow-x-auto">
                  <AdminTable
                    caption={`${ta("rankPlanRanks")} v${version.version}`}
                    headers={[ta("salaryPlanRank"), ta("rankPlanPlanValues")]}
                  >
                    {version.definitions.map((definition) => (
                      <tr key={definition.id} className="align-top">
                        <td className="whitespace-nowrap px-4 py-3 font-semibold">
                          {locale === "bn" && definition.nameBn
                            ? definition.nameBn
                            : definition.name}{" "}
                          ({definition.rankKey})
                        </td>
                        <td className="px-4 py-3 text-xs tabular-nums text-muted-foreground">
                          {[
                            definition.directTargetPaisa,
                            definition.team1TargetPaisa,
                            definition.team2TargetPaisa,
                            definition.team3TargetPaisa,
                          ]
                            .map((value) => rankRewardDisplay(
                              { rewardType: "SP", rewardSpPaisa: value.toString(), rewardLabel: null, rewardLabelBn: null },
                              locale,
                            ))
                            .join(" · ")}
                        </td>
                      </tr>
                    ))}
                  </AdminTable>
                </div>
              </details>

              <details className="mt-3 border-t border-border pt-3" open={version.isActive}>
                <summary className="cursor-pointer text-sm font-semibold">
                  {ta("rankConfigApprovedChanges")}
                </summary>
                {changes.length === 0 ? (
                  <p className="mt-3 text-sm text-muted-foreground">
                    {ta("rankConfigNoApprovedChanges")}
                  </p>
                ) : (
                  <div className="mt-3 overflow-x-auto">
                    <AdminTable
                      caption={`${ta("rankConfigApprovedChanges")} v${version.version}`}
                      headers={[
                        ta("salaryPlanRank"),
                        ta("rankConfigSetting"),
                        ta("rankConfigPrevious"),
                        ta("rankConfigNewValue"),
                      ]}
                    >
                      {changes.map((change) => (
                        <tr key={change.id} className="align-top">
                          <td className="whitespace-nowrap px-4 py-3 font-semibold">
                            {locale === "bn" && change.rankLabelBn
                              ? change.rankLabelBn
                              : change.rankLabel}{" "}
                            ({change.rankKey})
                          </td>
                          <td className="whitespace-nowrap px-4 py-3">
                            {ta(rankPlanSettingMessageKey(change.settingKey))}
                          </td>
                          <td className="max-w-[18rem] break-words px-4 py-3 text-muted-foreground">
                            {change.previous ?? "—"}
                          </td>
                          <td className="max-w-[18rem] break-words px-4 py-3 font-semibold">
                            {change.next ?? "—"}
                          </td>
                        </tr>
                      ))}
                    </AdminTable>
                  </div>
                )}
              </details>
            </section>
          );
        })}
      </div>

      <AdminSection title={ta("rankPlanAchievements")} id="rank-plan-achievements">
        {achievementRows.length === 0 ? (
          <EmptyState message={ta("rankPlanNoAchievements")} />
        ) : (
          <AdminTable
            caption={ta("rankPlanAchievements")}
            headers={[
              ta("rankPlanMember"),
              ta("rankPlanRanks"),
              ta("rankPlanVersion"),
              tm("achievedOn"),
              ta("rankPlanMethod"),
              ta("rankPlanReward"),
              ta("rankPlanStatus"),
            ]}
          >
            {achievementRows.map((row) => {
              const accent = rankAccent(row.rankKey);
              return (
                <tr key={row.id}>
                  <td className="whitespace-nowrap px-4 py-3 font-semibold">{row.member}</td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <div className="flex items-center gap-2">
                      <RankBadge src={row.badgeImageUrl} rankKey={row.rankKey} size={44} />
                      <span className={cn("font-semibold", accent.title)}>{rankName(row)}</span>
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 tabular-nums">v{row.planVersion}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                    {formatDate(new Date(row.achievedAt), locale)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-xs">
                    {methodLabel(row.primaryMethod)}
                    {row.secondaryMethod ? ` · ${methodLabel(row.secondaryMethod)}` : ""}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <div className="flex items-center gap-2">
                      {row.rewardType === "PHYSICAL" && row.rewardImageUrl ? (
                        <Image
                          src={row.rewardImageUrl}
                          alt=""
                          width={32}
                          height={32}
                          className="size-8 object-contain"
                        />
                      ) : null}
                      <span>{rankRewardDisplay(row, locale)}</span>
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge
                        tone={row.rewardStatus === "ACHIEVED" ? "success" : "warning"}
                        label={row.rewardStatus === "ACHIEVED" ? tm("statusAchieved") : tm("statusPending")}
                      />
                      {row.rewardType === "PHYSICAL" && row.rewardStatus === "PENDING" ? (
                        <RankCollectionButton achievementId={row.id} />
                      ) : null}
                    </div>
                  </td>
                </tr>
              );
            })}
          </AdminTable>
        )}
      </AdminSection>
    </div>
  );
}

/** Full standalone page for the legacy /admin/rank-salary/rank-plan-history route. */
export async function RankPlanHistoryContent() {
  const [tn, ta] = await Promise.all([
    getTranslations("nav"),
    getTranslations("adminPanel"),
  ]);

  return (
    <div className="space-y-8 animate-rise">
      <AdminPageIntro
        eyebrow={tn("admin")}
        title={ta("rankConfigHistoryTitle")}
        intro={ta("rankPlanImmutableNote")}
        icon={<History className="size-4" aria-hidden="true" />}
        actions={
          <Link href="/admin/ranks?tab=configuration" className={backLinkClass}>
            <ArrowLeft className="size-4" aria-hidden="true" />
            {ta("rankConfigBackToConfiguration")}
          </Link>
        }
      />
      <RankPlanHistoryBody />
    </div>
  );
}

function PlanFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 justify-between gap-4 border-b border-border/60 pb-2">
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd className="min-w-0 truncate text-right font-semibold">{value}</dd>
    </div>
  );
}
