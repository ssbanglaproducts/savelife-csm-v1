"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { SlidersHorizontal, X } from "lucide-react";
import { Link, useRouter } from "@/i18n/navigation";
import { SORT_OPTIONS, type StoreFacets, type StoreSort } from "@/lib/store-filters";
import { storeQueryToParams, type RawStoreQuery } from "@/lib/store-query";

function FilterField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-bold uppercase tracking-[0.08em] text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  );
}

const controlClass =
  "h-11 w-full rounded-xl border border-border bg-[var(--card-solid)] px-3 text-sm outline-none transition focus-visible:ring-2 focus-visible:ring-ring";

export function CatalogControls({
  facets,
  query,
  basePath,
  action,
  resetHref,
  resultCount,
  children,
}: {
  facets: StoreFacets;
  query: RawStoreQuery;
  basePath: string;
  action: string;
  resetHref: string;
  resultCount: number;
  children: ReactNode;
}) {
  const t = useTranslations("catalogue");
  const router = useRouter();
  const panelId = useId();
  const [open, setOpen] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  function changeSort(sort: StoreSort) {
    const params = storeQueryToParams({ ...query, sort });
    const suffix = params.toString();
    router.push(`${basePath}${suffix ? `?${suffix}` : ""}`);
  }

  function fields() {
    return (
      <>
        <input type="hidden" name="q" value={query.q} />

        {facets.categories.length > 0 ? (
          <FilterField label={t("category")}>
            <select name="category" defaultValue={query.category} className={controlClass}>
              <option value="">{t("allCategories")}</option>
              {facets.categories.map((facet) => (
                <option key={facet.value} value={facet.value}>
                  {facet.value} ({facet.count})
                </option>
              ))}
            </select>
          </FilterField>
        ) : null}

        {facets.subcategories.length > 0 ? (
          <FilterField label={t("subcategory")}>
            <select name="subcategory" defaultValue={query.subcategory} className={controlClass}>
              <option value="">{t("all")}</option>
              {facets.subcategories.map((facet) => (
                <option key={facet.value} value={facet.value}>
                  {facet.value} ({facet.count})
                </option>
              ))}
            </select>
          </FilterField>
        ) : null}

        {facets.brands.length > 0 ? (
          <FilterField label={t("brand")}>
            <select name="brand" defaultValue={query.brand} className={controlClass}>
              <option value="">{t("all")}</option>
              {facets.brands.map((facet) => (
                <option key={facet.value} value={facet.value}>
                  {facet.value} ({facet.count})
                </option>
              ))}
            </select>
          </FilterField>
        ) : null}

        {facets.sizes.length > 0 ? (
          <FilterField label={t("size")}>
            <select name="size" defaultValue={query.size} className={controlClass}>
              <option value="">{t("all")}</option>
              {facets.sizes.map((facet) => (
                <option key={facet.value} value={facet.value}>
                  {facet.value} ({facet.count})
                </option>
              ))}
            </select>
          </FilterField>
        ) : null}

        {facets.colors.length > 0 ? (
          <FilterField label={t("color")}>
            <select name="color" defaultValue={query.color} className={controlClass}>
              <option value="">{t("all")}</option>
              {facets.colors.map((facet) => (
                <option key={facet.value} value={facet.value}>
                  {facet.value} ({facet.count})
                </option>
              ))}
            </select>
          </FilterField>
        ) : null}

        {facets.models.length > 0 ? (
          <FilterField label={t("model")}>
            <select name="model" defaultValue={query.model} className={controlClass}>
              <option value="">{t("all")}</option>
              {facets.models.map((facet) => (
                <option key={facet.value} value={facet.value}>
                  {facet.value} ({facet.count})
                </option>
              ))}
            </select>
          </FilterField>
        ) : null}

        <fieldset>
          <legend className="mb-1.5 text-xs font-bold uppercase tracking-[0.08em] text-muted-foreground">
            {t("priceRange")}
          </legend>
          <div className="grid grid-cols-2 gap-2">
            <input
              type="number"
              name="minPrice"
              min="0"
              step="1"
              defaultValue={query.minPrice}
              placeholder={t("minPrice")}
              aria-label={t("minPrice")}
              className={controlClass}
            />
            <input
              type="number"
              name="maxPrice"
              min="0"
              step="1"
              defaultValue={query.maxPrice}
              placeholder={t("maxPrice")}
              aria-label={t("maxPrice")}
              className={controlClass}
            />
          </div>
        </fieldset>

        <FilterField label={t("availability")}>
          <select name="availability" defaultValue={query.availability} className={controlClass}>
            <option value="all">{t("allProducts")}</option>
            <option value="in-stock">{t("inStock")}</option>
            <option value="out-of-stock">{t("outOfStock")}</option>
          </select>
        </FilterField>

        <div className="flex gap-2 pt-1">
          <button type="submit" className="h-11 flex-1 rounded-xl bg-primary text-sm font-bold text-primary-foreground">
            {t("applyFilters")}
          </button>
          <Link
            href={resetHref}
            className="flex h-11 items-center justify-center rounded-xl border border-border px-4 text-sm font-bold text-muted-foreground transition hover:text-foreground"
          >
            {t("reset")}
          </Link>
        </div>
      </>
    );
  }

  const sortLabels: Record<StoreSort, string> = {
    recommended: t("sortRecommended"),
    "price-asc": t("sortPriceLow"),
    "price-desc": t("sortPriceHigh"),
    newest: t("sortNewest"),
    oldest: t("sortOldest"),
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          <span className="font-bold text-foreground">{resultCount}</span> {t("results")}
        </p>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
            <span className="hidden sm:inline">{t("sortBy")}</span>
            <select
              value={query.sort}
              onChange={(event) => changeSort(event.target.value as StoreSort)}
              aria-label={t("sortBy")}
              className="h-10 rounded-xl border border-border bg-[var(--card-solid)] px-3 text-sm font-semibold text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {sortLabels[option.value]}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-haspopup="dialog"
            aria-expanded={open}
            aria-controls={open ? panelId : undefined}
            className="flex h-10 items-center gap-2 rounded-xl border border-border bg-[var(--card-solid)] px-3 text-sm font-bold md:hidden"
          >
            <SlidersHorizontal className="size-4" aria-hidden="true" />
            {t("filters")}
          </button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
        <aside aria-label={t("filters")} className="glass hidden h-fit rounded-2xl p-4 md:block">
          <h2 className="mb-4 font-display text-base font-bold">{t("filters")}</h2>
          <form action={action} method="get" className="space-y-4">
            {fields()}
          </form>
        </aside>

        <div id="catalog-results" className="min-w-0">
          {children}
        </div>
      </div>

      {open ? (
        <div className="md:hidden">
          <button
            type="button"
            tabIndex={-1}
            aria-label={t("closeFilters")}
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-50 h-[100dvh] w-full cursor-default"
          />
          <div
            id={panelId}
            role="dialog"
            aria-modal="true"
            aria-label={t("filters")}
            className="fixed inset-x-0 bottom-0 z-[60] max-h-[85dvh] overflow-y-auto rounded-t-3xl border-t border-border bg-[var(--card-solid)] px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-4 shadow-2xl"
          >
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="font-display text-lg font-bold">{t("filters")}</h2>
              <button
                ref={closeRef}
                type="button"
                onClick={() => setOpen(false)}
                aria-label={t("closeFilters")}
                className="rounded-lg p-2 text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                <X className="size-4" aria-hidden="true" />
              </button>
            </div>
            <form action={action} method="get" className="space-y-4">
              {fields()}
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}

