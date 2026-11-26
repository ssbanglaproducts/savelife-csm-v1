import type { ReactNode } from "react";
import { Header } from "./header";
import { SiteFooter } from "./site-footer";
import { StoreBottomNav } from "./store-bottom-nav";

/** Shared chrome for standalone Store routes. */
export function StoreShell({
  children,
  maxWidth = "max-w-7xl",
}: {
  children: ReactNode;
  maxWidth?: string;
}) {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main
        id="main-content"
        tabIndex={-1}
        className={`mx-auto w-full ${maxWidth} flex-1 px-4 pb-28 pt-8 sm:px-6 sm:pt-10 md:pb-12 lg:px-10`}
      >
        {children}
      </main>
      <SiteFooter />
      <StoreBottomNav />
    </div>
  );
}
