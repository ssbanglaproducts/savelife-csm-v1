import { PencilLine } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { AdminPageIntro } from "@/components/admin/admin-ui";
import { EditSalaryPlanForm } from "@/components/admin/salary-plan/edit-salary-plan-form";
import { prisma } from "@/lib/prisma";
import { ensureDefaultRankPlan } from "@/lib/services/rank-rewards";
import {
  getActiveSalaryPlan,
  serializeSalaryPlan,
  type SalaryPlanRankDto,
} from "@/lib/services/salary-plan";

export const dynamic = "force-dynamic";

export default async function EditSalaryPlanPage() {
  const [tn, ta] = await Promise.all([
    getTranslations("nav"),
    getTranslations("adminPanel"),
  ]);

  await ensureDefaultRankPlan(prisma);
  const [plan, activeVersion, rankDefinitions, latest] = await Promise.all([
    getActiveSalaryPlan(prisma),
    prisma.salaryPlanVersion.findFirst({
      where: { isActive: true },
      orderBy: { version: "desc" },
      include: { createdBy: { select: { memberId: true, fullName: true } } },
    }),
    prisma.rankDefinition.findMany({
      where: { planVersion: { isActive: true } },
      select: { rankKey: true, name: true, nameBn: true, badgeImageUrl: true },
    }),
    prisma.salaryPlanVersion.findFirst({
      orderBy: { version: "desc" },
      select: { version: true },
    }),
  ]);

  const rankByKey = new Map(rankDefinitions.map((row) => [row.rankKey, row]));
  const serialized = serializeSalaryPlan(plan, {
    effectiveFrom: activeVersion?.effectiveFrom,
    activatedAt: activeVersion?.activatedAt,
    createdAt: activeVersion?.createdAt,
    createdBy: activeVersion?.createdBy,
    note: activeVersion?.note,
    approvedChanges: activeVersion?.approvedChanges,
  });
  const ranks: readonly SalaryPlanRankDto[] = serialized.ranks.map((row) => {
    const rank = rankByKey.get(row.rankKey);
    return {
      ...row,
      name: rank?.name ?? row.defaultName,
      nameBn: rank?.nameBn ?? row.defaultNameBn,
      badgeImageUrl: rank?.badgeImageUrl ?? null,
    };
  });

  return (
    <div className="space-y-8 animate-rise">
      <AdminPageIntro
        eyebrow={tn("admin")}
        title={ta("salaryPlanEditTitle")}
        intro={ta("salaryPlanEditIntro")}
        icon={<PencilLine className="size-4" aria-hidden="true" />}
      />
      <EditSalaryPlanForm
        active={{ ...serialized, ranks }}
        nextVersion={(latest?.version ?? 0) + 1}
      />
    </div>
  );
}
