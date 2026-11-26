import {
  firstParam,
  parseAvailability,
  parseSort,
  type StoreAvailability,
  type StoreCatalogFilters,
  type StoreSort,
} from "@/lib/store-filters";

export type RawStoreQuery = {
  q: string;
  category: string;
  subcategory: string;
  brand: string;
  size: string;
  color: string;
  model: string;
  minPrice: string;
  maxPrice: string;
  availability: StoreAvailability;
  sort: StoreSort;
};

type SearchParams = Record<string, string | string[] | undefined>;

function clean(value: string | string[] | undefined): string {
  return firstParam(value)?.trim() ?? "";
}

function priceToPaisa(value: string): bigint | undefined {
  if (!value.trim()) return undefined;
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0) return undefined;
  return BigInt(Math.round(amount * 100));
}

export function parseStoreQuery(params: SearchParams): {
  raw: RawStoreQuery;
  filters: StoreCatalogFilters;
} {
  const raw: RawStoreQuery = {
    q: clean(params.q),
    category: clean(params.category),
    subcategory: clean(params.subcategory),
    brand: clean(params.brand),
    size: clean(params.size),
    color: clean(params.color),
    model: clean(params.model),
    minPrice: clean(params.minPrice),
    maxPrice: clean(params.maxPrice),
    availability: parseAvailability(params.availability),
    sort: parseSort(params.sort),
  };

  return {
    raw,
    filters: {
      query: raw.q || undefined,
      category: raw.category || undefined,
      subcategory: raw.subcategory || undefined,
      brand: raw.brand || undefined,
      size: raw.size || undefined,
      color: raw.color || undefined,
      model: raw.model || undefined,
      minPricePaisa: priceToPaisa(raw.minPrice),
      maxPricePaisa: priceToPaisa(raw.maxPrice),
      availability: raw.availability,
      sort: raw.sort,
    },
  };
}

export function storeQueryToParams(query: RawStoreQuery): URLSearchParams {
  const params = new URLSearchParams();
  if (query.q) params.set("q", query.q);
  if (query.category) params.set("category", query.category);
  if (query.subcategory) params.set("subcategory", query.subcategory);
  if (query.brand) params.set("brand", query.brand);
  if (query.size) params.set("size", query.size);
  if (query.color) params.set("color", query.color);
  if (query.model) params.set("model", query.model);
  if (query.minPrice) params.set("minPrice", query.minPrice);
  if (query.maxPrice) params.set("maxPrice", query.maxPrice);
  if (query.availability !== "all") params.set("availability", query.availability);
  if (query.sort !== "recommended") params.set("sort", query.sort);
  return params;
}

export function localizedPath(path: string, locale: string): string {
  return `/${locale}${path}`;
}
