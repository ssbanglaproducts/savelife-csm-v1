"use client";

import { useEffect, useId, useMemo, useRef, useState, type FormEvent } from "react";
import { useLocale, useTranslations } from "next-intl";
import Image from "next/image";
import {
  ArrowDown,
  ArrowUp,
  ImagePlus,
  Loader2,
  Pencil,
  Plus,
  Search,
  SlidersHorizontal,
  Star,
  Trash2,
  Video,
  X,
} from "lucide-react";
import { toast } from "sonner";
import {
  StatusBadge,
  adminInputClass,
  adminLabelClass,
} from "@/components/admin/admin-ui";
import { Button } from "@/components/ui/button";
import { DialogShell } from "@/components/ui/dialog-shell";
import { UploadField } from "@/components/ui/upload-field";
import { useRouter } from "@/i18n/navigation";
import { formatTaka } from "@/lib/money";
import { normalizeProductVideoInput, parseProductVideo, toProductVideoMedia } from "@/lib/product-video";
import type { StoreSpecification, StoreVariantGroups } from "@/lib/store-filters";
import { cn } from "@/lib/utils";

export type AdminProductCategory = {
  readonly id: string;
  readonly name: string;
  readonly nameBn: string | null;
  readonly parentId?: string | null;
};

export type AdminProductImage = {
  readonly url: string;
  readonly alt: string | null;
  readonly isPrimary: boolean;
};

export type AdminProductView = {
  readonly id: string;
  readonly name: string;
  readonly nameBn: string | null;
  readonly slug: string;
  readonly description: string | null;
  readonly descriptionBn: string | null;
  readonly categoryId: string | null;
  readonly sku: string | null;
  readonly brand: string | null;
  readonly subcategory: string | null;
  readonly variants: unknown;
  readonly specifications: unknown;
  readonly video: unknown;
  readonly pricePaisa: string;
  readonly compareAtPaisa: string | null;
  readonly stock: number;
  readonly isActive: boolean;
  readonly isFeatured: boolean;
  readonly images: readonly AdminProductImage[];
};

const variantKeys = ["size", "color", "model"] as const;
type VariantKey = (typeof variantKeys)[number];
type VariantDraft = Record<VariantKey, string>;
type SpecificationDraft = {
  label: string;
  labelBn: string;
  value: string;
  valueBn: string;
};
type ImageDraft = { key: string; url: string; alt: string; isPrimary: boolean };
type ProductStatusTab = "ALL" | "ACTIVE" | "INACTIVE";

type Draft = {
  name: string;
  nameBn: string;
  slug: string;
  description: string;
  descriptionBn: string;
  categoryId: string;
  sku: string;
  brand: string;
  subcategory: string;
  variants: VariantDraft;
  specifications: SpecificationDraft[];
  videoUrl: string;
  images: ImageDraft[];
  price: string;
  compareAt: string;
  stock: string;
  isActive: boolean;
  isFeatured: boolean;
};

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function readVariants(value: unknown): VariantDraft {
  const draft: VariantDraft = { size: "", color: "", model: "" };
  if (typeof value !== "object" || value === null || Array.isArray(value)) return draft;
  const source = value as Record<string, unknown>;
  for (const key of variantKeys) {
    const list = source[key];
    if (Array.isArray(list)) {
      draft[key] = list.filter((item): item is string => typeof item === "string").join(", ");
    }
  }
  return draft;
}

function readSpecifications(value: unknown): SpecificationDraft[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
    .map((item) => ({
      label: asString(item.label),
      labelBn: asString(item.labelBn),
      value: asString(item.value),
      valueBn: asString(item.valueBn),
    }));
}

function emptySpecification(): SpecificationDraft {
  return { label: "", labelBn: "", value: "", valueBn: "" };
}

function buildVariants(draft: VariantDraft): StoreVariantGroups {
  const result: StoreVariantGroups = {};
  for (const key of variantKeys) {
    const values = [
      ...new Set(draft[key].split(",").map((item) => item.trim()).filter(Boolean)),
    ].slice(0, 50);
    if (values.length > 0) result[key] = values;
  }
  return result;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 240) || "product";
}

function paisaToTaka(value: string | null): string {
  if (!value) return "";
  const amount = BigInt(value);
  return `${amount / 100n}.${String(amount % 100n).padStart(2, "0")}`;
}

function takaToPaisa(value: string): string {
  const trimmed = value.trim();
  if (!/^\d+(?:\.\d{1,2})?$/.test(trimmed)) throw new Error("invalid-amount");
  const [taka, fraction = ""] = trimmed.split(".");
  return (BigInt(taka) * 100n + BigInt(fraction.padEnd(2, "0"))).toString();
}

function videoInputValue(value: unknown): string {
  const video = parseProductVideo(value);
  if (!video) return "";
  if (video.kind === "upload" || video.kind === "direct") return video.url;
  if (video.kind === "youtube") return `https://www.youtube.com/watch?v=${video.videoId}`;
  return `https://vimeo.com/${video.videoId}`;
}

function toDraft(product: AdminProductView | null): Draft {
  return {
    name: product?.name ?? "",
    nameBn: product?.nameBn ?? "",
    slug: product?.slug ?? "",
    description: product?.description ?? "",
    descriptionBn: product?.descriptionBn ?? "",
    categoryId: product?.categoryId ?? "",
    sku: product?.sku ?? "",
    brand: product?.brand ?? "",
    subcategory: product?.subcategory ?? "",
    variants: readVariants(product?.variants),
    specifications: readSpecifications(product?.specifications),
    videoUrl: videoInputValue(product?.video),
    images: (product?.images ?? []).map((image, index) => ({
      key: `${image.url}-${index}`,
      url: image.url,
      alt: image.alt ?? "",
      isPrimary: image.isPrimary,
    })),
    price: paisaToTaka(product?.pricePaisa ?? null),
    compareAt: paisaToTaka(product?.compareAtPaisa ?? null),
    stock: product ? String(product.stock) : "0",
    isActive: product?.isActive ?? true,
    isFeatured: product?.isFeatured ?? false,
  };
}

export function ProductManager({
  products,
  categories,
}: {
  products: readonly AdminProductView[];
  categories: readonly AdminProductCategory[];
}) {
  const t = useTranslations("adminPanel");
  const tc = useTranslations("common");
  const locale = useLocale();
  const filterRef = useRef<HTMLDivElement>(null);

  const [editing, setEditing] = useState<AdminProductView | "new" | null>(null);
  const [statusTab, setStatusTab] = useState<ProductStatusTab>("ALL");
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [featuredFilter, setFeaturedFilter] = useState<"ALL" | "YES" | "NO">("ALL");
  const [inStockOnly, setInStockOnly] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const mainCategories = useMemo(
    () => categories.filter((category) => !category.parentId),
    [categories],
  );

  const filteredProducts = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return products.filter((product) => {
      if (statusTab === "ACTIVE" && !product.isActive) return false;
      if (statusTab === "INACTIVE" && product.isActive) return false;
      if (categoryFilter !== "ALL" && product.categoryId !== categoryFilter) return false;
      if (featuredFilter === "YES" && !product.isFeatured) return false;
      if (featuredFilter === "NO" && product.isFeatured) return false;
      if (inStockOnly && product.stock <= 0) return false;
      if (!needle) return true;
      const category = categories.find((item) => item.id === product.categoryId);
      const categoryName = locale === "bn" ? (category?.nameBn ?? category?.name) : category?.name;
      return [
        product.name,
        product.nameBn ?? "",
        product.slug,
        product.sku ?? "",
        product.brand ?? "",
        product.subcategory ?? "",
        categoryName ?? "",
      ].some((value) => value.toLowerCase().includes(needle));
    });
  }, [categories, categoryFilter, featuredFilter, inStockOnly, locale, products, query, statusTab]);

  const counts = useMemo(
    () => ({
      ALL: products.length,
      ACTIVE: products.filter((product) => product.isActive).length,
      INACTIVE: products.filter((product) => !product.isActive).length,
    }),
    [products],
  );

  const tabLabels: Record<ProductStatusTab, string> = {
    ALL: t("productAll"),
    ACTIVE: t("productActive"),
    INACTIVE: t("productInactive"),
  };

  const activeFilterCount =
    (categoryFilter === "ALL" ? 0 : 1) +
    (featuredFilter === "ALL" ? 0 : 1) +
    (inStockOnly ? 1 : 0);

  useEffect(() => {
    if (!filtersOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!filterRef.current?.contains(event.target as Node)) setFiltersOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setFiltersOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [filtersOpen]);

  function resetFilters() {
    setStatusTab("ALL");
    setQuery("");
    setCategoryFilter("ALL");
    setFeaturedFilter("ALL");
    setInStockOnly(false);
    setFiltersOpen(false);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div
          role="group"
          aria-label={t("productStatusTabs")}
          className="flex flex-wrap items-center gap-1 rounded-xl border border-border bg-[var(--glass)] p-1"
        >
          {(["ALL", "ACTIVE", "INACTIVE"] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              aria-pressed={statusTab === tab}
              onClick={() => setStatusTab(tab)}
              className={cn(
                "rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                statusTab === tab
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground",
              )}
            >
              {tabLabels[tab]}
              <span className="ml-1.5 tabular-nums opacity-70">{counts[tab]}</span>
            </button>
          ))}
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <label className="relative w-full sm:w-64">
            <span className="sr-only">{t("productSearchPlaceholder")}</span>
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t("productSearchPlaceholder")}
              className={cn(adminInputClass, "pl-10")}
            />
          </label>

          <div ref={filterRef} className="relative shrink-0">
            <Button
              type="button"
              variant="outline"
              aria-expanded={filtersOpen}
              aria-controls="admin-product-filters"
              onClick={() => setFiltersOpen((open) => !open)}
            >
              <SlidersHorizontal className="size-4" aria-hidden="true" />
              {tc("filter")}
              {activeFilterCount > 0 ? (
                <span className="grid size-5 place-items-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                  {activeFilterCount}
                </span>
              ) : null}
            </Button>

            {filtersOpen ? (
              <div
                id="admin-product-filters"
                role="group"
                aria-label={tc("filter")}
                className="absolute right-0 z-20 mt-2 w-[min(20rem,calc(100vw-2rem))] rounded-xl border border-border bg-[var(--glass-strong)] p-3 shadow-xl backdrop-blur-xl"
              >
                <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  {t("productCategoryFilter")}
                  <select
                    value={categoryFilter}
                    onChange={(event) => setCategoryFilter(event.target.value)}
                    className={cn(adminInputClass, "mt-1 h-9 text-xs normal-case tracking-normal")}
                  >
                    <option value="ALL">{t("allCategories")}</option>
                    {mainCategories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {locale === "bn" ? (category.nameBn ?? category.name) : category.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="mt-3 block text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  {t("productFeaturedFilter")}
                  <select
                    value={featuredFilter}
                    onChange={(event) => setFeaturedFilter(event.target.value as "ALL" | "YES" | "NO")}
                    className={cn(adminInputClass, "mt-1 h-9 text-xs normal-case tracking-normal")}
                  >
                    <option value="ALL">{t("productAll")}</option>
                    <option value="YES">{t("featuredOnly")}</option>
                    <option value="NO">{t("notFeaturedOnly")}</option>
                  </select>
                </label>

                <label className="mt-3 flex items-center gap-2 text-xs font-semibold">
                  <input
                    type="checkbox"
                    checked={inStockOnly}
                    onChange={(event) => setInStockOnly(event.target.checked)}
                    className="size-4 rounded border-border accent-[var(--primary)]"
                  />
                  {t("inStockOnly")}
                </label>

                <div className="mt-3 flex justify-end gap-2">
                  <Button type="button" variant="ghost" size="sm" onClick={resetFilters}>
                    {t("filterReset")}
                  </Button>
                  <Button type="button" size="sm" onClick={() => setFiltersOpen(false)}>
                    {t("filterApply")}
                  </Button>
                </div>
              </div>
            ) : null}
          </div>

          <Button type="button" onClick={() => setEditing("new")}>
            <Plus className="size-4" aria-hidden="true" />
            {t("addProduct")}
          </Button>
        </div>
      </div>

      {activeFilterCount > 0 || query || statusTab !== "ALL" ? (
        <p className="text-xs text-muted-foreground tabular-nums">
          {t("visibleCount", { count: filteredProducts.length, total: products.length })}
        </p>
      ) : null}

      {filteredProducts.length === 0 ? (
        <p className="glass rounded-2xl px-5 py-10 text-center text-sm text-muted-foreground">
          {tc("noResults")}
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredProducts.map((product) => {
            const primary = product.images.find((image) => image.isPrimary) ?? product.images[0];
            const hasVideo = Boolean(parseProductVideo(product.video));
            return (
              <article key={product.id} className="glass min-w-0 overflow-hidden rounded-2xl">
                <div className="relative aspect-[4/3] bg-muted/40">
                  {primary ? (
                    <Image
                      src={primary.url}
                      alt={product.name}
                      fill
                      unoptimized
                      sizes="(max-width: 640px) 100vw, 25vw"
                      className="object-contain p-3"
                    />
                  ) : (
                    <div className="grid size-full place-items-center text-muted-foreground">
                      <ImagePlus className="size-8" aria-hidden="true" />
                    </div>
                  )}
                  {hasVideo ? (
                    <span className="absolute bottom-2 left-2 inline-flex items-center gap-1 rounded-full bg-black/65 px-2 py-1 text-[10px] font-bold text-white">
                      <Video className="size-3" aria-hidden="true" />
                      {t("productHasVideo")}
                    </span>
                  ) : null}
                </div>
                <div className="space-y-3 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge
                      tone={product.isActive ? "success" : "danger"}
                      label={product.isActive ? t("productActive") : t("productInactive")}
                    />
                    <span className="text-sm font-bold tabular-nums">
                      {formatTaka(BigInt(product.pricePaisa), locale)}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <h3 className="break-words font-semibold leading-snug">{product.name}</h3>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    {t("productStock")}: <span className="font-semibold tabular-nums">{product.stock}</span>
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    onClick={() => setEditing(product)}
                  >
                    <Pencil className="size-3.5" aria-hidden="true" />
                    {t("editProduct")}
                  </Button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {editing ? (
        <ProductEditorDialog
          key={editing === "new" ? "new" : editing.id}
          product={editing === "new" ? null : editing}
          categories={categories}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </div>
  );
}

function ProductEditorDialog({
  product,
  categories,
  onClose,
}: {
  product: AdminProductView | null;
  categories: readonly AdminProductCategory[];
  onClose: () => void;
}) {
  const t = useTranslations("adminPanel");
  const tc = useTranslations("common");
  const locale = useLocale();
  const router = useRouter();
  const fieldId = useId();
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  const [draft, setDraft] = useState<Draft>(() => toDraft(product));
  const [slugTouched, setSlugTouched] = useState(Boolean(product));
  const [pending, setPending] = useState(false);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [videoFileName, setVideoFileName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const videoMedia = toProductVideoMedia(normalizeProductVideoInput(draft.videoUrl));
  const mainCategories = categories.filter((category) => !category.parentId);
  const subcategories = categories.filter((category) => category.parentId);

  function update<K extends keyof Draft>(key: K, value: Draft[K]): void {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function changeSubcategory(value: string): void {
    update("subcategory", value);
    const match = subcategories.find(
      (category) => category.name === value || category.nameBn === value,
    );
    if (match?.parentId) update("categoryId", match.parentId);
  }

  function updateVariant(key: VariantKey, value: string): void {
    setDraft((current) => ({
      ...current,
      variants: { ...current.variants, [key]: value },
    }));
  }

  function updateSpec(index: number, field: keyof SpecificationDraft, value: string): void {
    setDraft((current) => ({
      ...current,
      specifications: current.specifications.map((row, rowIndex) =>
        rowIndex === index ? { ...row, [field]: value } : row,
      ),
    }));
  }

  async function uploadImages(files: FileList | null): Promise<void> {
    if (!files?.length) return;
    setUploadingImages(true);
    setError(null);
    try {
      for (const file of Array.from(files)) {
        const formData = new FormData();
        formData.append("file", file);
        const response = await fetch("/api/uploads", { method: "POST", body: formData });
        if (!response.ok) throw new Error("upload failed");
        const data = (await response.json()) as { url: string };
        setDraft((current) => ({
          ...current,
          images: [
            ...current.images,
            {
              key: `${data.url}-${Date.now()}-${current.images.length}`,
              url: data.url,
              alt: "",
              isPrimary: current.images.length === 0,
            },
          ],
        }));
      }
      toast.success(t("productImagesUploaded"));
    } catch {
      const message = t("productImageUploadFailed");
      setError(message);
      toast.error(message);
    } finally {
      setUploadingImages(false);
      if (imageInputRef.current) imageInputRef.current.value = "";
    }
  }

  async function uploadVideo(files: FileList | null): Promise<void> {
    const file = files?.[0];
    if (!file) return;
    setUploadingVideo(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch("/api/uploads/video", { method: "POST", body: formData });
      if (!response.ok) throw new Error("upload failed");
      const data = (await response.json()) as { url: string };
      update("videoUrl", data.url);
      setVideoFileName(data.url.split("/").pop() ?? file.name);
      toast.success(t("productVideoUploaded"));
    } catch {
      const message = t("productVideoUploadFailed");
      setError(message);
      toast.error(message);
    } finally {
      setUploadingVideo(false);
      if (videoInputRef.current) videoInputRef.current.value = "";
    }
  }

  function moveImage(index: number, direction: -1 | 1): void {
    setDraft((current) => {
      const nextIndex = index + direction;
      if (nextIndex < 0 || nextIndex >= current.images.length) return current;
      const images = [...current.images];
      [images[index], images[nextIndex]] = [images[nextIndex], images[index]];
      return { ...current, images };
    });
  }

  function removeImage(index: number): void {
    setDraft((current) => {
      const images = current.images
        .filter((_, imageIndex) => imageIndex !== index)
        .map((image, imageIndex) => ({ ...image, isPrimary: imageIndex === 0 }));
      return { ...current, images };
    });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(null);

    if (!draft.name.trim() || !draft.slug.trim()) {
      setError(t("productBasicFieldsRequired"));
      return;
    }
    if (draft.images.length === 0) {
      setError(t("productImageRequired"));
      return;
    }
    if (draft.videoUrl.trim() && !normalizeProductVideoInput(draft.videoUrl)) {
      setError(t("productVideoInvalid"));
      return;
    }

    let pricePaisa: string;
    let compareAtPaisa: string | null;
    try {
      pricePaisa = takaToPaisa(draft.price);
      compareAtPaisa = draft.compareAt.trim() ? takaToPaisa(draft.compareAt) : null;
    } catch {
      setError(t("productPriceInvalid"));
      return;
    }

    const specificationRows = draft.specifications.filter((row) =>
      [row.label, row.labelBn, row.value, row.valueBn].some((value) => value.trim().length > 0),
    );
    if (specificationRows.some((row) => !row.label.trim() || !row.value.trim())) {
      setError(t("metadataFailed"));
      return;
    }

    const specifications: StoreSpecification[] = specificationRows.map((row) => ({
      label: row.label.trim(),
      labelBn: row.labelBn.trim() || null,
      value: row.value.trim(),
      valueBn: row.valueBn.trim() || null,
    }));

    const nullable = (value: string) => value.trim() || null;
    const payload = {
      name: draft.name.trim(),
      nameBn: nullable(draft.nameBn),
      slug: draft.slug.trim(),
      description: nullable(draft.description),
      descriptionBn: nullable(draft.descriptionBn),
      categoryId: draft.categoryId || null,
      sku: nullable(draft.sku),
      brand: nullable(draft.brand),
      subcategory: nullable(draft.subcategory),
      variants: buildVariants(draft.variants),
      specifications,
      video: nullable(draft.videoUrl),
      images: draft.images.map((image) => ({
        url: image.url,
        alt: nullable(image.alt),
        isPrimary: image.isPrimary,
      })),
      pricePaisa,
      compareAtPaisa,
      stock: Number(draft.stock),
      isActive: draft.isActive,
      isFeatured: draft.isFeatured,
    };

    setPending(true);
    try {
      const response = await fetch(
        product ? `/api/admin/products/${product.id}` : "/api/admin/products",
        {
          method: product ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify(payload),
        },
      );
      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? "save failed");
      }
      toast.success(product ? t("productUpdated") : t("productCreated"));
      router.refresh();
      onClose();
    } catch (saveError) {
      const message = saveError instanceof Error && saveError.message === "SLUG_TAKEN"
        ? t("productSlugTaken")
        : saveError instanceof Error && saveError.message === "SKU_TAKEN"
          ? t("productSkuTaken")
          : product
            ? t("productUpdateFailed")
            : t("productCreateFailed");
      setError(message);
      toast.error(message);
    } finally {
      setPending(false);
    }
  }

  return (
    <DialogShell
      title={product ? t("editProduct") : t("addProduct")}
      intro={t("productEditorIntro")}
      fullViewMobile
      panelClassName="sm:max-w-6xl"
      onClose={onClose}
      titleId={`${fieldId}-title`}
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        <fieldset className="grid gap-4 rounded-2xl border border-border p-4 sm:grid-cols-2 lg:grid-cols-3">
          <legend className="px-1 text-sm font-bold">{t("productBasics")}</legend>
          <div>
            <label htmlFor={`${fieldId}-name`} className={adminLabelClass}>
              {t("productName")}
            </label>
            <input
              id={`${fieldId}-name`}
              data-dialog-autofocus
              value={draft.name}
              onChange={(event) => {
                const value = event.target.value;
                update("name", value);
                if (!slugTouched && (!draft.slug || draft.slug === slugify(draft.name))) {
                  update("slug", slugify(value));
                }
              }}
              maxLength={200}
              className={`${adminInputClass} mt-1`}
            />
          </div>
          <div>
            <label htmlFor={`${fieldId}-name-bn`} className={adminLabelClass}>
              {t("productNameBn")}
            </label>
            <input
              id={`${fieldId}-name-bn`}
              value={draft.nameBn}
              onChange={(event) => update("nameBn", event.target.value)}
              maxLength={200}
              className={`${adminInputClass} mt-1`}
            />
          </div>
          <div>
            <label htmlFor={`${fieldId}-slug`} className={adminLabelClass}>
              {t("productSlug")}
            </label>
            <input
              id={`${fieldId}-slug`}
              value={draft.slug}
              onChange={(event) => {
                setSlugTouched(true);
                update("slug", event.target.value);
              }}
              maxLength={240}
              className={`${adminInputClass} mt-1 font-mono`}
            />
          </div>
          <div>
            <label htmlFor={`${fieldId}-sku`} className={adminLabelClass}>
              {t("productSku")}
            </label>
            <input
              id={`${fieldId}-sku`}
              value={draft.sku}
              onChange={(event) => update("sku", event.target.value)}
              maxLength={80}
              className={`${adminInputClass} mt-1`}
            />
          </div>
          <div>
            <label htmlFor={`${fieldId}-category`} className={adminLabelClass}>
              {t("productCategory")}
            </label>
            <select
              id={`${fieldId}-category`}
              value={draft.categoryId}
              onChange={(event) => update("categoryId", event.target.value)}
              className={`${adminInputClass} mt-1`}
            >
              <option value="">{t("productNoCategory")}</option>
              {mainCategories.map((category) => (
                <option key={category.id} value={category.id}>
                  {locale === "bn" && category.nameBn ? category.nameBn : category.name}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor={`${fieldId}-price`} className={adminLabelClass}>
                {t("productPrice")}
              </label>
              <input
                id={`${fieldId}-price`}
                inputMode="decimal"
                value={draft.price}
                onChange={(event) => update("price", event.target.value)}
                placeholder="0.00"
                className={`${adminInputClass} mt-1`}
              />
            </div>
            <div>
              <label htmlFor={`${fieldId}-compare`} className={adminLabelClass}>
                {t("productCompareAt")}
              </label>
              <input
                id={`${fieldId}-compare`}
                inputMode="decimal"
                value={draft.compareAt}
                onChange={(event) => update("compareAt", event.target.value)}
                placeholder="0.00"
                className={`${adminInputClass} mt-1`}
              />
            </div>
          </div>
          <div>
            <label htmlFor={`${fieldId}-stock`} className={adminLabelClass}>
              {t("productStock")}
            </label>
            <input
              id={`${fieldId}-stock`}
              type="number"
              min={0}
              max={1_000_000}
              value={draft.stock}
              onChange={(event) => update("stock", event.target.value)}
              className={`${adminInputClass} mt-1`}
            />
          </div>
          <div className="sm:col-span-2 lg:col-span-3 grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor={`${fieldId}-description`} className={adminLabelClass}>
                {t("productDescription")}
              </label>
              <textarea
                id={`${fieldId}-description`}
                value={draft.description}
                onChange={(event) => update("description", event.target.value)}
                maxLength={4000}
                rows={3}
                className={`${adminInputClass} mt-1 h-auto py-2`}
              />
            </div>
            <div>
              <label htmlFor={`${fieldId}-description-bn`} className={adminLabelClass}>
                {t("productDescriptionBn")}
              </label>
              <textarea
                id={`${fieldId}-description-bn`}
                value={draft.descriptionBn}
                onChange={(event) => update("descriptionBn", event.target.value)}
                maxLength={4000}
                rows={3}
                className={`${adminInputClass} mt-1 h-auto py-2`}
              />
            </div>
          </div>
        </fieldset>

        <fieldset className="grid gap-3 rounded-2xl border border-border p-4 sm:grid-cols-2">
          <legend className="px-1 text-sm font-bold">{t("productFlags")}</legend>
          {(
            [
              ["isActive", t("productActive")],
              ["isFeatured", t("productFeatured")],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="flex items-center gap-2 text-sm font-semibold">
              <input
                type="checkbox"
                checked={draft[key]}
                onChange={(event) => update(key, event.target.checked)}
                className="size-4 accent-[var(--primary)]"
              />
              {label}
            </label>
          ))}
        </fieldset>

        <fieldset className="space-y-3 rounded-2xl border border-border p-4">
          <legend className="px-1 text-sm font-bold">{t("productImages")}</legend>
          <UploadField
            id={`${fieldId}-images`}
            inputRef={imageInputRef}
            kind="images"
            accept="image/jpeg,image/png,image/webp"
            uploading={uploadingImages}
            disabled={uploadingImages || pending}
            onSelect={(files) => void uploadImages(files)}
          />
          {draft.images.length === 0 ? (
            <p className="text-xs text-muted-foreground">{t("productImageRequired")}</p>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {draft.images.map((image, index) => (
                <div
                  key={image.key}
                  className={cn(
                    "relative aspect-square overflow-hidden rounded-xl border-2 bg-muted",
                    image.isPrimary ? "border-primary" : "border-transparent",
                  )}
                >
                  <Image
                    src={image.url}
                    alt={image.alt || t("productImage")}
                    fill
                    unoptimized
                    sizes="160px"
                    className="object-contain p-1"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setDraft((current) => ({
                        ...current,
                        images: current.images.map((item, itemIndex) => ({
                          ...item,
                          isPrimary: itemIndex === index,
                        })),
                      }))
                    }
                    aria-label={t("productMakePrimary")}
                    className="absolute left-1.5 top-1.5 rounded-full bg-black/60 p-1 text-white"
                  >
                    <Star
                      className={cn("size-3.5", image.isPrimary && "fill-current text-amber-300")}
                      aria-hidden="true"
                    />
                  </button>
                  <div className="absolute bottom-1.5 right-1.5 flex gap-1">
                    <button
                      type="button"
                      onClick={() => moveImage(index, -1)}
                      disabled={index === 0}
                      aria-label={t("productMoveUp")}
                      className="rounded-md bg-black/60 p-1 text-white disabled:opacity-40"
                    >
                      <ArrowUp className="size-3.5" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      onClick={() => moveImage(index, 1)}
                      disabled={index === draft.images.length - 1}
                      aria-label={t("productMoveDown")}
                      className="rounded-md bg-black/60 p-1 text-white disabled:opacity-40"
                    >
                      <ArrowDown className="size-3.5" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      onClick={() => removeImage(index)}
                      aria-label={t("productRemoveImage")}
                      className="rounded-md bg-black/60 p-1 text-red-300"
                    >
                      <X className="size-3.5" aria-hidden="true" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </fieldset>

        <fieldset className="space-y-3 rounded-2xl border border-border p-4">
          <legend className="px-1 text-sm font-bold">{t("productVideo")}</legend>
          <div className="grid gap-3 lg:grid-cols-2">
            <div>
              <label htmlFor={`${fieldId}-video-url`} className={adminLabelClass}>
                {t("productVideoUrl")}
              </label>
              <input
                id={`${fieldId}-video-url`}
                value={draft.videoUrl}
                onChange={(event) => {
                  update("videoUrl", event.target.value);
                  setVideoFileName(null);
                }}
                placeholder="https://…/video.mp4"
                className={`${adminInputClass} mt-1`}
              />
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                {t("productVideoHint")}
              </p>
              <UploadField
                id={`${fieldId}-video-file`}
                inputRef={videoInputRef}
                kind="video"
                accept="video/mp4,video/webm"
                hint={t("productVideoUploadHint")}
                uploading={uploadingVideo}
                disabled={uploadingVideo || pending}
                selectedName={videoFileName}
                onSelect={(files) => void uploadVideo(files)}
                onRemove={
                  videoFileName
                    ? () => {
                        update("videoUrl", "");
                        setVideoFileName(null);
                      }
                    : undefined
                }
                className="mt-3"
              />
            </div>
            <div className="flex aspect-video items-center justify-center overflow-hidden rounded-2xl border border-border bg-black/5">
              {videoMedia ? (
                videoMedia.kind === "video" ? (
                  <video src={videoMedia.src} controls playsInline className="size-full object-contain" />
                ) : (
                  <iframe
                    src={videoMedia.src}
                    title={t("productVideo")}
                    allow="autoplay; encrypted-media; picture-in-picture"
                    className="size-full border-0"
                  />
                )
              ) : (
                <div className="flex flex-col items-center gap-2 text-muted-foreground">
                  <Video className="size-7" aria-hidden="true" />
                  <span className="text-xs">{t("productVideoNone")}</span>
                </div>
              )}
            </div>
          </div>
        </fieldset>

        <fieldset className="space-y-3 rounded-2xl border border-border p-4">
          <legend className="px-1 text-sm font-bold">{t("productBrand")} / {t("subcategory")}</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor={`${fieldId}-brand`} className={adminLabelClass}>
                {t("brand")}
              </label>
              <input
                id={`${fieldId}-brand`}
                value={draft.brand}
                onChange={(event) => update("brand", event.target.value)}
                maxLength={120}
                className={`${adminInputClass} mt-1`}
              />
            </div>
            <div>
              <label htmlFor={`${fieldId}-subcategory`} className={adminLabelClass}>
                {t("subcategory")}
              </label>
              <input
                id={`${fieldId}-subcategory`}
                list={`${fieldId}-subcategory-options`}
                value={draft.subcategory}
                onChange={(event) => changeSubcategory(event.target.value)}
                placeholder={t("productSubcategoryPlaceholder")}
                maxLength={120}
                className={`${adminInputClass} mt-1`}
              />
              <datalist id={`${fieldId}-subcategory-options`}>
                {subcategories.map((category) => (
                  <option key={category.id} value={category.name} />
                ))}
              </datalist>
            </div>
          </div>
        </fieldset>

        <fieldset className="space-y-3 rounded-2xl border border-border p-4">
          <legend className="px-1 text-sm font-bold">{t("variants")}</legend>
          <p className="text-xs text-muted-foreground">{t("variantsHint")}</p>
          <div className="grid gap-3 sm:grid-cols-3">
            {variantKeys.map((key) => (
              <div key={key}>
                <label htmlFor={`${fieldId}-${key}`} className={adminLabelClass}>
                  {t(key)}
                </label>
                <input
                  id={`${fieldId}-${key}`}
                  value={draft.variants[key]}
                  onChange={(event) => updateVariant(key, event.target.value)}
                  maxLength={500}
                  className={`${adminInputClass} mt-1`}
                />
              </div>
            ))}
          </div>
        </fieldset>

        <fieldset className="space-y-3 rounded-2xl border border-border p-4">
          <legend className="px-1 text-sm font-bold">{t("specifications")}</legend>
          <p className="text-xs text-muted-foreground">{t("specificationsHint")}</p>
          {draft.specifications.map((row, index) => (
            <div key={index} className="grid gap-3 rounded-xl bg-[var(--glass)] p-3 sm:grid-cols-2">
              <div>
                <label htmlFor={`${fieldId}-spec-${index}-label`} className={adminLabelClass}>
                  {t("specLabel")}
                </label>
                <input
                  id={`${fieldId}-spec-${index}-label`}
                  value={row.label}
                  onChange={(event) => updateSpec(index, "label", event.target.value)}
                  maxLength={120}
                  className={`${adminInputClass} mt-1`}
                />
              </div>
              <div>
                <label htmlFor={`${fieldId}-spec-${index}-value`} className={adminLabelClass}>
                  {t("specValue")}
                </label>
                <input
                  id={`${fieldId}-spec-${index}-value`}
                  value={row.value}
                  onChange={(event) => updateSpec(index, "value", event.target.value)}
                  maxLength={300}
                  className={`${adminInputClass} mt-1`}
                />
              </div>
              <div>
                <label htmlFor={`${fieldId}-spec-${index}-label-bn`} className={adminLabelClass}>
                  {t("specLabelBn")}
                </label>
                <input
                  id={`${fieldId}-spec-${index}-label-bn`}
                  value={row.labelBn}
                  onChange={(event) => updateSpec(index, "labelBn", event.target.value)}
                  maxLength={120}
                  className={`${adminInputClass} mt-1`}
                />
              </div>
              <div>
                <label htmlFor={`${fieldId}-spec-${index}-value-bn`} className={adminLabelClass}>
                  {t("specValueBn")}
                </label>
                <input
                  id={`${fieldId}-spec-${index}-value-bn`}
                  value={row.valueBn}
                  onChange={(event) => updateSpec(index, "valueBn", event.target.value)}
                  maxLength={300}
                  className={`${adminInputClass} mt-1`}
                />
              </div>
              <button
                type="button"
                onClick={() =>
                  setDraft((current) => ({
                    ...current,
                    specifications: current.specifications.filter((_, rowIndex) => rowIndex !== index),
                  }))
                }
                aria-label={t("removeSpecification")}
                className="inline-flex w-fit items-center gap-1.5 text-xs font-semibold text-destructive sm:col-span-2"
              >
                <Trash2 className="size-3.5" aria-hidden="true" />
                {t("removeSpecification")}
              </button>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              setDraft((current) => ({
                ...current,
                specifications: [...current.specifications, emptySpecification()],
              }))
            }
          >
            <Plus className="size-3.5" aria-hidden="true" />
            {t("addSpecification")}
          </Button>
        </fieldset>

        {error ? (
          <p role="alert" className="text-sm font-semibold text-destructive">
            {error}
          </p>
        ) : null}

        <div className="sticky bottom-0 z-10 -mx-5 mt-2 flex flex-wrap justify-end gap-2 border-t border-border bg-[var(--card-solid)] px-5 py-4 sm:-mx-6 sm:px-6">
          <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
            {tc("cancel")}
          </Button>
          <Button type="submit" disabled={pending || uploadingImages || uploadingVideo}>
            {pending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
            {product ? t("saveProduct") : t("createProduct")}
          </Button>
        </div>
      </form>
    </DialogShell>
  );
}
