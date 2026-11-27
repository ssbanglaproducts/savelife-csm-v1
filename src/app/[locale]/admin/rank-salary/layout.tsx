import type { ReactNode } from "react";
import { getLocale } from "next-intl/server";
import { getAdminAccess, hasAdminPermission } from "@/lib/admin-access";
import { redirect } from "@/i18n/navigation";

export default async function RankSalaryLayout({ children }: { children: ReactNode }) {
  const [session, locale] = await Promise.all([getAdminAccess(), getLocale()]);
  if (!session || !hasAdminPermission(session, "salary.view")) redirect({ href: "/admin-login", locale });
  return children;
}
