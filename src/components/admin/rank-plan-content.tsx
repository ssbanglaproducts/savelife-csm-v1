import { Trophy } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { auth } from "@/auth";
import { AdminPageIntro, StatusBadge } from "@/components/admin/admin-ui";
import { RankConfigurationEditor } from "@/components/admin/rank-configuration/rank-configuration-editor";
import { buttonVariants } from "@/components/ui/button";
import { Link, redirect } from "@/i18n/navigation";
import { definitionToDto, type RankPlanFormData } from "@/lib/rank-plan-dto";
import { prisma } from "@/lib/prisma";
import { ensureDefaultRankPlan } from "@/lib/services/rank-rewards";
import { cn } from "@/lib/utils";

const historyLinkClass = cn(buttonVariants({ variant: "outline", size: "sm" }), "h-9");

export async function RankPlanContent() {
  const [session, locale, tn, ta] = await Promise.all([
    auth(),
    getLocale(),
    getTranslations("nav"),
    getTranslations("adminPanel"),
  ]);
  if (!session?.user?.id || session.user.role !== "ADMIN") {
    redirect({ href: "/login", locale });
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

  return (
    <div className="space-y-8 animate-rise">
      <AdminPageIntro
        eyebrow={tn("admin")}
        title={ta("rankConfigurationTitle")}
        intro={ta("rankPlanIntro")}
        icon={<Trophy className="size-4" aria-hidden="true" />}
        actions={
          <>
            <StatusBadge tone="success" label={`v${active.version}.0`} />
            <span className="inline-flex h-8 items-center rounded-full border border-border bg-[var(--glass-strong)] px-3 text-xs font-semibold text-muted-foreground">
              {ta("rankConfigRanksCount")}
            </span>
            <Link href="/admin/rank-salary/rank-plan-history" className={historyLinkClass}>
              {ta("rankConfigPlanHistory")}
            </Link>
          </>
        }
      />
      <RankConfigurationEditor active={activeForm} nextVersion={nextVersion} />
    </div>
  );
}
