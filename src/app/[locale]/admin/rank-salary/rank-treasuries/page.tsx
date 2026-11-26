import { getTranslations } from "next-intl/server";
import { Landmark } from "lucide-react";
import { AdminPageIntro } from "@/components/admin/admin-ui";
import { SalaryTreasuriesSection } from "@/components/admin/rank-salary/salary-sections";

export const dynamic = "force-dynamic";

export default async function RankTreasuriesPage() {
  const [tn, ta] = await Promise.all([
    getTranslations("nav"),
    getTranslations("adminPanel"),
  ]);

  return (
    <div className="space-y-8 animate-rise">
      <AdminPageIntro
        eyebrow={tn("admin")}
        title={ta("rankTreasuriesTitle")}
        intro={ta("salaryIntro")}
        icon={<Landmark className="size-4" aria-hidden="true" />}
      />
      <SalaryTreasuriesSection />
    </div>
  );
}
