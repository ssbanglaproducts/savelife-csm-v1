import { getTranslations } from "next-intl/server";

export async function SkipLink() {
  const t = await getTranslations("common");

  return (
    <a
      href="#main-content"
      className="sr-only rounded-xl border border-border bg-[var(--glass-strong)] px-4 py-2 text-sm font-semibold text-foreground shadow-lg backdrop-blur-xl focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-100 focus:ring-2 focus:ring-primary"
    >
      {t("skipToContent")}
    </a>
  );
}
