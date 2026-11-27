"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import {
  Images,
  Info,
  LayoutGrid,
  Menu,
  ShoppingBag,
  ShoppingCart,
  Wallet,
  X,
  type LucideIcon,
} from "lucide-react";
import { Link, usePathname } from "@/i18n/navigation";
import { buttonVariants } from "@/components/ui/button";
import { CopyableMemberId } from "@/components/ui/copyable-member-id";
import { UserAvatar } from "@/components/ui/user-avatar";
import { useHideHeaderOnScroll } from "@/hooks/use-hide-header-on-scroll";
import { formatSP } from "@/lib/money";
import { canUseCart } from "@/lib/purchase-rules";
import type { Viewer } from "@/lib/viewer";
import { cn } from "@/lib/utils";
import { BrandLogo } from "./brand-logo";
import { LanguageToggle } from "./language-toggle";
import { NotificationMenu } from "./notification-menu";
import { ProfileMenu } from "./profile-menu";
import { ThemeToggle } from "./theme-toggle";

const MENU_PARAM = "menu";

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  active: boolean;
  count?: number;
};

type ViewerResponse = {
  viewer: Viewer | null;
  availablePaisa: string;
};

export function Header() {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const onLoginPage = pathname === "/login" || pathname === "/admin-login";
  const onRegisterPage = pathname === "/register";
  const [mobileOpen, setMobileOpen] = useState(false);
  const { hidden, reveal } = useHideHeaderOnScroll(mobileOpen);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const restoreMenuFocusRef = useRef(false);

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
  const availablePaisa = BigInt(viewerData?.availablePaisa ?? "0");
  const memberStatus = viewer?.role === "MEMBER" ? viewer.status : null;
  const cartAllowed = canUseCart(memberStatus);

  const setMenuUrl = useCallback((open: boolean) => {
    const url = new URL(window.location.href);
    if (open) url.searchParams.set(MENU_PARAM, "open");
    else url.searchParams.delete(MENU_PARAM);
    const nextUrl = `${url.pathname}${url.search}${url.hash}`;
    window.history[open ? "pushState" : "replaceState"](null, "", nextUrl);
    setMobileOpen(open);
  }, []);

  const closeMenu = useCallback(
    (restoreFocus = true) => {
      restoreMenuFocusRef.current = restoreFocus;
      reveal();
      setMenuUrl(false);
    },
    [reveal, setMenuUrl],
  );

  useEffect(() => {
    if (!mobileOpen) {
      if (restoreMenuFocusRef.current) {
        restoreMenuFocusRef.current = false;
        menuButtonRef.current?.focus();
      }
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialogRef.current?.querySelector<HTMLElement>("[data-menu-autofocus]")?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeMenu();
        return;
      }
      if (event.key !== "Tab") return;

      const focusables = dialogRef.current?.querySelectorAll<HTMLElement>(
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
  }, [mobileOpen, closeMenu]);

  const navItems: NavItem[] = [
    {
      href: "/products",
      label: t("products"),
      icon: ShoppingBag,
      active: pathname.startsWith("/products"),
    },
    {
      href: "/categories",
      label: t("categories"),
      icon: LayoutGrid,
      active: pathname.startsWith("/categories"),
    },
    {
      href: "/about",
      label: t("aboutUs"),
      icon: Info,
      active: pathname.startsWith("/about"),
    },
    {
      href: "/gallery",
      label: t("gallery"),
      icon: Images,
      active: pathname.startsWith("/gallery"),
    },
    {
      href: "/cart",
      label: t("cart"),
      icon: ShoppingCart,
      active: pathname.startsWith("/cart"),
      count: cartCount,
    },
  ];

  const primaryNav = navItems.filter((item) => item.href !== "/cart");
  // Inactive members cannot use the cart or checkout. Home delivery unlocks
  // only after activation, so every cart affordance is hidden for them.
  const menuItems = cartAllowed ? navItems : navItems.filter((item) => item.href !== "/cart");
  const cartLabel =
    cartCount > 0 ? t("cartWithCount", { count: cartCount }) : t("cart");
  const onCheckout = pathname.startsWith("/checkout");
  const onCartPage = pathname.startsWith("/cart");
  const showMobileCart = cartAllowed && !onCheckout && !onCartPage;
  const showBalancePill = Boolean(viewer) && !onCheckout;
  const showCartPill = cartAllowed && cartCount > 0 && !onCheckout && !onCartPage;
  const showFloatingDock = showBalancePill || showCartPill;

  return (
    <>
      <header
        onFocusCapture={reveal}
        className={cn(
          "sticky top-0 z-50 border-b border-border bg-[var(--glass)] pt-[env(safe-area-inset-top)] backdrop-blur-xl",
          "transition-transform duration-200 ease-out will-change-transform motion-reduce:transition-none",
          hidden && "-translate-y-full",
        )}
      >
        <span
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary to-transparent"
          aria-hidden="true"
        />

        <div className="relative mx-auto flex h-[76px] w-full max-w-7xl items-center gap-4 px-4 sm:px-6 lg:px-10">
          <Link
            href="/"
            aria-label={t("home")}
            className="shrink-0 rounded-xl focus-visible:ring-2 focus-visible:ring-ring md:hidden"
          >
            <BrandLogo size={36} priority wordmarkClassName="text-sm" csmClassName="text-[9px]" />
          </Link>
          <Link
            href="/"
            className="hidden shrink-0 rounded-xl focus-visible:ring-2 focus-visible:ring-ring md:inline-flex"
          >
            <BrandLogo
              size={36}
              priority
              wordmarkClassName="text-lg font-bold sm:text-xl"
              csmClassName="text-[10px] tracking-[0.14em] sm:text-[11px]"
            />
          </Link>

          <nav
            aria-label={t("primary")}
            className="glass absolute left-1/2 top-1/2 hidden -translate-x-1/2 -translate-y-1/2 rounded-full p-1 lg:flex"
          >
            {primaryNav.map(({ href, label, active }) => (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "rounded-full px-4 py-2 text-sm font-semibold transition-colors",
                  active
                    ? "bg-primary/15 text-primary"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground",
                )}
              >
                {label}
              </Link>
            ))}
          </nav>

          <div className="ml-auto flex shrink-0 items-center gap-2">
            <div className="glass flex items-center gap-0.5 rounded-full p-1">
              <ThemeToggle className="size-8" />
              <LanguageToggle className="size-8 shrink-0" />
            </div>

            {viewer ? <NotificationMenu /> : null}

            <span
              className="mx-0.5 hidden h-6 w-px bg-border sm:block"
              aria-hidden="true"
            />

            {viewer ? (
              <ProfileMenu viewer={viewer} showName />
            ) : (
              <>
                {onLoginPage ? null : (
                  <Link
                    href="/login"
                    className={cn(
                      buttonVariants({ variant: "ghost", size: "sm" }),
                      "hidden shrink-0 sm:inline-flex",
                    )}
                  >
                    {t("login")}
                  </Link>
                )}

                {onRegisterPage ? null : (
                  <Link href="/register" className={buttonVariants({ size: "sm" })}>
                    <span className="hidden sm:inline">{t("register")}</span>
                    <span className="shrink-0 sm:hidden">{t("joinUs")}</span>
                  </Link>
                )}
              </>
            )}

            {showMobileCart ? (
              <Link
                href="/cart"
                aria-label={cartLabel}
                title={cartLabel}
                className={cn(
                  buttonVariants({ variant: "outline", size: "icon" }),
                  "relative hidden size-10 shrink-0 md:inline-flex lg:hidden",
                )}
              >
                <ShoppingCart className="size-[18px]" aria-hidden="true" />
                {cartCount > 0 ? (
                  <span
                    aria-hidden="true"
                    className="absolute -right-1 -top-1 flex min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold leading-4 text-primary-foreground"
                  >
                    {cartCount > 99 ? "99+" : cartCount}
                  </span>
                ) : null}
              </Link>
            ) : null}

            <button
              ref={menuButtonRef}
              type="button"
              onClick={() => setMenuUrl(true)}
              aria-expanded={mobileOpen}
              aria-controls={mobileOpen ? "header-mobile-menu" : undefined}
              aria-label={t("menu")}
              className={cn(
                buttonVariants({ variant: "outline", size: "icon" }),
                "hidden size-10 shrink-0 md:inline-flex lg:hidden",
              )}
            >
              <Menu className="size-[18px]" aria-hidden="true" />
            </button>
          </div>
        </div>

        <span className="sr-only" role="status" aria-live="polite" aria-atomic="true">
          {showBalancePill ? `${t("availableBalance")}: ${formatSP(availablePaisa)}. ` : ""}
          {cartAllowed ? (cartCount > 0 ? t("itemsInCart", { count: cartCount }) : t("cartEmpty")) : ""}
        </span>

        {mobileOpen ? (
          <div className="lg:hidden">
            <button
              type="button"
              tabIndex={-1}
              aria-label={t("closeMenu")}
              onClick={() => closeMenu()}
              className="fixed inset-0 z-40 h-[100dvh] w-full cursor-default bg-black/25"
            />

            <div
              ref={dialogRef}
              id="header-mobile-menu"
              role="dialog"
              aria-modal="true"
              aria-labelledby="header-mobile-menu-title"
              style={{
                top: "calc(76px + env(safe-area-inset-top))",
                maxHeight: "calc(100dvh - 76px - env(safe-area-inset-top))",
              }}
              className="header-sheet fixed inset-x-0 z-50 overflow-y-auto overscroll-contain rounded-b-3xl border-b border-border bg-[var(--card-solid)] px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-4 shadow-2xl sm:px-6"
            >
              <div className="mx-auto w-full max-w-7xl">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h2
                    id="header-mobile-menu-title"
                    className="text-xs font-bold tracking-[0.14em] text-muted-foreground"
                  >
                    {t("primary")}
                  </h2>
                  <button
                    type="button"
                    data-menu-autofocus
                    onClick={() => closeMenu()}
                    aria-label={t("closeMenu")}
                    className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "size-10")}
                  >
                    <X className="size-[18px]" aria-hidden="true" />
                  </button>
                </div>

                <nav aria-label={t("primary")} className="grid gap-1.5">
                  {menuItems.map(({ href, label, icon: Icon, active, count }) => (
                    <Link
                      key={href}
                      href={href}
                      aria-current={active ? "page" : undefined}
                      onClick={() => setMenuUrl(false)}
                      className={cn(
                        "flex min-h-12 items-center gap-3 rounded-2xl px-3 py-3 text-sm font-semibold transition-colors",
                        active
                          ? "bg-primary/15 text-primary"
                          : "hover:bg-accent hover:text-foreground",
                      )}
                    >
                      <span
                        className={cn(
                          "flex size-9 shrink-0 items-center justify-center rounded-xl",
                          active ? "bg-primary/15" : "bg-muted/60",
                        )}
                      >
                        <Icon className="size-[18px] text-primary" aria-hidden="true" />
                      </span>
                      <span className="min-w-0 flex-1">{label}</span>
                      {typeof count === "number" && count > 0 ? (
                        <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-bold tabular-nums text-primary-foreground">
                          {count > 99 ? "99+" : count}
                        </span>
                      ) : null}
                    </Link>
                  ))}
                </nav>

                <div className="mt-3 flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between sm:gap-0">
                  <div className="glass flex items-center gap-0.5 rounded-full p-1">
                    <ThemeToggle className="size-8" />
                    <LanguageToggle className="size-8 shrink-0" />
                  </div>
                  <div className="flex w-full items-center justify-between gap-3 sm:w-auto">
                    {viewer ? (
                      <div className="flex w-full items-center gap-3 rounded-2xl bg-muted/40 p-2.5">
                        <UserAvatar
                          name={viewer.name}
                          src={viewer.image}
                          className="size-10 rounded-full"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold">{viewer.name}</p>
                          {viewer.memberId ? (
                            <div className="mt-1">
                              <CopyableMemberId memberId={viewer.memberId} compact />
                            </div>
                          ) : null}
                        </div>
                        <Link
                          href={
                            viewer.role === "ADMIN" || viewer.role === "STAFF"
                              ? "/admin/dashboard"
                              : "/member/dashboard"
                          }
                          onClick={() => setMenuUrl(false)}
                          className={cn(
                            buttonVariants({ variant: "outline", size: "sm" }),
                            "shrink-0",
                          )}
                        >
                          {t("dashboard")}
                        </Link>
                      </div>
                    ) : (
                      <>
                        {onLoginPage ? null : (
                          <Link
                            href="/login"
                            onClick={() => setMenuUrl(false)}
                            className={cn(buttonVariants({ variant: "outline" }), "min-w-0 flex-1 sm:flex-none")}
                          >
                            {t("login")}
                          </Link>
                        )}
                        {onRegisterPage ? null : (
                          <Link
                            href="/register"
                            onClick={() => setMenuUrl(false)}
                            className={cn(buttonVariants({ variant: "outline" }), "min-w-0 flex-1 sm:flex-none")}
                          >
                            {t("register")}
                          </Link>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </header>

      {showFloatingDock ? (
        <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 hidden items-end justify-end gap-2 p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] md:flex">
          {showBalancePill ? (
            <Link
              href="/member/wallet"
              aria-label={`${t("availableBalance")}: ${formatSP(availablePaisa)}`}
              className="glass-strong pointer-events-auto inline-flex h-14 min-w-0 items-center gap-2.5 rounded-full pl-3.5 pr-4 shadow-[0_18px_40px_-18px_rgba(0,0,0,0.45)] transition-transform duration-200 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background active:translate-y-0 motion-reduce:transition-none"
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
                <Wallet className="size-[18px]" aria-hidden="true" />
              </span>
              <span className="min-w-0">
                <span className="block text-[10px] font-semibold leading-none text-muted-foreground">
                  {t("availableBalance")}
                </span>
                <span className="mt-1 block text-sm font-bold tabular-nums leading-none">
                  {formatSP(availablePaisa)}
                </span>
              </span>
            </Link>
          ) : null}

          {showCartPill ? (
            <Link
              href="/cart"
              aria-label={cartLabel}
              className="pointer-events-auto group inline-flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-[0_18px_40px_-12px_rgba(0,0,0,0.45)] ring-1 ring-black/5 transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-[0_22px_48px_-12px_rgba(0,0,0,0.5)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background active:translate-y-0 motion-reduce:transition-none"
            >
              <span className="relative flex size-9 items-center justify-center rounded-full bg-primary-foreground/15">
                <ShoppingCart className="size-[18px]" aria-hidden="true" />
                <span
                  aria-hidden="true"
                  className="absolute -right-2 -top-2 flex min-w-5 items-center justify-center rounded-full bg-foreground px-1 text-[10px] font-bold tabular-nums leading-5 text-background"
                >
                  {cartCount > 99 ? "99+" : cartCount}
                </span>
              </span>
            </Link>
          ) : null}
        </div>
      ) : null}
    </>
  );
}
