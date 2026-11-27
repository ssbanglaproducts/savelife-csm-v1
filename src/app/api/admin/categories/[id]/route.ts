import { NextResponse } from "next/server";
import { requireAdminApiSession } from "@/lib/admin-access";
import { writeAuditLog } from "@/lib/audit";
import {
  categoryAuditValues,
  categoryParentId,
  categoryWriteSchema,
  normalizeCategoryImageUrl,
} from "@/lib/category-admin";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  const admin = await requireAdminApiSession("categories.manage");
  if (!admin) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  const { id } = await context.params;
  const existing = await prisma.category.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      nameBn: true,
      slug: true,
      description: true,
      image: true,
      sortOrder: true,
      isActive: true,
      parentId: true,
      _count: { select: { children: true } },
    },
  });
  if (!existing) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const parsed = categoryWriteSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  const input = parsed.data;
  const image = normalizeCategoryImageUrl(input.image);
  if (input.image?.trim() && !image) {
    return NextResponse.json({ error: "INVALID_IMAGE" }, { status: 400 });
  }

  const parentId = categoryParentId(input);
  if (parentId === id) {
    return NextResponse.json({ error: "INVALID_PARENT" }, { status: 400 });
  }
  if (parentId && existing._count.children > 0) {
    return NextResponse.json({ error: "CATEGORY_HAS_CHILDREN" }, { status: 409 });
  }
  if (parentId) {
    const parent = await prisma.category.findUnique({
      where: { id: parentId },
      select: { id: true, parentId: true },
    });
    if (!parent || parent.parentId) {
      return NextResponse.json({ error: "INVALID_PARENT" }, { status: 400 });
    }
  }

  const slugTaken = await prisma.category.findFirst({
    where: { slug: input.slug, id: { not: id } },
    select: { id: true },
  });
  if (slugTaken) return NextResponse.json({ error: "SLUG_TAKEN" }, { status: 409 });

  const next = categoryAuditValues(input);
  const before = {
    name: existing.name,
    nameBn: existing.nameBn,
    slug: existing.slug,
    description: existing.description,
    image: existing.image,
    sortOrder: existing.sortOrder,
    isActive: existing.isActive,
    parentId: existing.parentId,
  };

  const category = await prisma.category.update({
    where: { id },
    data: { ...next, image, parentId },
    select: { id: true, name: true, slug: true, parentId: true },
  });

  const changedBefore = Object.fromEntries(
    Object.entries(before).filter(
      ([key, value]) => value !== next[key as keyof typeof next],
    ),
  );
  const changedAfter = Object.fromEntries(
    Object.entries(next).filter(
      ([key, value]) => value !== before[key as keyof typeof before],
    ),
  );

  await writeAuditLog({
    actorId: admin.user.id,
    actorRole: admin.user.role,
    action: "CATEGORY_UPDATED",
    entityType: "Category",
    entityId: id,
    before: changedBefore,
    after: changedAfter,
  });

  return NextResponse.json({ ok: true, category });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const admin = await requireAdminApiSession("categories.manage");
  if (!admin) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  const { id } = await context.params;
  const existing = await prisma.category.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      nameBn: true,
      slug: true,
      description: true,
      image: true,
      sortOrder: true,
      isActive: true,
      parentId: true,
      _count: { select: { products: true, children: true } },
    },
  });
  if (!existing) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  if (existing._count.products > 0) {
    return NextResponse.json({ error: "CATEGORY_HAS_PRODUCTS" }, { status: 409 });
  }
  if (existing._count.children > 0) {
    return NextResponse.json({ error: "CATEGORY_HAS_CHILDREN" }, { status: 409 });
  }

  await prisma.category.delete({ where: { id } });
  const before = {
    name: existing.name,
    nameBn: existing.nameBn,
    slug: existing.slug,
    description: existing.description,
    image: existing.image,
    sortOrder: existing.sortOrder,
    isActive: existing.isActive,
    parentId: existing.parentId,
  };
  await writeAuditLog({
    actorId: admin.user.id,
    actorRole: admin.user.role,
    action: "CATEGORY_DELETED",
    entityType: "Category",
    entityId: id,
    before,
    after: {},
  });

  return NextResponse.json({ ok: true });
}
