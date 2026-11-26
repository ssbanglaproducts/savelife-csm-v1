import type { GalleryPostKind } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { localizedText } from "@/lib/services/notifications";

export type LocalizedText = { en: string; bn: string };

export type GalleryImageDTO = {
  id: string;
  url: string;
  caption: string;
  captionEn: string;
  captionBn: string;
  sortOrder: number;
};

export type GalleryPostDTO = {
  id: string;
  kind: GalleryPostKind;
  title: string;
  titleEn: string;
  titleBn: string;
  caption: string;
  captionEn: string;
  captionBn: string;
  dateLabel: string;
  eventDate: string | null;
  location: string | null;
  published: boolean;
  sortOrder: number;
  images: GalleryImageDTO[];
};

type GalleryRow = {
  id: string;
  kind: GalleryPostKind;
  title: unknown;
  caption: unknown;
  eventDate: Date | null;
  location: string | null;
  published: boolean;
  sortOrder: number;
  createdAt: Date;
  images: Array<{
    id: string;
    url: string;
    caption: unknown;
    sortOrder: number;
  }>;
};

function localizedPair(value: unknown): LocalizedText {
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return {
      en: typeof record.en === "string" ? record.en : "",
      bn: typeof record.bn === "string" ? record.bn : "",
    };
  }
  return { en: "", bn: "" };
}

function formatDate(date: Date, locale: string): string {
  return new Intl.DateTimeFormat(locale === "bn" ? "bn-BD" : "en-GB", {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(date);
}

function mapPost(row: GalleryRow, locale: string): GalleryPostDTO {
  const title = localizedPair(row.title);
  const caption = localizedPair(row.caption);
  const date = row.eventDate ?? row.createdAt;

  return {
    id: row.id,
    kind: row.kind,
    title: localizedText(row.title, locale) || title.en,
    titleEn: title.en,
    titleBn: title.bn,
    caption: localizedText(row.caption, locale) || caption.en,
    captionEn: caption.en,
    captionBn: caption.bn,
    dateLabel: formatDate(date, locale),
    eventDate: row.eventDate ? row.eventDate.toISOString().slice(0, 10) : null,
    location: row.location,
    published: row.published,
    sortOrder: row.sortOrder,
    images: row.images.map((image) => {
      const imageCaption = localizedPair(image.caption);
      return {
        id: image.id,
        url: image.url,
        caption: localizedText(image.caption, locale) || imageCaption.en,
        captionEn: imageCaption.en,
        captionBn: imageCaption.bn,
        sortOrder: image.sortOrder,
      };
    }),
  };
}

async function loadPosts(
  locale: string,
  publishedOnly: boolean,
): Promise<GalleryPostDTO[]> {
  const rows = (await prisma.galleryPost.findMany({
    where: publishedOnly ? { published: true } : undefined,
    orderBy: [
      { sortOrder: "asc" },
      { createdAt: "desc" },
    ],
    include: {
      images: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] },
    },
  })) as unknown as GalleryRow[];

  return rows.map((row) => mapPost(row, locale));
}

/** Public reads must never break the storefront if the gallery table is empty. */
export async function getPublicGalleryPosts(locale: string): Promise<GalleryPostDTO[]> {
  try {
    return await loadPosts(locale, true);
  } catch (error) {
    console.error("Unable to load public gallery", error);
    return [];
  }
}

export async function getAdminGalleryPosts(locale: string): Promise<GalleryPostDTO[]> {
  return loadPosts(locale, false);
}
