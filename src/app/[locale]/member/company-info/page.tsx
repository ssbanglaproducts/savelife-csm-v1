import { getLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";

export default async function CompanyInfoPage() {
  const locale = await getLocale();
  redirect({ href: "/member/program", locale });
}
