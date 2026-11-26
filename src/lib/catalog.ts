import { prisma } from "@/lib/prisma";
import { parseProductVideo, type ProductVideo } from "@/lib/product-video";
import {
  buildStoreFacets,
  filterStoreProducts,
  type StoreCatalogFilters,
  type StoreCatalogResult,
  type StoreFilterProduct,
  type StoreSpecification,
  type StoreVariantGroups,
} from "@/lib/store-filters";

export type StoreCategory = {
  id: string;
  name: string;
  nameBn: string | null;
  slug: string;
  description: string | null;
  image: string;
};

export type StoreProduct = StoreFilterProduct & {
  slug: string;
  image: string;
  images: string[];
  compareAtPaisa: string | null;
  video?: ProductVideo | null;
};

export type ProductFilters = StoreCatalogFilters;

type DbStoreProduct = {
  id: string;
  slug: string;
  name: string;
  nameBn: string | null;
  description: string | null;
  descriptionBn: string | null;
  category?: { name: string; nameBn: string | null; slug: string } | null;
  sku: string | null;
  brand: string | null;
  subcategory: string | null;
  variants: unknown;
  specifications: unknown;
  video?: unknown;
  pricePaisa: bigint;
  compareAtPaisa: bigint | null;
  stock: number;
  isActive: boolean;
  isFeatured: boolean;
  createdAt: Date;
  images?: Array<{ url: string }>;
};

const image = "/images/store-fallback.svg";

const fallbackCategories: StoreCategory[] = [
  { id: "c1", name: "Health & Wellness", nameBn: "স্বাস্থ্য ও কল্যাণ", slug: "health-wellness", description: "Everyday wellbeing essentials.", image },
  { id: "c2", name: "Nutrition", nameBn: "পুষ্টি", slug: "nutrition", description: "Daily nourishment made simple.", image },
  { id: "c3", name: "Personal Care", nameBn: "ব্যক্তিগত যত্ন", slug: "personal-care", description: "Care you can feel every day.", image },
  { id: "c4", name: "Home & Living", nameBn: "বাড়ি ও জীবনযাপন", slug: "home-living", description: "Thoughtful pieces for your space.", image },
  { id: "c5", name: "Daily Essentials", nameBn: "দৈনিক প্রয়োজন", slug: "daily-essentials", description: "The basics, done better.", image },
  { id: "c6", name: "Baby & Family", nameBn: "শিশু ও পরিবার", slug: "baby-family", description: "Gentle care for the whole family.", image },
];

type FallbackProduct = Omit<StoreProduct, "categoryName" | "categoryNameBn" | "images">;

const fallbackProducts: FallbackProduct[] = [
  { id: "p1", slug: "daily-multivitamin", name: "Daily Multivitamin", nameBn: "ডেইলি মাল্টিভিটামিন", description: "A balanced daily vitamin blend for everyday energy and immunity.", descriptionBn: "দৈনিক শক্তি ও রোগপ্রতিরোধের জন্য সুষম ভিটামিন মিশ্রণ।", categorySlug: "health-wellness", pricePaisa: "129000", compareAtPaisa: "159000", stock: 42, sku: "SL-WEL-001", brand: "Savelife", subcategory: "Vitamins", variants: { size: ["30 tablets", "60 tablets"] }, specifications: [{ label: "Serving", value: "1 tablet daily" }, { label: "Form", value: "Tablet" }], isFeatured: true, createdAt: "2026-01-12T09:00:00.000Z", image },
  { id: "p2", slug: "pure-honey-500g", name: "Pure Honey 500g", nameBn: "খাঁটি মধু ৫০০ গ্রাম", description: "Raw, unfiltered honey with a clean, natural finish.", descriptionBn: "প্রাকৃতিক ও অফিল্টারড খাঁটি মধু।", categorySlug: "nutrition", pricePaisa: "89000", compareAtPaisa: null, stock: 68, sku: "SL-NUT-002", brand: "Savelife", subcategory: "Natural Sweetener", variants: { size: ["250g", "500g"] }, specifications: [{ label: "Origin", value: "Local apiaries" }, { label: "Type", value: "Raw honey" }], isFeatured: true, createdAt: "2026-01-18T09:00:00.000Z", image },
  { id: "p3", slug: "herbal-skin-serum", name: "Herbal Glow Serum", nameBn: "হার্বাল গ্লো সিরাম", description: "Lightweight botanical serum for a calm, hydrated glow.", descriptionBn: "হালকা বোটানিক্যাল সিরাম, ত্বকে প্রাকৃতিক উজ্জ্বলতা।", categorySlug: "personal-care", pricePaisa: "175000", compareAtPaisa: "210000", stock: 24, sku: "SL-CARE-003", brand: "Savelife", subcategory: "Skincare", variants: { size: ["30ml"] }, specifications: [{ label: "Skin type", value: "All skin types" }, { label: "Application", value: "Morning and night" }], isFeatured: true, createdAt: "2026-02-02T09:00:00.000Z", image },
  { id: "p4", slug: "organic-green-tea", name: "Organic Green Tea", nameBn: "অর্গানিক গ্রিন টি", description: "Whole-leaf green tea with a fresh, delicate taste.", descriptionBn: "সতেজ স্বাদের সম্পূর্ণ পাতার গ্রিন টি।", categorySlug: "health-wellness", pricePaisa: "65000", compareAtPaisa: null, stock: 85, sku: "SL-WEL-004", brand: "Greenfield", subcategory: "Tea", variants: { size: ["50 sachets", "100 sachets"] }, specifications: [{ label: "Leaves", value: "Whole leaf" }, { label: "Caffeine", value: "Moderate" }], isFeatured: false, createdAt: "2026-02-08T09:00:00.000Z", image },
  { id: "p5", slug: "omega-3-capsules", name: "Omega-3 Capsules", nameBn: "ওমেগা-৩ ক্যাপসুল", description: "Clean fish oil capsules for heart and brain support.", descriptionBn: "হৃদয় ও মস্তিষ্কের স্বাস্থ্যের জন্য বিশুদ্ধ ফিশ অয়েল।", categorySlug: "nutrition", pricePaisa: "245000", compareAtPaisa: "280000", stock: 31, sku: "SL-NUT-005", brand: "Savelife", subcategory: "Supplements", variants: { size: ["60 capsules", "120 capsules"] }, specifications: [{ label: "EPA + DHA", value: "1000mg" }, { label: "Form", value: "Softgel" }], isFeatured: true, createdAt: "2026-01-28T09:00:00.000Z", image },
  { id: "p6", slug: "aloe-body-wash", name: "Aloe Body Wash", nameBn: "অ্যালো বডি ওয়াশ", description: "A gentle, sulfate-free cleanse with aloe vera.", descriptionBn: "অ্যালো ভেরা দিয়ে মৃদু, সালফেট-মুক্ত পরিষ্কার।", categorySlug: "personal-care", pricePaisa: "48000", compareAtPaisa: null, stock: 120, sku: "SL-CARE-006", brand: "Savelife", subcategory: "Bath & Body", variants: { size: ["250ml", "500ml"] }, specifications: [{ label: "Formula", value: "Sulfate-free" }, { label: "Suitable for", value: "Daily use" }], isFeatured: false, createdAt: "2026-01-05T09:00:00.000Z", image },
  { id: "p7", slug: "bamboo-storage-set", name: "Bamboo Storage Set", nameBn: "বাঁশের স্টোরেজ সেট", description: "Three stackable bamboo boxes for a calmer kitchen.", descriptionBn: "রান্নাঘরে পরিপাটির জন্য তিনটি স্ট্যাকেবল বাঁশের বক্স।", categorySlug: "home-living", pricePaisa: "320000", compareAtPaisa: "370000", stock: 18, sku: "SL-HOME-007", brand: "Nestbound", subcategory: "Storage", variants: { color: ["Natural", "Charcoal"] }, specifications: [{ label: "Material", value: "Bamboo" }, { label: "Pieces", value: "3" }], isFeatured: false, createdAt: "2026-02-14T09:00:00.000Z", image },
  { id: "p8", slug: "cotton-tote-bag", name: "Everyday Cotton Tote", nameBn: "ডেইলি কটন টোট", description: "A sturdy, reusable tote for daily errands.", descriptionBn: "দৈনিক ব্যবহারের জন্য মজবুত, পুনরায় ব্যবহারযোগ্য টোট।", categorySlug: "daily-essentials", pricePaisa: "35000", compareAtPaisa: null, stock: 210, sku: "SL-DAILY-008", brand: "Savelife", subcategory: "Bags", variants: { color: ["Ivory", "Forest", "Navy"] }, specifications: [{ label: "Material", value: "Cotton canvas" }, { label: "Capacity", value: "12 litres" }], isFeatured: false, createdAt: "2025-12-20T09:00:00.000Z", image },
  { id: "p9", slug: "baby-care-bundle", name: "Baby Care Bundle", nameBn: "শিশু যত্ন বান্ডিল", description: "A gentle starter set for delicate skin.", descriptionBn: "কোমল ত্বকের জন্য প্রয়োজনীয় শিশু যত্ন সেট।", categorySlug: "baby-family", pricePaisa: "215000", compareAtPaisa: "260000", stock: 27, sku: "SL-BABY-009", brand: "Savelife", subcategory: "Baby Care", variants: { size: ["Starter set", "Full set"] }, specifications: [{ label: "Age", value: "0–24 months" }, { label: "Contents", value: "4 pieces" }], isFeatured: true, createdAt: "2026-01-30T09:00:00.000Z", image },
  { id: "p10", slug: "vitamin-c-effervescent", name: "Vitamin C Effervescent", nameBn: "ভিটামিন সি ইফার্ভেসেন্ট", description: "Fizzy vitamin C tablets with a bright citrus taste.", descriptionBn: "সাইট্রাস স্বাদের ভিটামিন সি ট্যাবলেট।", categorySlug: "health-wellness", pricePaisa: "99000", compareAtPaisa: null, stock: 74, sku: "SL-WEL-010", brand: "Savelife", subcategory: "Vitamins", variants: { size: ["10 tablets", "20 tablets"] }, specifications: [{ label: "Strength", value: "1000mg" }, { label: "Flavour", value: "Citrus" }], isFeatured: false, createdAt: "2026-02-18T09:00:00.000Z", image },
  { id: "p11", slug: "ceramic-diffuser", name: "Ceramic Aroma Diffuser", nameBn: "সিরামিক অ্যারোমা ডিফিউজার", description: "A quiet, sculptural diffuser for calmer evenings.", descriptionBn: "শান্ত সন্ধ্যার জন্য নীরব ও সুন্দর ডিফিউজার।", categorySlug: "home-living", pricePaisa: "420000", compareAtPaisa: "490000", stock: 15, sku: "SL-HOME-011", brand: "Nestbound", subcategory: "Aroma", variants: { color: ["Sand", "Moss"] }, specifications: [{ label: "Material", value: "Ceramic" }, { label: "Runtime", value: "Up to 8 hours" }], isFeatured: false, createdAt: "2026-02-22T09:00:00.000Z", image },
  { id: "p12", slug: "protein-oat-bites", name: "Protein Oat Bites", nameBn: "প্রোটিন ওট বিটস", description: "A quick, wholesome snack for busy days.", descriptionBn: "ব্যস্ত দিনের জন্য দ্রুত ও পুষ্টিকর স্ন্যাক।", categorySlug: "nutrition", pricePaisa: "78000", compareAtPaisa: null, stock: 96, sku: "SL-NUT-012", brand: "Greenfield", subcategory: "Snacks", variants: { size: ["6 pieces", "12 pieces"] }, specifications: [{ label: "Protein", value: "8g per serving" }, { label: "Whole grain", value: "Oats" }], isFeatured: false, createdAt: "2026-01-10T09:00:00.000Z", image },
];

function withCategory(product: FallbackProduct): StoreProduct {
  const category = fallbackCategories.find((item) => item.slug === product.categorySlug);
  return {
    ...product,
    images: [product.image],
    categoryName: category?.name ?? null,
    categoryNameBn: category?.nameBn ?? null,
  };
}

function toStringOrNull(value: bigint | null | undefined): string | null {
  return value === null || value === undefined ? null : value.toString();
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function stringList(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const values = value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
  return values.length > 0 ? values : undefined;
}

function parseVariants(value: unknown): StoreVariantGroups | null {
  const record = asRecord(value);
  if (!record) return null;
  const variants: StoreVariantGroups = {};
  const size = stringList(record.size);
  const color = stringList(record.color);
  const model = stringList(record.model);
  if (size) variants.size = size;
  if (color) variants.color = color;
  if (model) variants.model = model;
  return Object.keys(variants).length > 0 ? variants : null;
}

function parseSpecifications(value: unknown): StoreSpecification[] | null {
  if (!Array.isArray(value)) return null;
  const specifications = value.flatMap((item) => {
    const record = asRecord(item);
    if (!record) return [];
    const label = typeof record.label === "string" ? record.label.trim() : "";
    const labelBn = typeof record.labelBn === "string" ? record.labelBn.trim() : null;
    const fieldValue = typeof record.value === "string" ? record.value.trim() : "";
    const valueBn = typeof record.valueBn === "string" ? record.valueBn.trim() : null;
    if (!label || !fieldValue) return [];
    return [{ label, labelBn, value: fieldValue, valueBn }];
  });
  return specifications.length > 0 ? specifications : null;
}

function mapDbProduct(product: DbStoreProduct): StoreProduct {
  const images = (product.images ?? []).map((item) => item.url).filter(Boolean);
  return {
    id: product.id,
    slug: product.slug,
    name: product.name,
    nameBn: product.nameBn,
    description: product.description,
    descriptionBn: product.descriptionBn,
    categorySlug: product.category?.slug ?? null,
    categoryName: product.category?.name ?? null,
    categoryNameBn: product.category?.nameBn ?? null,
    pricePaisa: product.pricePaisa.toString(),
    compareAtPaisa: toStringOrNull(product.compareAtPaisa),
    stock: product.stock,
    sku: product.sku,
    brand: product.brand,
    subcategory: product.subcategory,
    variants: parseVariants(product.variants),
    specifications: parseSpecifications(product.specifications),
    video: parseProductVideo(product.video),
    image: images[0] ?? image,
    images: images.length > 0 ? images : [image],
    isFeatured: product.isFeatured,
    createdAt: product.createdAt.toISOString(),
  };
}

async function loadCatalogProducts(): Promise<StoreProduct[]> {
  try {
    const products = await prisma.product.findMany({
      where: { isActive: true },
      include: {
        images: { orderBy: { sortOrder: "asc" } },
        category: { select: { name: true, nameBn: true, slug: true } },
      },
      orderBy: [{ isFeatured: "desc" }, { createdAt: "desc" }],
    });

    if (products.length === 0) return fallbackProducts.map(withCategory);
    return products.map(mapDbProduct);
  } catch {
    return fallbackProducts.map(withCategory);
  }
}

export async function getCategories(): Promise<StoreCategory[]> {
  try {
    const categories = await prisma.category.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        nameBn: true,
        slug: true,
        description: true,
        image: true,
      },
    });

    if (categories.length === 0) return fallbackCategories;
    return categories.map((category) => ({ ...category, image: category.image || image }));
  } catch {
    return fallbackCategories;
  }
}

export async function getFeaturedProducts(limit = 8): Promise<StoreProduct[]> {
  const products = await loadCatalogProducts();
  return products.filter((product) => product.isFeatured).slice(0, limit);
}

export async function getProducts(filters: ProductFilters = {}): Promise<StoreProduct[]> {
  return (await getCatalog(filters)).products;
}

export async function getCatalog(filters: ProductFilters = {}): Promise<StoreCatalogResult<StoreProduct>> {
  const products = await loadCatalogProducts();
  return filterStoreProducts(products, filters);
}

export async function getCategoryBySlug(slug: string): Promise<StoreCategory | null> {
  const categories = await getCategories();
  return categories.find((category) => category.slug === slug) ?? null;
}

export async function getCategoriesWithCounts(): Promise<Array<StoreCategory & { count: number }>> {
  const [categories, catalog] = await Promise.all([getCategories(), getCatalog()]);
  return categories.map((category) => ({
    ...category,
    count: catalog.facets.categories.find((item) => item.value === category.slug)?.count ?? 0,
  }));
}

export async function getProductBySlug(slug: string): Promise<StoreProduct | null> {
  try {
    const product = await prisma.product.findUnique({
      where: { slug },
      include: {
        images: { orderBy: { sortOrder: "asc" } },
        category: { select: { name: true, nameBn: true, slug: true } },
      },
    });
    if (!product || !product.isActive) return null;
    return mapDbProduct(product);
  } catch {
    const product = fallbackProducts.find((item) => item.slug === slug);
    return product ? withCategory(product) : null;
  }
}

export async function getProductById(id: string): Promise<StoreProduct | null> {
  try {
    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        images: { orderBy: { sortOrder: "asc" } },
        category: { select: { name: true, nameBn: true, slug: true } },
      },
    });
    if (!product || !product.isActive) return null;
    return mapDbProduct(product);
  } catch {
    const product = fallbackProducts.find((item) => item.id === id);
    return product ? withCategory(product) : null;
  }
}

export { buildStoreFacets };
