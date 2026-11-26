import { Prisma } from "@/generated/prisma/client";
import { z } from "zod";
import { normalizeProductVideoInput } from "@/lib/product-video";
import type { StoreSpecification, StoreVariantGroups } from "@/lib/store-filters";

const variantKeys = ["size", "color", "model"] as const;

export const variantsSchema = z.strictObject({
  size: z.array(z.string().trim().min(1).max(60)).max(50).optional(),
  color: z.array(z.string().trim().min(1).max(60)).max(50).optional(),
  model: z.array(z.string().trim().min(1).max(60)).max(50).optional(),
});

export const specificationSchema = z.strictObject({
  label: z.string().trim().min(1).max(120),
  labelBn: z.string().trim().max(120).nullable().optional(),
  value: z.string().trim().min(1).max(300),
  valueBn: z.string().trim().max(300).nullable().optional(),
});

export const productImageSchema = z.strictObject({
  url: z.string().trim().min(1).max(2000),
  alt: z.string().trim().max(200).nullable().optional(),
  isPrimary: z.boolean().optional(),
});

const optionalText = (max: number) => z.string().trim().max(max).nullable().optional();
const paisa = z.string().regex(/^\d{1,15}$/);

export const productWriteSchema = z.strictObject({
  name: z.string().trim().min(1).max(200),
  nameBn: optionalText(200),
  slug: z
    .string()
    .trim()
    .min(1)
    .max(240)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Invalid slug"),
  description: optionalText(4000),
  descriptionBn: optionalText(4000),
  categoryId: z.string().nullable().optional(),
  sku: optionalText(80),
  brand: optionalText(120),
  subcategory: optionalText(120),
  variants: variantsSchema.nullable().optional(),
  specifications: z.array(specificationSchema).max(50).nullable().optional(),
  video: z.string().trim().max(2000).nullable().optional(),
  images: z.array(productImageSchema).max(30),
  pricePaisa: paisa,
  compareAtPaisa: paisa.nullable().optional(),
  stock: z.number().int().min(0).max(1_000_000),
  isActive: z.boolean().optional(),
  isFeatured: z.boolean().optional(),
});

export type ProductWriteInput = z.infer<typeof productWriteSchema>;
export type NormalizedProductImage = {
  readonly url: string;
  readonly alt: string | null;
  readonly sortOrder: number;
  readonly isPrimary: boolean;
};

export function normalizeVariants(
  value: z.infer<typeof variantsSchema> | null | undefined,
): StoreVariantGroups | null {
  if (!value) return null;
  const result: StoreVariantGroups = {};
  for (const key of variantKeys) {
    const values = value[key];
    if (!values?.length) continue;
    result[key] = [...new Set(values)].sort((a, b) => a.localeCompare(b));
  }
  return Object.keys(result).length > 0 ? result : null;
}

export function normalizeSpecifications(
  value: z.infer<typeof specificationSchema>[] | null | undefined,
): StoreSpecification[] | null {
  if (!value) return null;
  return value.map((item) => ({
    label: item.label,
    labelBn: item.labelBn?.trim() || null,
    value: item.value,
    valueBn: item.valueBn?.trim() || null,
  }));
}

/** Only local media paths and safe http(s) URLs are accepted for product images. */
export function normalizeProductImageUrl(raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;
  if (value.startsWith("/")) {
    return /^\/(api\/uploads|images)\/[A-Za-z0-9._/-]+$/.test(value) ? value : null;
  }
  try {
    const url = new URL(value);
    if (url.protocol === "https:") return url.toString();
    if (url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname)) {
      return url.toString();
    }
  } catch {
    return null;
  }
  return null;
}

export function normalizeProductImages(
  value: readonly { readonly url: string; readonly alt?: string | null; readonly isPrimary?: boolean }[],
): NormalizedProductImage[] | null {
  const seen = new Set<string>();
  const cleaned: Omit<NormalizedProductImage, "sortOrder">[] = [];

  for (const item of value) {
    const url = normalizeProductImageUrl(item.url);
    if (!url || seen.has(url)) continue;
    seen.add(url);
    cleaned.push({ url, alt: item.alt?.trim() || null, isPrimary: Boolean(item.isPrimary) });
  }

  if (cleaned.length === 0) return null;

  let primaryAssigned = false;
  return cleaned.map((item, index) => {
    const isPrimary = item.isPrimary && !primaryAssigned;
    if (isPrimary) primaryAssigned = true;
    return { ...item, sortOrder: index, isPrimary };
  }).map((item, index) =>
    index === 0 && !primaryAssigned ? { ...item, isPrimary: true } : item,
  );
}

export function canonicalJson(value: unknown): string {
  if (
    value === null ||
    value === undefined ||
    value === Prisma.JsonNull ||
    value === Prisma.DbNull
  ) {
    return "null";
  }
  return JSON.stringify(value);
}

export function jsonInput(value: unknown): Prisma.InputJsonValue | typeof Prisma.JsonNull {
  return value === null || value === undefined
    ? Prisma.JsonNull
    : (value as Prisma.InputJsonValue);
}

export function normalizeProductVideo(raw: string | null | undefined) {
  const normalized = normalizeProductVideoInput(raw);
  return { normalized, canonical: canonicalJson(normalized), json: jsonInput(normalized) };
}
