import { getTranslations } from "next-intl/server";
import { CalendarDays } from "lucide-react";
import { AdminPageIntro } from "@/components/admin/admin-ui";
import { SalaryRunSection } from "@/components/admin/rank-salary/salary-sections";

export const dynamic = "force-dynamic";

export default async function WeeklyDistributionPage() {
  const [tn, ta] = await Promise.all([
    getTranslations("nav"),
    getTranslations("adminPanel"),
  ]);

  return (
    <div className="space-y-8 animate-rise">
      <AdminPageIntro
        eyebrow={tn("admin")}
        title={ta("weeklyDistributionTitle")}
        intro={ta("salaryAutomationHint")}
        icon={<CalendarDays className="size-3.5" aria-hidden="true" />}
      />
      <SalaryRunSection />
    </div>
  );
}
