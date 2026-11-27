import { getAdminAccess, hasAdminPermission } from "@/lib/admin-access";
import { Trophy } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { AdminPageIntro, StatusBadge } from "@/components/admin/admin-ui";
import { RankConfigurationEditor } from "@/components/admin/rank-configuration/rank-configuration-editor";
import { buttonVariants } from "@/components/ui/button";
import { Link, redirect } from "@/i18n/navigation";
import { definitionToDto, type RankPlanFormData } from "@/lib/rank-plan-dto";
import { formatSP, sumPaisa } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import { ensureDefaultRankPlan } from "@/lib/services/rank-rewards";
import { cn } from "@/lib/utils";

const historyLinkClass = cn(buttonVariants({ variant: "outline", size: "sm" }), "h-9");

/** Main rank configuration content, shared by the tabbed page and the legacy route. */
export async function RankPlanBody() {
  const [session, locale, ta] = await Promise.all([
    getAdminAccess(),
    getLocale(),
    getTranslations("adminPanel"),
  ]);
  if (!session || !hasAdminPermission(session, "ranks.view")) {
    redirect({ href: "/admin-login", locale });
    return null;
  }

  await ensureDefaultRankPlan(prisma);
  const versions = await prisma.rankPlanVersion.findMany({
    orderBy: { version: "desc" },
    include: { definitions: { orderBy: { sortOrder: "asc" } } },
  });
  const active = versions.find((version) => version.isActive) ?? versions[0];
  const activeForm: RankPlanFormData = {
    id: active.id,
    version: active.version,
    isActive: active.isActive,
    effectiveFrom: active.effectiveFrom.toISOString(),
    note: active.note,
    ranks: active.definitions.map(definitionToDto),
  };
  const nextVersion = Math.max(...versions.map((version) => version.version)) + 1;
  const totalRewardPaisa = sumPaisa(
    active.definitions
      .filter((definition) => definition.rewardType === "SP")
      .map((definition) => definition.rewardSpPaisa ?? 0n),
  );

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {ta("rankConfigTotalRewards")}:{" "}
        <span className="font-semibold tabular-nums text-foreground">
          {formatSP(totalRewardPaisa)}
        </span>
      </p>
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-border bg-[var(--glass)] px-3 py-2">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge tone="success" label={`v${active.version}.0`} />
          <span className="inline-flex h-8 items-center rounded-full border border-border bg-[var(--glass-strong)] px-3 text-xs font-semibold text-muted-foreground">
            {ta("rankConfigRanksCount")}
          </span>
        </div>
        <Link href="/admin/ranks?tab=history" className={historyLinkClass}>
          {ta("rankConfigPlanHistory")}
        </Link>
      </div>
      <RankConfigurationEditor active={activeForm} nextVersion={nextVersion} />
    </div>
  );
}

/** Full standalone page for the legacy /admin/rank-salary/rank-configuration route. */
export async function RankPlanContent() {
  const [tn, ta] = await Promise.all([
    getTranslations("nav"),
    getTranslations("adminPanel"),
  ]);

  return (
    <div className="space-y-8 animate-rise">
      <AdminPageIntro
        eyebrow={tn("admin")}
        title={ta("rankConfigurationTitle")}
        intro={ta("rankPlanIntro")}
        icon={<Trophy className="size-4" aria-hidden="true" />}
      />
      <RankPlanBody />
    </div>
  );
}
