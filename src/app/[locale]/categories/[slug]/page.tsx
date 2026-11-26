import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { StoreShell } from "@/components/layout/store-shell";
import { CatalogView } from "@/components/store/catalog-view";
import { CategoryStrip } from "@/components/store/category-strip";
import { SearchField } from "@/components/store/search-field";
import {
  buildStoreFacets,
  getCatalog,
  getCategories,
  getCategoryBySlug,
  getProducts,
} from "@/lib/catalog";
import { localizedPath, parseStoreQuery } from "@/lib/store-query";
import { cn } from "@/lib/utils";
import { Link } from "@/i18n/navigation";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

export default async function CategoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; slug: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { locale, slug } = await params;
  setRequestLocale(locale);

  const [query, t, categories, category] = await Promise.all([
    searchParams,
    getTranslations("catalogue"),
    getCategories(),
    getCategoryBySlug(slug),
  ]);
  if (!category) notFound();

  const parsed = parseStoreQuery(query);
  const effectiveQuery = { ...parsed.raw, category: slug };
  const [catalog, categoryProducts] = await Promise.all([
    getCatalog({ ...parsed.filters, category: slug }),
    getProducts({ category: slug }),
  ]);
  const subcategoryFacets = buildStoreFacets(categoryProducts).subcategories;

  return (
    <StoreShell>
      <div className="space-y-7">
        <header className="glass relative overflow-hidden rounded-3xl p-6 sm:p-8">
          <span
            className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary to-transparent"
            aria-hidden="true"
          />
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-primary">
            {t("categoryLabel")}
          </p>
          <h1 className="mt-2 font-display text-3xl font-bold tracking-tight sm:text-4xl">
            {locale === "bn" && category.nameBn ? category.nameBn : category.name}
          </h1>
          {category.description ? (
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{category.description}</p>
          ) : null}
          <div className="mt-6">
            <SearchField
              action={localizedPath(`/categories/${slug}`, locale)}
              defaultValue={effectiveQuery.q}
            />
          </div>
        </header>

        <CategoryStrip categories={categories} locale={locale} activeSlug={slug} />

        {subcategoryFacets.length > 0 ? (
          <nav aria-label={t("subcategory")} className="flex flex-wrap gap-2">
            <Link
              href={`/categories/${slug}`}
              className={cn(
                "rounded-full px-4 py-2 text-sm font-semibold transition",
                !effectiveQuery.subcategory
                  ? "bg-primary text-primary-foreground"
                  : "border border-border bg-[var(--card-solid)] text-muted-foreground hover:text-primary",
              )}
            >
              {t("all")}
            </Link>
            {subcategoryFacets.map((facet) => (
              <Link
                key={facet.value}
                href={`/categories/${slug}?subcategory=${encodeURIComponent(facet.value)}`}
                className={cn(
                  "rounded-full px-4 py-2 text-sm font-semibold transition",
                  effectiveQuery.subcategory === facet.value
                    ? "bg-primary text-primary-foreground"
                    : "border border-border bg-[var(--card-solid)] text-muted-foreground hover:text-primary",
                )}
              >
                {facet.value}
              </Link>
            ))}
          </nav>
        ) : null}

        <CatalogView
          catalog={catalog}
          query={effectiveQuery}
          locale={locale}
          basePath={`/categories/${slug}`}
        />
      </div>
    </StoreShell>
  );
}
