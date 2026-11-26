import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { BrandLogo } from "./brand-logo";

export async function SiteFooter() {
  const [tn, ta, tc, td] = await Promise.all([
    getTranslations("nav"),
    getTranslations("app"),
    getTranslations("common"),
    getTranslations("dashboard"),
  ]);
  const year = new Date().getFullYear();

  return (
    <footer className="relative border-t border-border bg-[var(--glass)] backdrop-blur-xl">
      <span
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary to-transparent"
        aria-hidden="true"
      />
      <div className="mx-auto grid w-full max-w-7xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-[1.5fr_1fr_1fr] lg:px-10">
        <div className="min-w-0">
          <BrandLogo size={40} />
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-muted-foreground">
            {ta("tagline")}
          </p>
        </div>

        <nav aria-label={tn("footer")} className="min-w-0">
          <h2 className="font-display text-base font-bold">{tn("store")}</h2>
          <ul className="mt-4 space-y-3 text-sm text-muted-foreground">
            <li>
              <Link href="/" className="rounded-lg transition-colors hover:text-primary">
                {tn("store")}
              </Link>
            </li>
            <li>
              <Link href="/login" className="rounded-lg transition-colors hover:text-primary">
                {tn("login")}
              </Link>
            </li>
            <li>
              <Link href="/register" className="rounded-lg transition-colors hover:text-primary">
                {tn("register")}
              </Link>
            </li>
            <li>
              <Link href="/about" className="rounded-lg transition-colors hover:text-primary">
                {tn("aboutUs")}
              </Link>
            </li>
            <li>
              <Link href="/gallery" className="rounded-lg transition-colors hover:text-primary">
                {tn("gallery")}
              </Link>
            </li>
          </ul>
        </nav>

        <nav aria-label={tn("account")} className="min-w-0">
          <h2 className="font-display text-base font-bold">{tn("dashboard")}</h2>
          <ul className="mt-4 space-y-3 text-sm text-muted-foreground">
            <li>
              <Link
                href="/member/dashboard"
                className="rounded-lg transition-colors hover:text-primary"
              >
                {td("memberPanel")}
              </Link>
            </li>
            <li>
              <Link
                href="/admin/dashboard"
                className="rounded-lg transition-colors hover:text-primary"
              >
                {td("adminPanel")}
              </Link>
            </li>
          </ul>
        </nav>
      </div>

      <div className="border-t border-border px-4 py-5 sm:px-6 lg:px-10">
        <p className="mx-auto max-w-7xl text-xs text-muted-foreground">
          © {year} {ta("name")}. {tc("allRightsReserved")}
        </p>
      </div>
    </footer>
  );
}
