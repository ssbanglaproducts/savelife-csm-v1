import { z } from "zod";
import { GalleryPostKind } from "@/generated/prisma/enums";
import { Prisma } from "@/generated/prisma/client";
import { uploadedImageUrlPattern } from "@/lib/uploads";

const title = z.object({
  en: z.string().trim().min(1).max(180),
  bn: z.string().trim().min(1).max(180),
});

const caption = z.object({
  en: z.string().trim().max(500),
  bn: z.string().trim().max(500),
});

const dateString = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const parsed = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
  }, "INVALID_DATE");

const image = z.object({
  id: z.string().trim().min(1).optional(),
  url: z.string().regex(uploadedImageUrlPattern, "INVALID_IMAGE_URL"),
  caption: caption.nullable().optional(),
  sortOrder: z.number().int().min(0).max(1000).optional(),
});

export const createGalleryPostSchema = z.object({
  kind: z.enum([GalleryPostKind.EVENT, GalleryPostKind.PROGRAM]),
  title,
  caption,
  eventDate: dateString.nullable().optional(),
  location: z.string().trim().max(160).nullable().optional(),
  published: z.boolean().default(true),
  sortOrder: z.number().int().min(0).max(9999).default(0),
  images: z.array(image).min(1).max(12),
});

export const updateGalleryPostSchema = createGalleryPostSchema.partial().refine(
  (data) => Object.keys(data).length > 0,
  "EMPTY_UPDATE",
);

export function parseEventDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  return new Date(`${value}T00:00:00.000Z`);
}

export function normalizedImageCaption(value: { en: string; bn: string } | null | undefined) {
  if (!value) return null;
  if (!value.en.trim() && !value.bn.trim()) return null;
  return { en: value.en.trim(), bn: value.bn.trim() };
}

/** Empty optional text is stored as SQL NULL, not an empty string. */
export function normalizeLocation(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

/** Prisma requires an explicit sentinel when writing JSON NULL. */
export function nullableJson(value: object | null): Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput {
  if (!value) return Prisma.JsonNull;
  return value as Prisma.InputJsonValue;
}
