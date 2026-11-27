"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { useHideHeaderOnScroll } from "@/hooks/use-hide-header-on-scroll";
import { cn } from "@/lib/utils";
import type { Viewer } from "@/lib/viewer";
import { BrandLogo } from "./brand-logo";
import { LanguageToggle } from "./language-toggle";
import { NotificationMenu } from "./notification-menu";
import { PanelBottomNav } from "./panel-bottom-nav";
import type { PanelLink } from "./panel-nav-types";
import { ProfileMenu } from "./profile-menu";
import { ThemeToggle } from "./theme-toggle";

/** Client chrome for both panels so the sticky sidebar follows the header. */
export function PanelChrome({
  title,
  avatar,
  desktopNav,
  links,
  primaryHrefs,
  children,
}: {
  title?: string;
  avatar?: Viewer;
  desktopNav: ReactNode;
  links: PanelLink[];
  primaryHrefs: string[];
  children: ReactNode;
}) {
  const t = useTranslations("nav");
  const { hidden, reveal } = useHideHeaderOnScroll();

  return (
    <div className="flex min-h-screen flex-col">
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
        <div className="relative flex h-16 w-full items-center gap-3 px-4 sm:px-6 xl:px-8">
          <Link
            href="/"
            aria-label={t("home")}
            className="min-w-0 shrink-0 rounded-xl focus-visible:ring-2 focus-visible:ring-ring"
          >
            <BrandLogo size={32} priority wordmarkClassName="text-sm" csmClassName="text-[9px]" />
          </Link>

          {title ? (
            <span className="glass hidden rounded-full px-3 py-1 text-xs font-semibold sm:inline-flex">
              {title}
            </span>
          ) : null}

          <div className="ml-auto flex items-center gap-2">
            <div
              role="group"
              aria-label={t("preferences")}
              className="flex items-center rounded-full border border-border bg-muted/40 p-0.5"
            >
              <ThemeToggle className="size-8" />
              <span className="mx-0.5 h-5 w-px bg-border" aria-hidden="true" />
              <LanguageToggle className="size-8" />
            </div>

            <NotificationMenu />
            {avatar ? <ProfileMenu viewer={avatar} header /> : null}
          </div>
        </div>
      </header>

      <div className="flex w-full flex-1 gap-6 px-4 py-6 sm:px-6 sm:py-8 xl:px-8">
        {/* Fixed to the viewport so the desktop navigation never scrolls away
            with page content. The inner wrapper uses the same gutters as the
            content column, keeping the sidebar exactly aligned. */}
        <div className="pointer-events-none fixed inset-x-0 bottom-8 top-[calc(6rem+env(safe-area-inset-top))] z-30 hidden md:block">
          <div className="h-full w-full px-4 sm:px-6 xl:px-8">
            <aside className="glass pointer-events-auto h-full w-64 overflow-y-auto overscroll-contain rounded-2xl">
              {desktopNav}
            </aside>
          </div>
        </div>
        <main
          id="main-content"
          className="min-w-0 flex-1 pb-24 md:ml-[17.5rem] md:pb-10"
          tabIndex={-1}
        >
          {children}
        </main>
      </div>

      <PanelBottomNav
        links={links}
        primaryHrefs={primaryHrefs}
        signedIn={Boolean(avatar)}
      />
    </div>
  );
}
