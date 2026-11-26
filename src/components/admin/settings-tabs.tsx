"use client";

import { BadgeCheck, Building2, Video, type LucideIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

const tabs: Array<{
  href: string;
  labelKey: string;
  Icon: LucideIcon;
}> = [
  {
    href: "/admin/settings/investments",
    labelKey: "settingsTabInvestments",
    Icon: BadgeCheck,
  },
  {
    href: "/admin/settings/top-up-accounts",
    labelKey: "topUpAccountsTitle",
    Icon: Building2,
  },
  {
    href: "/admin/settings/auth-banner",
    labelKey: "authBannerVideoTitle",
    Icon: Video,
  },
];

export function SettingsTabs() {
  const pathname = usePathname();
  const t = useTranslations("adminPanel");

  return (
    <nav aria-label={t("settingsTabsLabel")} className="flex flex-wrap gap-2">
      {tabs.map(({ href, labelKey, Icon }) => {
        const active = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-ring",
              active
                ? "border-primary/40 bg-primary/15 text-foreground"
                : "border-border bg-background/50 text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <Icon className={cn("size-4 shrink-0", active && "text-primary")} aria-hidden="true" />
            {t(labelKey)}
          </Link>
        );
      })}
    </nav>
  );
}
