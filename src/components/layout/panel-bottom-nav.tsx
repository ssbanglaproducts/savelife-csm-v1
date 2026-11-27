"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Circle, LockKeyhole, MoreHorizontal, X } from "lucide-react";
import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { LanguageToggle } from "./language-toggle";
import { LogoutButton } from "./logout-button";
import { panelNavIcons } from "./panel-nav-link";
import type { PanelLink } from "./panel-nav-types";
import { ThemeToggle } from "./theme-toggle";

const PRIMARY_LIMIT = 4;

function resolveLinks(links: PanelLink[], primaryHrefs: string[]) {
  const primary: PanelLink[] = [];

  for (const href of primaryHrefs) {
    if (primary.length >= PRIMARY_LIMIT) break;
    const link = links.find((item) => item.href === href);
    if (link && !link.locked && !primary.some((item) => item.href === href)) {
      primary.push(link);
    }
  }

  // Keep the bar full even when a pinned link is unavailable.
  if (primary.length < PRIMARY_LIMIT) {
    for (const link of links) {
      if (primary.length >= PRIMARY_LIMIT) break;
      if (!link.locked && !primary.some((item) => item.href === link.href)) {
        primary.push(link);
      }
    }
  }

  return {
    primary,
    overflow: links.filter((link) => !primary.some((item) => item.href === link.href)),
  };
}

function NavIcon({ item, active }: { item: PanelLink; active: boolean }) {
  const Icon = panelNavIcons[item.href] ?? Circle;
  const showDot = !item.locked && Boolean(item.badge && item.badge.count > 0);
  return (
    <span
      className={cn(
        "relative flex size-8 items-center justify-center rounded-xl transition-colors",
        active && "bg-primary/15 text-primary",
      )}
    >
      <Icon className="size-5" aria-hidden="true" />
      {showDot ? (
        <span
          aria-hidden="true"
          className={cn(
            "absolute -right-0.5 -top-0.5 size-2.5 rounded-full ring-2 ring-[var(--glass)]",
            item.badge?.tone === "warning" ? "bg-amber-500" : "bg-primary",
          )}
        />
      ) : null}
    </span>
  );
}

/** Mobile-first panel navigation: pinned links plus an accessible More sheet. */
export function PanelBottomNav({
  links,
  primaryHrefs,
  signedIn,
}: {
  links: PanelLink[];
  primaryHrefs: string[];
  signedIn: boolean;
}) {
  const t = useTranslations("nav");
  const ta = useTranslations("adminPanel");
  const tm = useTranslations("memberPanel");
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [lastPathname, setLastPathname] = useState(pathname);
  const sheetId = useId();
  const sheetRef = useRef<HTMLDivElement>(null);
  const moreButtonRef = useRef<HTMLButtonElement>(null);
  const restoreFocusRef = useRef(false);

  // Close during render when navigation happens, rather than in an effect.
  if (pathname !== lastPathname) {
    setLastPathname(pathname);
    setOpen(false);
  }

  const close = useCallback((restoreFocus = true) => {
    restoreFocusRef.current = restoreFocus;
    setOpen(false);
  }, []);

  useEffect(() => {
    if (!open) {
      if (restoreFocusRef.current) {
        restoreFocusRef.current = false;
        moreButtonRef.current?.focus();
      }
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    sheetRef.current?.querySelector<HTMLElement>("[data-sheet-autofocus]")?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        close();
        return;
      }
      if (event.key !== "Tab") return;

      const focusables = sheetRef.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled])',
      );
      if (!focusables?.length) return;

      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, close]);

  useEffect(() => {
    const query = window.matchMedia("(min-width: 768px)");
    const onChange = () => {
      if (query.matches) setOpen(false);
    };
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  const { primary, overflow } = resolveLinks(links, primaryHrefs);
  const isActive = (href: string, prefix?: string) => {
    const target = prefix ?? href;
    return pathname === target || pathname.startsWith(`${target}/`);
  };

  // Mobile labels need to fit a five-column bar and the More sheet. Desktop
  // keeps the full page titles, so keep these short names local to this nav.
  const shortLabel = (item: PanelLink) => {
    if (!item.href.startsWith("/admin/")) return item.label;
    switch (item.href) {
      case "/admin/dashboard":
        return t("tabHome");
      case "/admin/members":
        return ta("membersTitle");
      case "/admin/orders":
        return ta("ordersTitle");
      case "/admin/products":
        return ta("productsTitle");
      case "/admin/categories":
        return ta("categoriesTitle");
      case "/admin/investments":
        return t("adminTabInvestments");
      case "/admin/distributions":
        return t("adminTabDistributions");
      case "/admin/roi-commission":
        return t("adminTabRoi");
      case "/admin/ranks":
        return t("adminTabRanks");
      case "/admin/salary":
        return t("salary");
      case "/admin/withdrawals":
        return t("adminTabWithdrawals");
      case "/admin/top-ups":
        return t("adminTabTopUps");
      case "/admin/settings":
        return ta("settingsHubTitle");
      case "/admin/gallery":
        return t("gallery");
      case "/admin/announcements":
        return t("adminTabAnnouncements");
      case "/admin/audit":
        return t("adminTabAudit");
      case "/admin/staff":
        return t("adminTabStaff");
      default:
        return item.label;
    }
  };

  const renderOverflowItem = (item: PanelLink, active: boolean, nested = false) => {
    const Icon = panelNavIcons[item.href] ?? Circle;
    const className = cn(
      "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors",
      nested ? "min-h-10 gap-2 text-[13px]" : "min-h-12",
      active
        ? "bg-primary/15 font-semibold text-primary"
        : "text-muted-foreground hover:bg-accent hover:text-foreground",
      item.locked && "opacity-60",
    );
    const content = (
      <>
        <Icon className="size-4 shrink-0" aria-hidden="true" />
        <span className="min-w-0 flex-1 truncate">{shortLabel(item)}</span>
        {item.badge && item.badge.count > 0 ? (
          <span
            className={cn(
              "flex min-w-5 shrink-0 items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-4 tabular-nums",
              item.badge.tone === "warning"
                ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                : "bg-primary/15 text-primary",
            )}
          >
            <span className="sr-only">{item.badge.label}</span>
            <span aria-hidden="true">{item.badge.count > 9 ? "9+" : item.badge.count}</span>
          </span>
        ) : null}
      </>
    );

    if (item.locked) {
      return (
        <span aria-disabled="true" title={tm("featureLockedHint")} className={className}>
          {content}
          <LockKeyhole className="size-3.5 shrink-0" aria-hidden="true" />
        </span>
      );
    }

    return (
      <Link
        href={item.href}
        aria-current={active ? "page" : undefined}
        title={item.label}
        onClick={() => close(false)}
        className={className}
      >
        {content}
      </Link>
    );
  };
  const overflowGroups: Array<{ label: string | null; items: PanelLink[] }> = [];
  for (const item of overflow) {
    const label = item.group ?? null;
    const current = overflowGroups[overflowGroups.length - 1];
    if (current && current.label === label) {
      current.items.push(item);
    } else {
      overflowGroups.push({ label, items: [item] });
    }
  }

  return (
    <>
      <nav
        aria-label={t("sections")}
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-[var(--glass)] pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden"
      >
        <div className="mx-auto grid max-w-lg grid-cols-5">
          {primary.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                title={item.label}
                className={cn(
                  "flex min-h-14 flex-col items-center justify-center gap-1 px-1 py-2 text-center transition-colors focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                  active ? "text-primary" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <NavIcon item={item} active={active} />
                <span className="block max-w-full truncate text-[10px] font-semibold leading-tight">
                  {shortLabel(item)}
                </span>
                {!item.locked && item.badge && item.badge.count > 0 ? (
                  <span className="sr-only">{item.badge.label}</span>
                ) : null}
              </Link>
            );
          })}

          <button
            ref={moreButtonRef}
            type="button"
            onClick={() => setOpen(true)}
            aria-expanded={open}
            aria-controls={open ? sheetId : undefined}
            className={cn(
              "flex min-h-14 flex-col items-center justify-center gap-1 px-1 py-2 text-center transition-colors focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
              open ? "text-primary" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <span
              className={cn(
                "flex size-8 items-center justify-center rounded-xl transition-colors",
                open && "bg-primary/15 text-primary",
              )}
            >
              <MoreHorizontal className="size-5" aria-hidden="true" />
            </span>
            <span className="block max-w-full truncate text-[10px] font-semibold leading-tight">
              {t("more")}
            </span>
          </button>
        </div>
      </nav>

      {open ? (
        <div className="fixed inset-0 z-[70] md:hidden">
          <button
            type="button"
            aria-label={t("closeMenu")}
            tabIndex={-1}
            onClick={() => close()}
            className="absolute inset-0 size-full cursor-default"
          />

          <div
            ref={sheetRef}
            id={sheetId}
            role="dialog"
            aria-modal="true"
            aria-labelledby={`${sheetId}-title`}
            className="absolute inset-x-0 bottom-0 max-h-[80vh] overflow-y-auto overscroll-contain rounded-t-3xl bg-[var(--card-solid)] pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-2xl"
          >
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-[var(--card-solid)] px-4 py-3">
              <h2 id={`${sheetId}-title`} className="font-display text-base font-bold">
                {t("moreMenu")}
              </h2>
              <button
                type="button"
                data-sheet-autofocus
                onClick={() => close()}
                aria-label={t("closeMenu")}
                className="flex size-9 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
              >
                <X className="size-4" aria-hidden="true" />
              </button>
            </div>

            <div className="grid gap-1 p-3">
              {overflowGroups.map((group, groupIndex) => (
                <div key={`${group.label ?? "links"}-${groupIndex}`} className="grid gap-1">
                  {group.label ? (
                    <p className="px-3 pb-1 pt-3 text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground/80 first:pt-1">
                      {group.label}
                    </p>
                  ) : null}
                  {group.items.map((item) => {
                    const hasChildren = Boolean(item.children?.length);
                    const active = isActive(
                      item.href,
                      hasChildren ? item.href.replace(/\/overview$/, "") : undefined,
                    );

                    return (
                      <div key={item.href} className="grid gap-1">
                        {renderOverflowItem(item, active)}
                        {hasChildren ? (
                          <div className="ml-5 flex flex-col gap-0.5 border-l border-border pl-2">
                            {item.children?.map((child) => (
                              <div key={child.href}>
                                {renderOverflowItem(child, isActive(child.href), true)}
                              </div>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>

            <div className="mt-4 flex items-center justify-between gap-3 border-t border-border px-3 pt-4">
              <div className="flex items-center gap-0.5 rounded-full border border-border bg-muted/40 p-0.5">
                <ThemeToggle className="size-9" />
                <LanguageToggle className="size-9" />
              </div>
              {signedIn ? <LogoutButton /> : null}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
