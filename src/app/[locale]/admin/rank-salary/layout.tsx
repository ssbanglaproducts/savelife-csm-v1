import type { ReactNode } from "react";
import { getLocale } from "next-intl/server";
import { auth } from "@/auth";
import { redirect } from "@/i18n/navigation";

export default async function RankSalaryLayout({ children }: { children: ReactNode }) {
  const [session, locale] = await Promise.all([auth(), getLocale()]);
  if (session?.user?.role !== "ADMIN") redirect({ href: "/admin-login", locale });
  return children;
}
