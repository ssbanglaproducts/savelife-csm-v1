import { ShieldAlert } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { BrandLogo } from "@/components/layout/brand-logo";
import { LanguageToggle } from "@/components/layout/language-toggle";
import { LogoutButton } from "@/components/layout/logout-button";
import { buttonVariants } from "@/components/ui/button";

/** Covers every member route when an admin has deactivated the account. */
export async function AccountLockedScreen({ note }: { note: string | null }) {
  const [t, tn] = await Promise.all([
    getTranslations("memberPanel"),
    getTranslations("nav"),
  ]);

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden">
      <div
        className="pointer-events-none absolute inset-0 bg-[var(--background)] opacity-60 blur-sm"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute -left-24 top-1/4 size-96 rounded-full bg-red-500/10 blur-3xl"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute -right-24 bottom-1/4 size-96 rounded-full bg-amber-500/10 blur-3xl"
        aria-hidden="true"
      />

      <header className="relative z-10 flex h-16 items-center gap-3 border-b border-border bg-[var(--glass)] px-4 backdrop-blur-xl sm:px-6">
        <BrandLogo size={32} />
        <div className="ml-auto flex items-center gap-1">
          <LanguageToggle />
          <Link href="/" className={buttonVariants({ variant: "ghost", size: "sm" })}>
            {tn("store")}
          </Link>
          <LogoutButton />
        </div>
      </header>

      <main className="relative z-10 flex flex-1 items-center justify-center px-4 py-12">
        <section className="glass w-full max-w-lg rounded-3xl border border-red-500/30 p-8 text-center shadow-2xl animate-rise">
          <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-red-500/10 text-red-500">
            <ShieldAlert className="size-7" aria-hidden="true" />
          </div>
          <h1 className="mt-5 text-2xl font-bold tracking-tight">{t("accountLockedTitle")}</h1>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            {t("accountLockedIntro")}
          </p>

          <div className="mt-6 rounded-2xl border border-amber-500/30 bg-amber-500/5 px-5 py-4 text-left">
            <p className="text-xs font-bold tracking-[0.12em] text-amber-500">
              {t("accountLockedNoteLabel")}
            </p>
            <p className="mt-2 whitespace-pre-wrap break-words text-sm font-medium">
              {note?.trim() || t("accountLockedNoNote")}
            </p>
          </div>

          <p className="mt-6 text-xs text-muted-foreground">{t("accountLockedFootnote")}</p>
        </section>
      </main>
    </div>
  );
}
