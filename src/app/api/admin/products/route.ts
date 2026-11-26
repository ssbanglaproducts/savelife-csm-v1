import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { writeAuditLog } from "@/lib/audit";
import {
  canonicalJson,
  jsonInput,
  normalizeProductImages,
  normalizeProductVideo,
  normalizeSpecifications,
  normalizeVariants,
  productWriteSchema,
} from "@/lib/product-admin";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function text(value: string | null | undefined): string | null {
  return value?.trim() || null;
}

export async function POST(request: Request) {
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
  const parsed = productWriteSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  const input = parsed.data;
  const images = normalizeProductImages(input.images);
  if (!images) return NextResponse.json({ error: "At least one valid image is required" }, { status: 400 });

  const categoryId = text(input.categoryId);
  const sku = text(input.sku);
  const slug = text(input.slug)!;

  const [slugExists, skuExists, category] = await Promise.all([
    prisma.product.findUnique({ where: { slug }, select: { id: true } }),
    sku ? prisma.product.findUnique({ where: { sku }, select: { id: true } }) : Promise.resolve(null),
    categoryId
      ? prisma.category.findUnique({ where: { id: categoryId }, select: { id: true } })
      : Promise.resolve(null),
  ]);
  if (slugExists) return NextResponse.json({ error: "SLUG_TAKEN" }, { status: 409 });
  if (skuExists) return NextResponse.json({ error: "SKU_TAKEN" }, { status: 409 });
  if (categoryId && !category) return NextResponse.json({ error: "CATEGORY_NOT_FOUND" }, { status: 400 });

  const variants = normalizeVariants(input.variants);
  const specifications = normalizeSpecifications(input.specifications);
  const video = normalizeProductVideo(input.video);

  const product = await prisma.product.create({
    data: {
      name: input.name,
      nameBn: text(input.nameBn),
      slug,
      description: text(input.description),
      descriptionBn: text(input.descriptionBn),
      categoryId,
      sku,
      brand: text(input.brand),
      subcategory: text(input.subcategory),
      variants: jsonInput(variants),
      specifications: jsonInput(specifications),
      video: video.json,
      pricePaisa: BigInt(input.pricePaisa),
      compareAtPaisa: input.compareAtPaisa ? BigInt(input.compareAtPaisa) : null,
      stock: input.stock,
      isActive: input.isActive ?? true,
      isFeatured: input.isFeatured ?? false,
      images: {
        create: images.map((image) => ({
          url: image.url,
          alt: image.alt,
          sortOrder: image.sortOrder,
          isPrimary: image.isPrimary,
        })),
      },
    },
    select: { id: true, name: true, slug: true },
  });

  await writeAuditLog({
    actorId: admin.user.id,
    actorRole: "ADMIN",
    action: "PRODUCT_CREATED",
    entityType: "Product",
    entityId: product.id,
    before: {},
    after: {
      name: product.name,
      slug: product.slug,
      images: canonicalJson(images.map((image) => image.url)),
      video: video.canonical,
    },
  });

  return NextResponse.json({ ok: true, product }, { status: 201 });
}
