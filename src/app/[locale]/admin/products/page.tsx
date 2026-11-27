import { getLocale, getTranslations } from "next-intl/server";
import { Package } from "lucide-react";
import { getAdminAccess, hasAdminPermission } from "@/lib/admin-access";
import { redirect } from "@/i18n/navigation";
import { AdminPageIntro } from "@/components/admin/admin-ui";
import {
  ProductManager,
  type AdminProductView,
} from "@/components/admin/product-editor";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function AdminProductsPage() {
  const [session, locale, tn, ta] = await Promise.all([
    getAdminAccess(),
    getLocale(),
    getTranslations("nav"),
    getTranslations("adminPanel"),
  ]);
  if (!session || !hasAdminPermission(session, "products.view")) redirect({ href: "/admin-login", locale });

  const [products, categories] = await Promise.all([
    prisma.product.findMany({
      orderBy: { createdAt: "desc" },
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
          select: { url: true, alt: true, isPrimary: true },
        },
      },
    }),
    prisma.category.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, nameBn: true, parentId: true },
    }),
  ]);

  const productViews: readonly AdminProductView[] = products.map((product) => ({
    id: product.id,
    name: product.name,
    nameBn: product.nameBn,
    slug: product.slug,
    description: product.description,
    descriptionBn: product.descriptionBn,
    categoryId: product.categoryId,
    sku: product.sku,
    brand: product.brand,
    subcategory: product.subcategory,
    variants: product.variants,
    specifications: product.specifications,
    video: product.video,
    pricePaisa: product.pricePaisa.toString(),
    compareAtPaisa: product.compareAtPaisa?.toString() ?? null,
    stock: product.stock,
    isActive: product.isActive,
    isFeatured: product.isFeatured,
    images: product.images.map((image) => ({
      url: image.url,
      alt: image.alt,
      isPrimary: image.isPrimary,
    })),
  }));

  return (
    <div className="space-y-8 animate-rise">
      <AdminPageIntro
        eyebrow={tn("admin")}
        title={ta("productsTitle")}
        intro={ta("productsIntro")}
        icon={<Package className="size-3.5" aria-hidden="true" />}
      />
      <ProductManager products={productViews} categories={categories} />
    </div>
  );
}
