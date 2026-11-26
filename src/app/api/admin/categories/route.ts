import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { writeAuditLog } from "@/lib/audit";
import {
  categoryAuditValues,
  categoryWriteSchema,
  normalizeCategoryImageUrl,
} from "@/lib/category-admin";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const admin = await auth();
  if (admin?.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  const categories = await prisma.category.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      nameBn: true,
      slug: true,
      description: true,
      image: true,
      sortOrder: true,
      isActive: true,
      _count: { select: { products: true } },
    },
  });

  return NextResponse.json({
    categories: categories.map(({ _count, ...category }) => ({
      ...category,
      productCount: _count.products,
    })),
  });
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
  const parsed = categoryWriteSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  const input = parsed.data;
  const image = normalizeCategoryImageUrl(input.image);
  if (input.image?.trim() && !image) {
    return NextResponse.json({ error: "INVALID_IMAGE" }, { status: 400 });
  }

  const slugExists = await prisma.category.findUnique({
    where: { slug: input.slug },
    select: { id: true },
  });
  if (slugExists) return NextResponse.json({ error: "SLUG_TAKEN" }, { status: 409 });

  const category = await prisma.category.create({
    data: {
      ...categoryAuditValues(input),
      image,
    },
    select: { id: true, name: true, slug: true },
  });

  await writeAuditLog({
    actorId: admin.user.id,
    actorRole: "ADMIN",
    action: "CATEGORY_CREATED",
    entityType: "Category",
    entityId: category.id,
    before: {},
    after: categoryAuditValues(input),
  });

  return NextResponse.json({ ok: true, category }, { status: 201 });
}
