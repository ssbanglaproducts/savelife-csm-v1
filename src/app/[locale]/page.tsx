import { getTranslations, setRequestLocale } from "next-intl/server";
import { StoreShell } from "@/components/layout/store-shell";
import { CategoryStrip } from "@/components/store/category-strip";
import { HeroCarousel, type HeroSlide } from "@/components/store/hero-carousel";
import { ProductGrid } from "@/components/store/product-grid";
import { SearchField } from "@/components/store/search-field";
import { getCatalog, getCategories } from "@/lib/catalog";
import { localizedPath } from "@/lib/store-query";

export const dynamic = "force-dynamic";

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const [t, tn, categories, catalog] = await Promise.all([
    getTranslations("store"),
    getTranslations("nav"),
    getCategories(),
    getCatalog({ sort: "recommended" }),
  ]);

  const slides: HeroSlide[] = [
    { src: "/images/hero-wellness.svg", alt: t("heroSlideWellness"), href: "/products" },
    { src: "/images/hero-nutrition.svg", alt: t("heroSlideNutrition"), href: "/categories/nutrition" },
    { src: "/images/hero-home.svg", alt: t("heroSlideHome"), href: "/categories/home-living" },
  ];

  return (
    <StoreShell>
      <div className="space-y-8">
        <SearchField action={localizedPath("/search", locale)} />

        <HeroCarousel slides={slides} label={t("heroCarouselLabel")} />

        <section id="categories" className="space-y-3">
          <h2 className="font-display text-xl font-bold tracking-tight">{tn("categories")}</h2>
          <CategoryStrip categories={categories} locale={locale} />
        </section>

        <section aria-labelledby="all-products-heading" className="space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 id="all-products-heading" className="font-display text-2xl font-bold tracking-tight">
                {t("allProducts")}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">{t("allProductsHint")}</p>
            </div>
          </div>
          <ProductGrid products={catalog.products} locale={locale} />
        </section>
      </div>
    </StoreShell>
  );
}
