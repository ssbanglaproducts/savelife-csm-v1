import { z } from "zod";

const optionalText = (max: number) => z.string().trim().max(max).nullable().optional();

export const categoryWriteSchema = z.strictObject({
  name: z.string().trim().min(1).max(200),
  nameBn: optionalText(200),
  slug: z
    .string()
    .trim()
    .min(1)
    .max(240)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Invalid slug"),
  description: optionalText(4000),
  image: z.string().trim().max(2000).nullable().optional(),
  sortOrder: z.number().int().min(0).max(100_000).optional(),
  isActive: z.boolean().optional(),
});

export type CategoryWriteInput = z.infer<typeof categoryWriteSchema>;

/** Build the same URL-friendly slug convention used by the product manager. */
export function slugifyCategoryName(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 240)
    .replace(/-+$/g, "");
}

/** Category art follows the same local-path and safe http(s) rules as products. */
export function normalizeCategoryImageUrl(raw: string | null | undefined): string | null {
  const value = raw?.trim();
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

export function categoryAuditValues(input: CategoryWriteInput) {
  return {
    name: input.name,
    nameBn: input.nameBn ?? null,
    slug: input.slug,
    description: input.description ?? null,
    image: input.image ?? null,
    sortOrder: input.sortOrder ?? 0,
    isActive: input.isActive ?? true,
  };
}
