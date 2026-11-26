import { getLocale, getTranslations } from "next-intl/server";
import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { AdminSection, type StatusTone } from "@/components/admin/admin-ui";
import {
  SalaryTreasuryMemberList,
  type SalaryTreasuryMemberView,
} from "@/components/admin/salary-treasury-member-list";
import { RankBadge } from "@/components/ui/rank-badge";
import { buttonVariants } from "@/components/ui/button";
import { Link, redirect } from "@/i18n/navigation";
import { formatSP } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import { resolveRankBadgeImageUrl } from "@/lib/rank-art";
import { formatSalaryDate } from "@/lib/salary-display";
import { isSalaryRankKey } from "@/lib/salary";
import {
  salaryTreasuryAccent,
  salaryTreasuryCardStyle,
} from "@/lib/salary-treasury-accent";
import { getActiveSalaryPlan, serializeSalaryPlan } from "@/lib/services/salary-plan";
import {
  buildSalaryTreasuryRun,
  type SalaryTreasuryMemberState,
} from "@/lib/services/salary-treasury-run";
import { cn } from "@/lib/utils";

function memberStateTone(state: SalaryTreasuryMemberState): StatusTone {
  if (state === "eligible") return "success";
  if (state === "week-limit-reached") return "warning";
  if (state === "rank-disabled") return "neutral";
  return "danger";
}

export async function AdminTreasuryMembersContent({ rankKey }: { rankKey: string }) {
  const [session, locale, tn, ta] = await Promise.all([
    auth(),
    getLocale(),
    getTranslations("nav"),
    getTranslations("adminPanel"),
  ]);
  if (session?.user?.role !== "ADMIN") redirect({ href: "/login", locale });

  if (!isSalaryRankKey(rankKey)) notFound();

  const salaryPlan = await getActiveSalaryPlan(prisma);
  const plan = serializeSalaryPlan(salaryPlan);
  const config = salaryPlan.configs[rankKey];
  const rank = plan.ranks.find((row) => row.rankKey === rankKey);
  if (!rank) notFound();

  const [treasury, badge, entitlements] = await Promise.all([
    prisma.salaryTreasury.findUnique({
      where: { rankKey },
      select: { balancePaisa: true },
    }),
    prisma.rankDefinition.findFirst({
      where: { planVersion: { isActive: true }, rankKey },
      select: { badgeImageUrl: true },
    }),
    prisma.salaryEntitlement.findMany({
      where: { rankKey },
      select: {
        id: true,
        memberId: true,
        weeksPaid: true,
        member: {
          select: {
            memberId: true,
            fullName: true,
            status: true,
            profileImage: true,
          },
        },
      },
    }),
  ]);

  const run = buildSalaryTreasuryRun({
    config,
    balancePaisa: treasury?.balancePaisa ?? 0n,
    entitlements: [...entitlements].sort((a, b) =>
      a.member.fullName.localeCompare(b.member.fullName),
    ),
  });
  const accent = salaryTreasuryAccent(rankKey);
  const badgeSrc = resolveRankBadgeImageUrl(badge?.badgeImageUrl ?? null, rankKey);
  const name = locale === "bn" ? rank.defaultNameBn : rank.defaultName;
  const stateLabels: Record<SalaryTreasuryMemberState, string> = {
    eligible: ta("salaryTreasuryStateEligible"),
    "week-limit-reached": ta("salaryTreasuryStateWeekLimit"),
    "member-inactive": ta("salaryTreasuryStateInactiveMember"),
    "rank-disabled": ta("salaryTreasuryStateRankDisabled"),
  };
  const profileImages = new Map(
    entitlements.map((entitlement) => [
      entitlement.memberId,
      entitlement.member.profileImage,
    ]),
  );
  const members: readonly SalaryTreasuryMemberView[] = run.members.map((member) => ({
    entitlementId: member.entitlementId,
    memberRecordId: member.memberRecordId,
    memberDisplayId: member.memberDisplayId,
    memberName: member.memberName,
    profileImageUrl: profileImages.get(member.memberRecordId) ?? null,
    weeksLabel:
      config.maxWeeks === null
        ? `${member.weeksPaid} / ∞`
        : `${member.weeksPaid} / ${config.maxWeeks}`,
    amountLabel: formatSP(member.projectedPaisa),
    stateLabel: stateLabels[member.state],
    stateTone: memberStateTone(member.state),
  }));

  return (
    <div className="space-y-8 animate-rise">
      <Link
        href={`/admin/rank-salary/rank-treasuries/${rankKey}`}
        className={cn(buttonVariants({ variant: "outline" }), "w-fit")}
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        {ta("salaryTreasuryBackDetail")}
      </Link>

      <section
        className="mesh glass relative overflow-hidden rounded-3xl p-6 sm:p-8"
        style={salaryTreasuryCardStyle(rankKey)}
      >
        <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-4">
            <div
              className={cn(
                "flex size-20 shrink-0 items-center justify-center rounded-2xl ring-1 ring-inset",
                accent.badgeClass,
              )}
            >
              <RankBadge src={badgeSrc} rankKey={rankKey} size={64} />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2 text-xs font-bold tracking-[0.12em] text-muted-foreground">
                <span>{rankKey}</span>
                <span aria-hidden="true">·</span>
                <span>{tn("admin")}</span>
              </div>
              <h1 className={cn("mt-1 font-display text-3xl font-bold", accent.nameClass)}>
                {name}
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {ta("salaryTreasuryNextRun")}: {formatSalaryDate(run.nextBoundaryAt, locale, true)}
              </p>
            </div>
          </div>

          <div className="grid shrink-0 gap-2 sm:min-w-64">
            <div className="rounded-2xl border border-border bg-[var(--glass-strong)] px-5 py-4">
              <p className="text-xs font-semibold text-muted-foreground">
                {ta("salaryTreasuryEligibleMembers")}
              </p>
              <p className="mt-1 font-display text-2xl font-bold tabular-nums">
                {run.eligibleCount}
              </p>
            </div>
            <div className="rounded-2xl border border-border bg-[var(--glass-strong)] px-5 py-4">
              <p className="text-xs font-semibold text-muted-foreground">
                {ta("salaryTreasuryProjectedTotal")}
              </p>
              <p className="mt-1 font-display text-2xl font-bold tabular-nums">
                {formatSP(run.projectedTotalPaisa)}
              </p>
            </div>
          </div>
        </div>
      </section>

      <AdminSection id="salary-treasury-members" title={ta("salaryTreasuryMembers")}>
        <SalaryTreasuryMemberList
          members={members}
          labels={{
            search: ta("salaryTreasurySearchMembers"),
            memberId: ta("salaryTreasuryMemberId"),
            memberName: ta("salaryTreasuryMemberName"),
            weeksPaid: ta("salaryTreasuryWeeksPaid"),
            projected: ta("salaryTreasuryProjected"),
            status: ta("salaryTreasuryStatus"),
            noMatches: ta("salaryTreasuryNoMatches"),
            empty: ta("salaryTreasuryNoMembers"),
          }}
        />
      </AdminSection>
    </div>
  );
}
