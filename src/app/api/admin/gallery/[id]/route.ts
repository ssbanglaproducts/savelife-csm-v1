import { NextResponse } from "next/server";
import { requireAdminApiSession } from "@/lib/admin-access";
import { writeAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import {
  normalizedImageCaption,
  normalizeLocation,
  nullableJson,
  parseEventDate,
  updateGalleryPostSchema,
} from "@/lib/gallery-input";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };
type AuditValues = Record<string, string | number | boolean | null>;

function error(code: string, status: number) {
  return NextResponse.json({ error: code }, { status });
}

type ExistingPost = {
  kind: string;
  title: unknown;
  caption: unknown;
  eventDate: Date | null;
  location: string | null;
  published: boolean;
  sortOrder: number;
  images: unknown[];
};

function localizedEn(value: unknown): string {
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    if (typeof record.en === "string") return record.en;
  }
  return "";
}

function auditValues(post: ExistingPost): AuditValues {
  return {
    kind: post.kind,
    titleEn: localizedEn(post.title),
    captionEn: localizedEn(post.caption),
    eventDate: post.eventDate ? post.eventDate.toISOString().slice(0, 10) : null,
    location: post.location,
    published: post.published,
    sortOrder: post.sortOrder,
    images: post.images.length,
  };
}

export async function PATCH(request: Request, context: RouteContext) {
  const session = await requireAdminApiSession("content.manage");
  if (!session) {
    return error("FORBIDDEN", 403);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return error("INVALID_REQUEST", 400);
  }

  const parsed = updateGalleryPostSchema.safeParse(body);
  if (!parsed.success) return error("INVALID_GALLERY_POST", 400);

  const { id } = await context.params;
  const existing = await prisma.galleryPost.findUnique({
    where: { id },
    include: { images: true },
  });
  if (!existing) return error("NOT_FOUND", 404);

  const input = parsed.data;
  const data: Prisma.GalleryPostUpdateInput = {};

  if (input.kind !== undefined) data.kind = input.kind;
  if (input.title !== undefined) data.title = input.title as Prisma.InputJsonValue;
  if (input.caption !== undefined) data.caption = input.caption as Prisma.InputJsonValue;
  if (input.eventDate !== undefined) data.eventDate = parseEventDate(input.eventDate);
  if (input.location !== undefined) data.location = normalizeLocation(input.location);
  if (input.published !== undefined) data.published = input.published;
  if (input.sortOrder !== undefined) data.sortOrder = input.sortOrder;

  if (input.images !== undefined) {
    data.images = {
      deleteMany: {},
      create: input.images.map((image, index) => ({
        url: image.url,
        caption: nullableJson(normalizedImageCaption(image.caption)),
        sortOrder: image.sortOrder ?? index,
      })),
    };
  }

  await prisma.galleryPost.update({ where: { id }, data });

  const after: AuditValues = {
    ...auditValues(existing as ExistingPost),
    ...(input.kind !== undefined ? { kind: input.kind } : {}),
    ...(input.title !== undefined ? { titleEn: input.title.en } : {}),
    ...(input.caption !== undefined ? { captionEn: input.caption.en } : {}),
    ...(input.eventDate !== undefined
      ? { eventDate: input.eventDate ? input.eventDate.slice(0, 10) : null }
      : {}),
    ...(input.location !== undefined ? { location: normalizeLocation(input.location) } : {}),
    ...(input.published !== undefined ? { published: input.published } : {}),
    ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
    ...(input.images !== undefined ? { images: input.images.length } : {}),
  };

  await writeAuditLog({
    actorId: session.user.id,
    actorRole: session.user.role,
    action: "GALLERY_POST_UPDATED",
    entityType: "GalleryPost",
    entityId: id,
    before: auditValues(existing as ExistingPost),
    after,
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const session = await requireAdminApiSession("content.manage");
  if (!session) {
    return error("FORBIDDEN", 403);
  }

  const { id } = await context.params;
  const existing = await prisma.galleryPost.findUnique({
    where: { id },
    include: { images: true },
  });
  if (!existing) return error("NOT_FOUND", 404);

  await prisma.galleryPost.delete({ where: { id } });

  await writeAuditLog({
    actorId: session.user.id,
    actorRole: session.user.role,
    action: "GALLERY_POST_DELETED",
    entityType: "GalleryPost",
    entityId: id,
    before: auditValues(existing as ExistingPost),
  });

  return NextResponse.json({ ok: true });
}
