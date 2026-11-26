import { getTranslations } from "next-intl/server";
import { Banknote } from "lucide-react";
import { AdminPageIntro } from "@/components/admin/admin-ui";
import { SalaryPaymentRecordsContent } from "@/components/admin/rank-salary/salary-payment-records-content";

export const dynamic = "force-dynamic";

export default async function SalaryPaymentRecordsPage() {
  const [tn, ta] = await Promise.all([
    getTranslations("nav"),
    getTranslations("adminPanel"),
  ]);

  return (
    <div className="space-y-8 animate-rise">
      <AdminPageIntro
        eyebrow={tn("admin")}
        title={ta("salaryPaymentRecordsTitle")}
        intro={ta("salaryRecordsIntro")}
        icon={<Banknote className="size-4" aria-hidden="true" />}
      />
      <SalaryPaymentRecordsContent />
    </div>
  );
}
