"use client";

import { Circle, LockKeyhole } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { panelNavIcons } from "./panel-nav-icons";
import type { PanelNavBadge } from "./panel-nav-types";

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
