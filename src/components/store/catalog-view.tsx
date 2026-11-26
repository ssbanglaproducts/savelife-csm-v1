import { SearchX } from "lucide-react";
import { getTranslations } from "next-intl/server";
import type { StoreCatalogResult, StoreFacets } from "@/lib/store-filters";
import type { StoreProduct } from "@/lib/catalog";
import { localizedPath, type RawStoreQuery } from "@/lib/store-query";
import { CatalogControls } from "./catalog-controls";
import { ProductGrid } from "./product-grid";

export async function CatalogView({
  catalog,
  facets,
  query,
  locale,
  basePath,
}: {
  catalog: StoreCatalogResult<StoreProduct>;
  facets?: StoreFacets;
  query: RawStoreQuery;
  locale: string;
  basePath: string;
}) {
  const tc = await getTranslations("catalogue");
  const usedFacets = facets ?? catalog.facets;

  const resetParams = new URLSearchParams();
  if (query.q) resetParams.set("q", query.q);
  if (query.category) resetParams.set("category", query.category);
  const resetSuffix = resetParams.toString();
  const resetHref = `${basePath}${resetSuffix ? `?${resetSuffix}` : ""}`;

  return (
    <CatalogControls
      facets={usedFacets}
      query={query}
      basePath={basePath}
      action={localizedPath(basePath, locale)}
      resetHref={resetHref}
      resultCount={catalog.products.length}
    >
      {catalog.products.length > 0 ? (
        <ProductGrid products={catalog.products} locale={locale} />
      ) : (
        <div className="glass flex flex-col items-center rounded-3xl px-6 py-16 text-center">
          <span className="flex size-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
            <SearchX className="size-6" aria-hidden="true" />
          </span>
          <h2 className="mt-4 font-display text-lg font-bold">{tc("noProducts")}</h2>
          <p className="mt-2 max-w-sm text-sm text-muted-foreground">
            {query.q ? tc("emptySearchHint", { query: query.q }) : tc("emptyFilterHint")}
          </p>
        </div>
      )}
    </CatalogControls>
  );
}
