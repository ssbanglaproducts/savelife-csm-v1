"use client";

import {
  ArrowLeftRight,
  Award,
  Banknote,
  Building2,
  CalendarDays,
  Circle,
  Clock,
  FileText,
  History,
  Image as ImageIcon,
  Info,
  LayoutDashboard,
  Landmark,
  LockKeyhole,
  Megaphone,
  Network,
  Package,
  PieChart,
  PlusCircle,
  ScrollText,
  Send,
  Settings,
  Settings2,
  ShoppingBag,
  SlidersHorizontal,
  TrendingUp,
  Trophy,
  UserPlus,
  UserRound,
  Users,
  Video,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { usePathname } from "@/i18n/navigation";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import type { PanelNavBadge } from "./panel-nav-types";

export const panelNavIcons: Record<string, LucideIcon> = {
  "/member/dashboard": LayoutDashboard,
  "/member/profile": UserRound,
  "/member/network": Network,
  "/member/team": Users,
  "/member/referrals": UserPlus,
  "/member/orders": ShoppingBag,
  "/member/investments": TrendingUp,
  "/member/wallet": Wallet,
  "/member/top-up": PlusCircle,
  "/member/send-money": Send,
  "/member/transactions": ArrowLeftRight,
  "/member/withdrawals": Banknote,
  "/member/program": Building2,
  "/member/rank-rewards": Trophy,
  "/member/salary": CalendarDays,
  "/member/company-info": Info,
  "/admin/dashboard": LayoutDashboard,
  "/admin/members": Users,
  "/admin/orders": ShoppingBag,
  "/admin/products": Package,
  "/admin/investments": Landmark,
  "/admin/distributions": PieChart,
  "/admin/ranks": Award,
  "/admin/salary": CalendarDays,
  "/admin/rank-salary": Trophy,
  "/admin/rank-salary/overview": Clock,
  "/admin/rank-salary/rank-configuration": SlidersHorizontal,
  "/admin/rank-salary/rank-members": Users,
  "/admin/rank-salary/rank-treasuries": Wallet,
  "/admin/rank-salary/weekly-distribution": Send,
  "/admin/rank-salary/distribution-history": History,
  "/admin/rank-salary/salary-payment-records": FileText,
  "/admin/withdrawals": Banknote,
  "/admin/top-ups": PlusCircle,
  "/admin/settings": Settings,
  "/admin/settings/investments": Settings2,
  "/admin/settings/top-up-accounts": Building2,
  "/admin/settings/auth-banner": Video,
  "/admin/gallery": ImageIcon,
  "/admin/announcements": Megaphone,
  "/admin/audit": ScrollText,
};

export function PanelNavLink({
  href,
  label,
  locked = false,
  badge,
  activePrefix,
}: {
  href: string;
  label: string;
  locked?: boolean;
  badge?: PanelNavBadge;
  /** Keeps a parent link active while any nested route is selected. */
  activePrefix?: string;
}) {
  const pathname = usePathname();
  const t = useTranslations("memberPanel");
  const active = activePrefix
    ? pathname === activePrefix || pathname.startsWith(`${activePrefix}/`)
    : pathname === href || pathname.startsWith(`${href}/`);
  // Fallback keeps every link iconed, including routes added in the future.
  const Icon = panelNavIcons[href] ?? Circle;

  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      title={locked ? t("featureLockedHint") : undefined}
      className={cn(
        "flex min-w-0 items-center gap-2.5 rounded-xl border-l-2 border-transparent px-3 py-2 text-sm transition-all duration-200 hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring",
        active
          ? "border-primary bg-primary/15 font-semibold text-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.14)]"
          : "text-muted-foreground hover:text-foreground",
        locked && "opacity-70",
      )}
    >
      <Icon className={cn("size-4 shrink-0", active && "text-primary")} aria-hidden="true" />
      <span className="truncate">{label}</span>
      {locked ? (
        <LockKeyhole className="ml-auto size-3.5 shrink-0" aria-hidden="true" />
      ) : badge && badge.count > 0 ? (
        <span
          title={badge.label}
          className={cn(
            "ml-auto flex min-w-5 shrink-0 items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-4 tabular-nums",
            badge.tone === "warning"
              ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
              : "bg-primary/15 text-primary",
          )}
        >
          <span className="sr-only">{badge.label}</span>
          <span aria-hidden="true">{badge.count > 9 ? "9+" : badge.count}</span>
        </span>
      ) : null}
    </Link>
  );
}
