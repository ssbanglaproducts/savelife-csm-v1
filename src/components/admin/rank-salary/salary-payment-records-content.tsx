import { getAdminAccess, hasAdminPermission } from "@/lib/admin-access";
import { getLocale, getTranslations } from "next-intl/server";
import { AdminSection, type StatusTone } from "@/components/admin/admin-ui";
import { redirect } from "@/i18n/navigation";
import { formatSP } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import { formatSalaryDate, salaryDateKey } from "@/lib/salary-display";
import { SALARY_RANK_CONFIG, isSalaryRankKey } from "@/lib/salary";
import { ensureDefaultRankPlan } from "@/lib/services/rank-rewards";
import {
  SalaryPaymentRecordsList,
  type SalaryPaymentRecordView,
} from "./salary-payment-records-list";

/** Main records content, shared by the tabbed page and the legacy route. */
export async function SalaryPaymentRecordsBody() {
  const [session, locale, ta] = await Promise.all([
    getAdminAccess(),
    getLocale(),
    getTranslations("adminPanel"),
  ]);
  if (!session || !hasAdminPermission(session, "salary.view")) redirect({ href: "/admin-login", locale });

  await ensureDefaultRankPlan(prisma);
  const [payments, definitions] = await Promise.all([
    prisma.salaryPayment.findMany({
      where: { member: { role: "MEMBER" } },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      select: {
        id: true,
        rankKey: true,
        amountPaisa: true,
        weekNumber: true,
        status: true,
        createdAt: true,
        member: {
          select: { memberId: true, fullName: true, profileImage: true },
        },
        distribution: { select: { id: true, weekEndAt: true } },
      },
    }),
    prisma.rankDefinition.findMany({
      where: { planVersion: { isActive: true } },
      select: { rankKey: true, name: true, nameBn: true },
    }),
  ]);

  const names = new Map<string, string>();
  for (const definition of definitions) {
    names.set(
      definition.rankKey,
      locale === "bn" ? definition.nameBn ?? definition.name : definition.name,
    );
  }

  const records: readonly SalaryPaymentRecordView[] = payments.map((payment) => {
    const fallback = isSalaryRankKey(payment.rankKey)
      ? SALARY_RANK_CONFIG[payment.rankKey]
      : null;
    const rankName =
      names.get(payment.rankKey) ??
      (locale === "bn" ? fallback?.defaultNameBn : fallback?.defaultName) ??
      payment.rankKey;
    const success = payment.status === "SUCCESS";
    const distributionHref = isSalaryRankKey(payment.rankKey)
      ? `/admin/rank-salary/rank-treasuries/${payment.rankKey}#distribution-${payment.distribution.id}`
      : "/admin/rank-salary/distribution-history";

    return {
      id: payment.id,
      memberDisplayId: payment.member.memberId,
      memberName: payment.member.fullName,
      profileImageUrl: payment.member.profileImage,
      rankKey: payment.rankKey,
      rankName,
      amountLabel: formatSP(payment.amountPaisa),
      weekLabel: formatSalaryDate(payment.distribution.weekEndAt, locale),
      weekDateKey: salaryDateKey(payment.distribution.weekEndAt),
      weekNumberLabel: ta("salaryRecordsWeekNumber", { number: payment.weekNumber }),
      paidLabel: formatSalaryDate(payment.createdAt, locale, true),
      paidDateKey: salaryDateKey(payment.createdAt),
      status: success ? "SUCCESS" : "FAILED",
      statusLabel: success
        ? ta("salaryRecordsStatusSuccess")
        : ta("salaryRecordsStatusFailed"),
      statusTone: (success ? "success" : "danger") satisfies StatusTone,
      distributionHref,
      distributionLabel: ta("salaryRecordsViewDistribution"),
    };
  });

  return (
    <div className="space-y-4">
      <SalaryPaymentRecordsList
        records={records}
        labels={{
          search: ta("salaryRecordsSearch"),
          rank: ta("salaryRecordsRank"),
          allRanks: ta("salaryRecordsAllRanks"),
          status: ta("salaryRecordsStatus"),
          allStatuses: ta("salaryRecordsAllStatuses"),
          statusSuccess: ta("salaryRecordsStatusSuccess"),
          statusFailed: ta("salaryRecordsStatusFailed"),
          weekEnding: ta("salaryRecordsWeekEnding"),
          paidDate: ta("salaryRecordsPaidDate"),
          member: ta("salaryRecordsMember"),
          amount: ta("salaryRecordsAmount"),
          weekNumber: ta("salaryRecordsWeekNumberLabel"),
          distribution: ta("salaryRecordsDistribution"),
          viewDistribution: ta("salaryRecordsViewDistribution"),
          noMatches: ta("salaryRecordsNoMatches"),
          empty: ta("salaryRecordsNoRecords"),
        }}
      />
    </div>
  );
}

/** Full standalone page for the legacy salary-records route. */
export async function SalaryPaymentRecordsContent() {
  const ta = await getTranslations("adminPanel");

  return (
    <AdminSection id="salary-payment-records" title={ta("salaryPaymentRecordsTitle")}>
      <SalaryPaymentRecordsBody />
    </AdminSection>
  );
}
