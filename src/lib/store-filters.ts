export type StoreVariantGroups = {
  size?: string[];
  color?: string[];
  model?: string[];
};

export type StoreSpecification = {
  label: string;
  labelBn?: string | null;
  value: string;
  valueBn?: string | null;
};

export type StoreSort =
  | "recommended"
  | "price-asc"
  | "price-desc"
  | "newest"
  | "oldest";

export type StoreAvailability = "all" | "in-stock" | "out-of-stock";

export type StoreCatalogFilters = {
  query?: string;
  category?: string;
  subcategory?: string;
  brand?: string;
  size?: string;
  color?: string;
  model?: string;
  minPricePaisa?: bigint;
  maxPricePaisa?: bigint;
  availability?: StoreAvailability;
  sort?: StoreSort;
};

export type StoreFilterProduct = {
  id: string;
  name: string;
  nameBn: string | null;
  description: string | null;
  descriptionBn: string | null;
  categorySlug: string | null;
  categoryName: string | null;
  categoryNameBn: string | null;
  pricePaisa: string;
  stock: number;
  sku: string | null;
  brand: string | null;
  subcategory: string | null;
  variants: StoreVariantGroups | null;
  specifications: StoreSpecification[] | null;
  isFeatured: boolean;
  createdAt: string;
};

export type StoreFacetValue = {
  value: string;
  count: number;
};

export type StoreFacets = {
  categories: StoreFacetValue[];
  subcategories: StoreFacetValue[];
  brands: StoreFacetValue[];
  sizes: StoreFacetValue[];
  colors: StoreFacetValue[];
  models: StoreFacetValue[];
  minPricePaisa: bigint;
  maxPricePaisa: bigint;
};

export type StoreCatalogResult<T extends StoreFilterProduct = StoreFilterProduct> = {
  products: T[];
  allProducts: T[];
  facets: StoreFacets;
  total: number;
};

export const SORT_OPTIONS: ReadonlyArray<{ value: StoreSort; labelKey: string }> = [
  { value: "recommended", labelKey: "sortRecommended" },
  { value: "price-asc", labelKey: "sortPriceLow" },
  { value: "price-desc", labelKey: "sortPriceHigh" },
  { value: "newest", labelKey: "sortNewest" },
  { value: "oldest", labelKey: "sortOldest" },
];

const VARIANT_KEYS = ["size", "color", "model"] as const;

function normalize(value: string): string {
  return value.trim().toLocaleLowerCase();
}

function pushFacet(map: Map<string, number>, value: string | null | undefined) {
  const normalized = value?.trim();
  if (!normalized) return;
  map.set(normalized, (map.get(normalized) ?? 0) + 1);
}

function sortedFacets(map: Map<string, number>): StoreFacetValue[] {
  return [...map.entries()]
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => a.value.localeCompare(b.value));
}

export function buildStoreFacets(products: StoreFilterProduct[]): StoreFacets {
  const categories = new Map<string, number>();
  const subcategories = new Map<string, number>();
  const brands = new Map<string, number>();
  const sizes = new Map<string, number>();
  const colors = new Map<string, number>();
  const models = new Map<string, number>();

  let minPricePaisa = BigInt(Number.MAX_SAFE_INTEGER);
  let maxPricePaisa = 0n;

  for (const product of products) {
    pushFacet(categories, product.categorySlug);
    pushFacet(subcategories, product.subcategory);
    pushFacet(brands, product.brand);

    for (const key of VARIANT_KEYS) {
      for (const value of product.variants?.[key] ?? []) {
        pushFacet(key === "size" ? sizes : key === "color" ? colors : models, value);
      }
    }

    const price = BigInt(product.pricePaisa);
    if (price < minPricePaisa) minPricePaisa = price;
    if (price > maxPricePaisa) maxPricePaisa = price;
  }

  if (products.length === 0) {
    minPricePaisa = 0n;
  }

  return {
    categories: sortedFacets(categories),
    subcategories: sortedFacets(subcategories),
    brands: sortedFacets(brands),
    sizes: sortedFacets(sizes),
    colors: sortedFacets(colors),
    models: sortedFacets(models),
    minPricePaisa,
    maxPricePaisa,
  };
}

function matchesText(haystack: Array<string | null | undefined>, needle: string): boolean {
  const query = normalize(needle);
  if (!query) return true;
  return haystack.some((value) => value && normalize(value).includes(query));
}

function matchesVariant(product: StoreFilterProduct, key: (typeof VARIANT_KEYS)[number], selected?: string): boolean {
  if (!selected) return true;
  const values = product.variants?.[key] ?? [];
  return values.some((value) => normalize(value) === normalize(selected));
}

function comparePrices(a: StoreFilterProduct, b: StoreFilterProduct): number {
  const left = BigInt(a.pricePaisa);
  const right = BigInt(b.pricePaisa);
  return left < right ? -1 : left > right ? 1 : 0;
}

export function filterStoreProducts<T extends StoreFilterProduct>(
  products: T[],
  filters: StoreCatalogFilters = {},
): StoreCatalogResult<T> {
  const facets = buildStoreFacets(products);
  const sort = filters.sort ?? "recommended";
  const availability = filters.availability ?? "all";

  const filtered = products.filter((product) => {
    if (filters.query && !matchesText(
      [product.name, product.nameBn, product.description, product.descriptionBn, product.sku, product.brand],
      filters.query,
    )) return false;

    if (filters.category && product.categorySlug !== filters.category) return false;
    if (filters.subcategory && normalize(product.subcategory ?? "") !== normalize(filters.subcategory)) return false;
    if (filters.brand && normalize(product.brand ?? "") !== normalize(filters.brand)) return false;
    if (!matchesVariant(product, "size", filters.size)) return false;
    if (!matchesVariant(product, "color", filters.color)) return false;
    if (!matchesVariant(product, "model", filters.model)) return false;

    const price = BigInt(product.pricePaisa);
    if (filters.minPricePaisa !== undefined && price < filters.minPricePaisa) return false;
    if (filters.maxPricePaisa !== undefined && price > filters.maxPricePaisa) return false;

    if (availability === "in-stock" && product.stock <= 0) return false;
    if (availability === "out-of-stock" && product.stock > 0) return false;

    return true;
  });

  const sorted = [...filtered].sort((a, b) => {
    switch (sort) {
      case "price-asc":
        return comparePrices(a, b);
      case "price-desc":
        return comparePrices(b, a);
      case "newest":
        return b.createdAt.localeCompare(a.createdAt);
      case "oldest":
        return a.createdAt.localeCompare(b.createdAt);
      default: {
        if (a.isFeatured !== b.isFeatured) return a.isFeatured ? -1 : 1;
        return b.createdAt.localeCompare(a.createdAt);
      }
    }
  });

  return {
    products: sorted,
    allProducts: products,
    facets,
    total: products.length,
  };
}

export function parseSort(value: string | string[] | undefined): StoreSort {
  const raw = Array.isArray(value) ? value[0] : value;
  return SORT_OPTIONS.some((option) => option.value === raw) ? (raw as StoreSort) : "recommended";
}

export function parseAvailability(value: string | string[] | undefined): StoreAvailability {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw === "in-stock" || raw === "out-of-stock" ? raw : "all";
}

export function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
