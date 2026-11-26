import { getLocale, getTranslations } from "next-intl/server";
import {
  AdminSection,
  AdminTable,
  EmptyState,
  StatusBadge,
  adminStatusKey,
  formatDate,
  statusTone,
} from "@/components/admin/admin-ui";
import { SalaryRunButton } from "@/components/admin/salary-run-button";
import { SalaryTreasuryCards } from "@/components/admin/salary-treasury-cards";
import { formatSP } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import { SALARY_RANK_KEYS, type SalaryRankKey } from "@/lib/salary";
import { getActiveSalaryPlan, serializeSalaryPlan } from "@/lib/services/salary-plan";
import { buildSalaryTreasuryRun } from "@/lib/services/salary-treasury-run";
import { cn } from "@/lib/utils";

/** Shared content blocks for the Rank & Salary Management child pages. */
export async function SalaryRunSection() {
  const ta = await getTranslations("adminPanel");

  return (
    <AdminSection id="salary-run" title={ta("salaryRun")}>
      <SalaryRunButton />
    </AdminSection>
  );
}

export async function SalaryTreasuriesSection() {
  const ta = await getTranslations("adminPanel");
  const salaryPlan = await getActiveSalaryPlan(prisma);
  const plan = serializeSalaryPlan(salaryPlan);

  const [treasuries, badges, entitlements] = await Promise.all([
    prisma.salaryTreasury.findMany({
      orderBy: { rankKey: "asc" },
      select: { rankKey: true, balancePaisa: true },
    }),
    prisma.rankDefinition.findMany({
      where: { planVersion: { isActive: true } },
      select: { rankKey: true, badgeImageUrl: true },
    }),
    prisma.salaryEntitlement.findMany({
      where: {
        isActive: true,
        rankKey: { in: [...SALARY_RANK_KEYS] },
        member: { status: "ACTIVE" },
      },
      select: {
        id: true,
        memberId: true,
        rankKey: true,
        weeksPaid: true,
        member: { select: { memberId: true, fullName: true, status: true } },
      },
    }),
  ]);

  const projections = Object.fromEntries(
    SALARY_RANK_KEYS.map((rankKey) => {
      const balancePaisa =
        treasuries.find((row) => row.rankKey === rankKey)?.balancePaisa ?? 0n;
      const run = buildSalaryTreasuryRun({
        config: salaryPlan.configs[rankKey],
        balancePaisa,
        entitlements: entitlements.filter((row) => row.rankKey === rankKey),
      });
      return [
        rankKey,
        {
          eligibleCount: run.eligibleCount,
          averagePaisa:
            run.eligibleCount > 0 ? run.projectedTotalPaisa / BigInt(run.eligibleCount) : 0n,
        },
      ];
    }),
  ) as Record<SalaryRankKey, { eligibleCount: number; averagePaisa: bigint }>;

  return (
    <AdminSection id="salary-treasuries" title={ta("salaryTreasuries")}>
      <p className="text-sm text-muted-foreground">{ta("salaryTraceIntro")}</p>
      <SalaryTreasuryCards
        ranks={plan.ranks}
        treasuries={treasuries}
        badges={badges}
        projections={projections}
      />
    </AdminSection>
  );
}

export async function SalaryDistributionsSection() {
  const [locale, ta, tc] = await Promise.all([
    getLocale(),
    getTranslations("adminPanel"),
    getTranslations("common"),
  ]);

  const distributions = await prisma.salaryDistribution.findMany({
    orderBy: { weekEndAt: "desc" },
    take: 50,
    select: {
      id: true,
      weekEndAt: true,
      status: true,
      totalPaidPaisa: true,
      recipientCount: true,
      postedAt: true,
      payments: { select: { status: true } },
    },
  });

  return (
    <AdminSection id="salary-distributions" title={ta("salaryDistributions")}>
      {distributions.length === 0 ? (
        <EmptyState message={ta("salaryNoDistributions")} />
      ) : (
        <AdminTable
          caption={ta("salaryDistributions")}
          headers={[
            ta("salaryWeek"),
            tc("status"),
            ta("salaryRecipients"),
            ta("salaryTotalPaid"),
            ta("salaryFailed"),
            ta("salaryPaidAt"),
          ]}
        >
          {distributions.map((distribution) => {
            const failed = distribution.payments.filter(
              (payment) => payment.status === "FAILED",
            ).length;
            return (
              <tr key={distribution.id} className="align-top">
                <td className="whitespace-nowrap px-4 py-3 font-semibold tabular-nums">
                  {formatDate(distribution.weekEndAt, locale)}
                </td>
                <td className="whitespace-nowrap px-4 py-3">
                  <StatusBadge
                    tone={statusTone(distribution.status)}
                    label={ta(adminStatusKey(distribution.status))}
                  />
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-center tabular-nums">
                  {distribution.recipientCount}
                </td>
                <td className="whitespace-nowrap px-4 py-3 font-semibold tabular-nums">
                  {formatSP(distribution.totalPaidPaisa)}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-center tabular-nums">
                  {failed}
                </td>
                <td
                  className={cn(
                    "whitespace-nowrap px-4 py-3 text-xs",
                    "text-muted-foreground",
                  )}
                >
                  {distribution.postedAt ? formatDate(distribution.postedAt, locale) : "—"}
                </td>
              </tr>
            );
          })}
        </AdminTable>
      )}
    </AdminSection>
  );
}
