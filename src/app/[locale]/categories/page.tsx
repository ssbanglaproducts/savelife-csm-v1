import { getTranslations, setRequestLocale } from "next-intl/server";
import Image from "next/image";
import { Images } from "lucide-react";
import { StoreShell } from "@/components/layout/store-shell";
import { Link } from "@/i18n/navigation";
import { getCategoriesWithCounts } from "@/lib/catalog";

export const dynamic = "force-dynamic";

export default async function CategoriesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const [t, categories] = await Promise.all([
    getTranslations("store"),
    getCategoriesWithCounts(),
  ]);

  return (
    <StoreShell>
      <div className="space-y-7">
        <header className="glass relative overflow-hidden rounded-3xl p-6 sm:p-8">
          <span
            className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary to-transparent"
            aria-hidden="true"
          />
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-primary">
            {t("categoriesPageTitle")}
          </p>
          <h1 className="mt-2 font-display text-3xl font-bold tracking-tight sm:text-4xl">
            {t("categoriesTitle")}
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            {t("categoriesPageIntro")}
          </p>
        </header>

        {categories.length === 0 ? (
          <div className="glass grid place-items-center rounded-3xl px-6 py-16 text-center text-muted-foreground">
            <Images className="size-8" aria-hidden="true" />
            <p className="mt-3 text-sm">{t("categoriesHint")}</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
            {categories.map((category) => {
              const name = locale === "bn" && category.nameBn ? category.nameBn : category.name;
              return (
                <Link
                  key={category.id}
                  href={`/products?category=${encodeURIComponent(category.slug)}`}
                  className="group relative aspect-[2/1] min-w-0 overflow-hidden rounded-3xl border border-border bg-muted shadow-sm outline-none transition-transform hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background motion-reduce:transition-none"
                >
                  <Image
                    src={category.image}
                    alt=""
                    fill
                    unoptimized
                    sizes="(max-width: 1024px) 50vw, 33vw"
                    className="object-cover transition-transform duration-500 group-hover:scale-105 motion-reduce:transition-none"
                  />
                  <span
                    className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent"
                    aria-hidden="true"
                  />
                  <span className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 p-3 text-white sm:gap-3 sm:p-5">
                    <span className="min-w-0">
                      <span className="block truncate font-display text-lg font-bold drop-shadow sm:text-2xl">
                        {name}
                      </span>
                    </span>
                    <span className="shrink-0 rounded-full border border-white/25 bg-black/45 px-2 py-0.5 text-[10px] font-bold tabular-nums backdrop-blur-sm sm:px-3 sm:py-1 sm:text-xs">
                      {t("categoryProductCount", { count: category.count })}
                    </span>
                  </span>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </StoreShell>
  );
}
