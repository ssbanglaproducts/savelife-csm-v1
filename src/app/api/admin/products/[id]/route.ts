import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { writeAuditLog } from "@/lib/audit";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import {
  canonicalJson,
  jsonInput,
  normalizeProductImages,
  normalizeProductVideo,
  normalizeSpecifications,
  normalizeVariants,
  productWriteSchema,
} from "@/lib/product-admin";
import { parseProductVideo } from "@/lib/product-video";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };
type AuditValues = Record<string, string | number | boolean | null>;

function text(value: string | null | undefined): string | null {
  return value?.trim() || null;
}

function setIfChanged(
  field: keyof Prisma.ProductUpdateInput,
  next: string | number | boolean | bigint | null,
  current: unknown,
  data: Prisma.ProductUpdateInput,
  before: AuditValues,
  after: AuditValues,
): void {
  const same =
    typeof next === "bigint"
      ? current !== null && current !== undefined && BigInt(current as bigint) === next
      : current === next;
  if (same) return;
  (data as Record<string, unknown>)[field as string] = next;
  before[field as string] = current === null || current === undefined ? null : String(current);
  after[field as string] = next === null ? null : String(next);
}

export async function PATCH(request: Request, context: RouteContext) {
  const admin = await auth();
  if (admin?.user?.role !== "ADMIN" || !admin.user.id) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const { id } = await context.params;

  const existing = await prisma.product.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      nameBn: true,
      slug: true,
      description: true,
      descriptionBn: true,
      categoryId: true,
      sku: true,
      brand: true,
      subcategory: true,
      variants: true,
      specifications: true,
      video: true,
      pricePaisa: true,
      compareAtPaisa: true,
      stock: true,
      isActive: true,
      isFeatured: true,
      images: {
        orderBy: { sortOrder: "asc" },
        select: { url: true, alt: true, sortOrder: true, isPrimary: true },
      },
    },
  });
  if (!existing) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  const parsed = productWriteSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  const input = parsed.data;
  const images = normalizeProductImages(input.images);
  if (!images) {
    return NextResponse.json({ error: "At least one valid image is required" }, { status: 400 });
  }

  const categoryId = text(input.categoryId);
  const sku = text(input.sku);
  const slug = text(input.slug)!;
  const variants = normalizeVariants(input.variants);
  const specifications = normalizeSpecifications(input.specifications);
  const video = normalizeProductVideo(input.video);

  const [slugConflict, skuConflict, category] = await Promise.all([
    slug !== existing.slug
      ? prisma.product.findUnique({ where: { slug }, select: { id: true } })
      : Promise.resolve(null),
    sku && sku !== existing.sku
      ? prisma.product.findUnique({ where: { sku }, select: { id: true } })
      : Promise.resolve(null),
    categoryId && categoryId !== existing.categoryId
      ? prisma.category.findUnique({ where: { id: categoryId }, select: { id: true } })
      : Promise.resolve(null),
  ]);
  if (slugConflict) return NextResponse.json({ error: "SLUG_TAKEN" }, { status: 409 });
  if (skuConflict) return NextResponse.json({ error: "SKU_TAKEN" }, { status: 409 });
  if (categoryId && categoryId !== existing.categoryId && !category) {
    return NextResponse.json({ error: "CATEGORY_NOT_FOUND" }, { status: 400 });
  }

  const data: Prisma.ProductUpdateInput = {};
  const before: AuditValues = { name: existing.name };
  const after: AuditValues = {};

  const textFields = {
    name: input.name,
    nameBn: text(input.nameBn),
    slug,
    description: text(input.description),
    descriptionBn: text(input.descriptionBn),
    sku,
    brand: text(input.brand),
    subcategory: text(input.subcategory),
  } as const;
  for (const [field, next] of Object.entries(textFields)) {
    const key = field as keyof typeof textFields;
    const current = existing[key];
    if (current !== next) {
      (data as Record<string, unknown>)[field] = next;
      before[field] = current ?? null;
      after[field] = next;
    }
  }

  if (categoryId !== existing.categoryId) {
    data.category = categoryId ? { connect: { id: categoryId } } : { disconnect: true };
    before.categoryId = existing.categoryId;
    after.categoryId = categoryId;
  }

  const pricePaisa = BigInt(input.pricePaisa);
  const compareAtPaisa = input.compareAtPaisa ? BigInt(input.compareAtPaisa) : null;
  setIfChanged("pricePaisa", pricePaisa, existing.pricePaisa, data, before, after);
  setIfChanged("compareAtPaisa", compareAtPaisa, existing.compareAtPaisa, data, before, after);
  setIfChanged("stock", input.stock, existing.stock, data, before, after);

  for (const field of ["isActive", "isFeatured"] as const) {
    const next = input[field] ?? (field === "isActive" ? true : false);
    setIfChanged(field, next, existing[field], data, before, after);
  }

  if ("variants" in input) {
    const next = canonicalJson(variants);
    if (canonicalJson(existing.variants) !== next) {
      data.variants = jsonInput(variants);
      before.variants = canonicalJson(existing.variants);
      after.variants = next;
    }
  }

  if ("specifications" in input) {
    const next = canonicalJson(specifications);
    if (canonicalJson(existing.specifications) !== next) {
      data.specifications = jsonInput(specifications);
      before.specifications = canonicalJson(existing.specifications);
      after.specifications = next;
    }
  }

  if (canonicalJson(parseProductVideo(existing.video)) !== video.canonical) {
    data.video = video.json;
    before.video = canonicalJson(parseProductVideo(existing.video));
    after.video = video.canonical;
  }

  const currentImages = canonicalJson(
    existing.images.map((image) => ({
      url: image.url,
      alt: image.alt,
      sortOrder: image.sortOrder,
      isPrimary: image.isPrimary,
    })),
  );
  const nextImages = canonicalJson(images);
  const imagesChanged = currentImages !== nextImages;
  if (imagesChanged) {
    before.images = canonicalJson(existing.images.map((image) => image.url));
    after.images = canonicalJson(images.map((image) => image.url));
  }

  if (Object.keys(data).length === 0 && !imagesChanged) {
    return NextResponse.json({ ok: true, unchanged: true });
  }

  await prisma.$transaction(async (tx) => {
    if (imagesChanged) {
      await tx.productImage.deleteMany({ where: { productId: id } });
      await tx.productImage.createMany({
        data: images.map((image) => ({
          productId: id,
          url: image.url,
          alt: image.alt,
          sortOrder: image.sortOrder,
          isPrimary: image.isPrimary,
        })),
      });
    }
    if (Object.keys(data).length > 0) {
      await tx.product.update({ where: { id }, data });
    }
  });

  await writeAuditLog({
    actorId: admin.user.id,
    actorRole: "ADMIN",
    action: "PRODUCT_UPDATED",
    entityType: "Product",
    entityId: id,
    before,
    after: { ...after, name: after.name ?? existing.name },
  });

  return NextResponse.json({ ok: true });
}
