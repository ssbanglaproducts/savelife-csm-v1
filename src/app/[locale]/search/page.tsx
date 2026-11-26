import { getTranslations, setRequestLocale } from "next-intl/server";
import { StoreShell } from "@/components/layout/store-shell";
import { CatalogView } from "@/components/store/catalog-view";
import { SearchField } from "@/components/store/search-field";
import { getCatalog } from "@/lib/catalog";
import { localizedPath, parseStoreQuery } from "@/lib/store-query";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

export default async function SearchPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const [query, t] = await Promise.all([searchParams, getTranslations("catalogue")]);
  const parsed = parseStoreQuery(query);
  const catalog = await getCatalog(parsed.filters);

  return (
    <StoreShell>
      <div className="space-y-7">
        <header className="glass relative overflow-hidden rounded-3xl p-6 sm:p-8">
          <span
            className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary to-transparent"
            aria-hidden="true"
          />
          <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
            {parsed.raw.q ? t("searchResultsFor", { query: parsed.raw.q }) : t("searchTitle")}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">{t("searchHint")}</p>
          <div className="mt-6">
            <SearchField action={localizedPath("/search", locale)} defaultValue={parsed.raw.q} />
          </div>
        </header>

        <CatalogView
          catalog={catalog}
          query={parsed.raw}
          locale={locale}
          basePath="/search"
        />
      </div>
    </StoreShell>
  );
}
