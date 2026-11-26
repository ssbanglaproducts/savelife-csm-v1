import type { ReactNode } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { AuthBannerVideo } from "./auth-banner-video";
import { Header } from "./header";

/**
 * Shared visual shell for sign-in and sign-up.
 *
 * The banner is deliberately image-only by default: it supplies the brand
 * atmosphere on desktop and a short visual lead-in on mobile, while all copy
 * lives in the form pane. An admin can replace it with a looping background
 * video from the admin settings page.
 */
export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col md:h-screen md:overflow-hidden">
      <Header />
      <main
        id="main-content"
        tabIndex={-1}
        className="flex flex-1 flex-col md:grid md:min-h-0 md:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]"
      >
        <section
          aria-hidden="true"
          className="relative z-0 h-36 shrink-0 overflow-hidden bg-black sm:h-44 md:-mr-8 md:h-full md:min-h-0"
        >
          <Image
            src="/images/hero-wellness.svg"
            alt=""
            fill
            priority
            sizes="(max-width: 767px) 100vw, 52vw"
            className="object-cover"
          />

          <AuthBannerVideo />

          <span className="pointer-events-none absolute inset-0 bg-black/25" />
          <span className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_25%_20%,rgba(0,201,141,0.18),transparent_55%)]" />
          <span className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-background/35 md:bg-gradient-to-r md:from-black/20 md:via-transparent md:to-background/30" />
        </section>

        <section
          className={cn(
            "relative z-20 flex min-h-0 flex-1 flex-col rounded-t-[2rem] bg-background px-5 pb-10 pt-8 sm:px-8 sm:pb-12 md:-ml-8 md:rounded-l-[3.5rem] md:px-12 md:pb-10 md:pt-10 md:pl-16 md:overflow-y-auto lg:px-16 lg:pl-20",
          )}
        >
          <span
            className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-primary/60 to-transparent md:hidden"
            aria-hidden="true"
          />
          <div className="mx-auto my-auto w-full max-w-xl">{children}</div>
        </section>
      </main>
    </div>
  );
}
