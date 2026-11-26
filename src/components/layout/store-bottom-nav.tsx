"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import {
  Images,
  Info,
  LayoutDashboard,
  LogIn,
  MoreHorizontal,
  Package,
  ShoppingBag,
  ShoppingCart,
  UserPlus,
  UserRound,
  Wallet,
  X,
  type LucideIcon,
} from "lucide-react";
import { Link, usePathname } from "@/i18n/navigation";
import { LogoutButton } from "@/components/layout/logout-button";
import type { Viewer } from "@/lib/viewer";
import { cn } from "@/lib/utils";
import { LanguageToggle } from "./language-toggle";
import { ThemeToggle } from "./theme-toggle";

type ViewerResponse = { viewer: Viewer | null; availablePaisa: string };

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  active: boolean;
  count?: number;
  emphasized?: boolean;
};

function isStorePath(pathname: string): boolean {
  return (
    pathname === "/" ||
    pathname.startsWith("/products") ||
    pathname.startsWith("/categories") ||
    pathname.startsWith("/search")
  );
}

function isOrdersPath(pathname: string): boolean {
  return pathname.startsWith("/orders") || pathname.startsWith("/member/orders");
}

/** Mobile-only Store navigation. The cart is part of the bar, never floating. */
export function StoreBottomNav() {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const sheetId = useId();
  const dashboardHintId = `${sheetId}-dashboard-hint`;
  const sheetRef = useRef<HTMLDivElement>(null);
  const moreButtonRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [dashboardHintOpen, setDashboardHintOpen] = useState(false);
  const lastPathname = useRef(pathname);
  const dashboardHintTimer = useRef<number | null>(null);
  const restoreFocusRef = useRef(false);

  const { data: cartCount = 0 } = useQuery({
    queryKey: ["cart-count"],
    queryFn: async () => {
      try {
        const response = await fetch("/api/cart/count");
        if (!response.ok) return 0;
        const data = (await response.json()) as { count?: number };
        return data.count ?? 0;
      } catch {
        return 0;
      }
    },
    staleTime: 30_000,
  });

  const { data: viewerData } = useQuery({
    queryKey: ["viewer"],
    queryFn: async (): Promise<ViewerResponse> => {
      try {
        const response = await fetch("/api/me", { cache: "no-store" });
        if (!response.ok) return { viewer: null, availablePaisa: "0" };
        return (await response.json()) as ViewerResponse;
      } catch {
        return { viewer: null, availablePaisa: "0" };
      }
    },
    staleTime: 30_000,
  });

  const viewer = viewerData?.viewer ?? null;

  useEffect(() => {
    if (pathname !== lastPathname.current) {
      lastPathname.current = pathname;
      setOpen(false);
    }
  }, [pathname]);

  useEffect(
    () => () => {
      if (dashboardHintTimer.current !== null) {
        window.clearTimeout(dashboardHintTimer.current);
      }
    },
    [],
  );

  const close = useCallback((restoreFocus = true) => {
    restoreFocusRef.current = restoreFocus;
    setOpen(false);
  }, []);

  const dismissDashboardHint = useCallback(() => {
    if (dashboardHintTimer.current !== null) {
      window.clearTimeout(dashboardHintTimer.current);
      dashboardHintTimer.current = null;
    }
    setDashboardHintOpen(false);
  }, []);

  const showDashboardHint = useCallback(() => {
    if (dashboardHintTimer.current !== null) {
      window.clearTimeout(dashboardHintTimer.current);
    }
    setDashboardHintOpen(true);
    dashboardHintTimer.current = window.setTimeout(() => {
      setDashboardHintOpen(false);
      dashboardHintTimer.current = null;
    }, 4000);
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
        'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
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

  const items: NavItem[] = [
    {
      href: "/member/dashboard",
      label: t("dashboard"),
      icon: LayoutDashboard,
      active: pathname.startsWith("/member/dashboard"),
    },
    {
      href: "/",
      label: t("store"),
      icon: ShoppingBag,
      active: isStorePath(pathname),
    },
    {
      href: "/cart",
      label: t("cart"),
      icon: ShoppingCart,
      active: pathname.startsWith("/cart"),
      count: cartCount,
      emphasized: true,
    },
    {
      href: "/member/orders",
      label: t("orders"),
      icon: Package,
      active: isOrdersPath(pathname),
    },
  ];

  return (
    <>
      <nav
        aria-label={t("sections")}
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-[var(--glass)] pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden"
      >
        <div className="mx-auto grid max-w-lg grid-cols-5">
          {items.map((item) => {
            const Icon = item.icon;
            const active = item.active;
            const className = cn(
              "relative flex min-h-16 flex-col items-center justify-center gap-1 px-1 py-2 text-center transition-colors focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
              active ? "text-primary" : "text-muted-foreground hover:text-foreground",
            );
            const content = (
              <>
                <span
                  className={cn(
                    "relative flex items-center justify-center rounded-2xl transition-colors",
                    item.emphasized
                      ? "size-10 bg-primary/12 text-primary ring-1 ring-primary/20"
                      : "size-8",
                    active && !item.emphasized && "bg-primary/15 text-primary",
                  )}
                >
                  <Icon className={cn("shrink-0", item.emphasized ? "size-6" : "size-5")} aria-hidden="true" />
                  {item.count && item.count > 0 ? (
                    <span
                      aria-hidden="true"
                      className="absolute -right-1.5 -top-1.5 flex min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold leading-4 text-primary-foreground"
                    >
                      {item.count > 99 ? "99+" : item.count}
                    </span>
                  ) : null}
                </span>
                <span className={cn("block max-w-full truncate leading-tight", item.emphasized ? "text-[11px] font-bold" : "text-[10px] font-semibold")}>
                  {item.label}
                </span>
              </>
            );

            if (item.href === "/member/dashboard" && !viewer) {
              return (
                <div key={item.href} className="relative">
                  <button
                    type="button"
                    aria-label={item.label}
                    aria-describedby={dashboardHintOpen ? dashboardHintId : undefined}
                    title={t("dashboardSignInHint")}
                    onClick={showDashboardHint}
                    className={className}
                  >
                    {content}
                  </button>
                  {dashboardHintOpen ? (
                    <span
                      id={dashboardHintId}
                      role="alert"
                      className="pointer-events-none absolute bottom-[calc(100%+0.5rem)] left-0 z-50 w-max max-w-[calc(100vw-2rem)] rounded-lg bg-foreground px-3 py-2 text-left text-xs font-medium leading-snug text-background shadow-lg"
                    >
                      {t("dashboardSignInHint")}
                    </span>
                  ) : null}
                </div>
              );
            }

            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                aria-label={item.count ? t("cartWithCount", { count: item.count }) : item.label}
                onClick={dismissDashboardHint}
                className={className}
              >
                {content}
              </Link>
            );
          })}

          <button
            ref={moreButtonRef}
            type="button"
            onClick={() => {
              dismissDashboardHint();
              setOpen(true);
            }}
            aria-expanded={open}
            aria-controls={open ? sheetId : undefined}
            aria-label={t("moreMenu")}
            className="flex min-h-16 flex-col items-center justify-center gap-1 px-1 py-2 text-center text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
          >
            <span className="flex size-8 items-center justify-center rounded-xl">
              <MoreHorizontal className="size-5" aria-hidden="true" />
            </span>
            <span className="block text-[10px] font-semibold leading-tight">{t("more")}</span>
          </button>
        </div>
      </nav>

      {open ? (
        <div className="md:hidden">
          <button
            type="button"
            tabIndex={-1}
            aria-label={t("closeMenu")}
            onClick={() => close()}
            className="fixed inset-0 z-40 h-[100dvh] w-full cursor-default"
          />
          <div
            ref={sheetRef}
            id={sheetId}
            role="dialog"
            aria-modal="true"
            aria-label={t("moreMenu")}
            className="fixed inset-x-0 bottom-0 z-50 rounded-t-3xl border-t border-border bg-[var(--card-solid)] pb-[calc(1rem+env(safe-area-inset-bottom))] pt-4 shadow-2xl"
          >
            <div className="mx-auto w-full max-w-lg px-4 sm:px-6">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h2 className="font-display text-base font-bold">{t("moreMenu")}</h2>
                <button
                  type="button"
                  data-sheet-autofocus
                  onClick={() => close()}
                  aria-label={t("closeMenu")}
                  className="rounded-lg p-2 text-muted-foreground hover:bg-accent hover:text-foreground"
                >
                  <X className="size-4" aria-hidden="true" />
                </button>
              </div>

              <nav className="grid grid-cols-2 gap-2" aria-label={t("moreMenu")}>
                <MoreLink href="/about" icon={Info} label={t("aboutUs")} />
                <MoreLink href="/gallery" icon={Images} label={t("gallery")} />
                <MoreLink href="/member/profile" icon={UserRound} label={t("profile")} />
                <MoreLink href="/member/wallet" icon={Wallet} label={t("wallet")} />
                {viewer ? null : <MoreLink href="/login" icon={LogIn} label={t("login")} />}
                {viewer ? null : <MoreLink href="/register" icon={UserPlus} label={t("register")} />}
              </nav>

              <div className="mt-4 flex items-center justify-between gap-3 border-t border-border pt-4">
                <div className="flex items-center gap-0.5 rounded-full border border-border bg-muted/40 p-0.5">
                  <ThemeToggle className="size-9" />
                  <LanguageToggle className="size-9" />
                </div>
                {viewer ? <LogoutButton /> : null}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

function MoreLink({
  href,
  icon: Icon,
  label,
}: {
  href: string;
  icon: LucideIcon;
  label: string;
}) {
  return (
    <Link
      href={href}
      className="flex min-h-11 items-center gap-2 rounded-xl border border-border px-3 text-sm font-semibold transition-colors hover:bg-accent"
    >
      <Icon className="size-4 shrink-0 text-primary" aria-hidden="true" />
      <span className="truncate">{label}</span>
    </Link>
  );
}
