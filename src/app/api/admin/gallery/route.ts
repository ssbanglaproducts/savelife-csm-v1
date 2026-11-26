import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { writeAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import {
  createGalleryPostSchema,
  normalizeLocation,
  nullableJson,
  parseEventDate,
  normalizedImageCaption,
} from "@/lib/gallery-input";
import { getAdminGalleryPosts } from "@/lib/gallery";

export const dynamic = "force-dynamic";

function error(code: string, status: number) {
  return NextResponse.json({ error: code }, { status });
}

export async function GET(request: Request) {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") return error("FORBIDDEN", 403);

  const locale = new URL(request.url).searchParams.get("locale") === "bn" ? "bn" : "en";
  return NextResponse.json({ posts: await getAdminGalleryPosts(locale) });
}

export async function POST(request: Request) {
  const session = await auth();
  if (session?.user?.role !== "ADMIN" || !session.user.id) {
    return error("FORBIDDEN", 403);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return error("INVALID_REQUEST", 400);
  }

  const parsed = createGalleryPostSchema.safeParse(body);
  if (!parsed.success) return error("INVALID_GALLERY_POST", 400);

  const data = parsed.data;
  const post = await prisma.galleryPost.create({
    data: {
      kind: data.kind,
      title: data.title as Prisma.InputJsonValue,
      caption: data.caption as Prisma.InputJsonValue,
      eventDate: parseEventDate(data.eventDate),
      location: normalizeLocation(data.location),
      published: data.published,
      sortOrder: data.sortOrder,
      images: {
        create: data.images.map((image, index) => ({
          url: image.url,
          caption: nullableJson(normalizedImageCaption(image.caption)),
          sortOrder: image.sortOrder ?? index,
        })),
      },
    },
    select: { id: true },
  });

  await writeAuditLog({
    actorId: session.user.id,
    actorRole: "ADMIN",
    action: "GALLERY_POST_CREATED",
    entityType: "GalleryPost",
    entityId: post.id,
    after: {
      kind: data.kind,
      title: data.title.en,
      published: data.published,
      sortOrder: data.sortOrder,
      images: data.images.length,
    },
  });

  return NextResponse.json({ ok: true, id: post.id }, { status: 201 });
}
