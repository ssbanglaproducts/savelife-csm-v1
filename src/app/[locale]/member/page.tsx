import { redirect } from "@/i18n/navigation";
import { getLocale } from "next-intl/server";

export default async function MemberIndexPage() {
  const locale = await getLocale();
  redirect({ href: "/member/dashboard", locale });
}
