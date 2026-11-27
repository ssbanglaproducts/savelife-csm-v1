import { getLocale, getTranslations } from "next-intl/server";
import { LayoutGrid } from "lucide-react";
import { getAdminAccess, hasAdminPermission } from "@/lib/admin-access";
import { redirect } from "@/i18n/navigation";
import { AdminPageIntro, AdminSection } from "@/components/admin/admin-ui";
import {
  CategoryManager,
  type AdminCategoryView,
} from "@/components/admin/category-manager";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function AdminCategoriesPage() {
  const [session, locale, tn, ta] = await Promise.all([
    getAdminAccess(),
    getLocale(),
    getTranslations("nav"),
    getTranslations("adminPanel"),
  ]);
  if (!session || !hasAdminPermission(session, "categories.view")) redirect({ href: "/admin-login", locale });

  const rows = await prisma.category.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      nameBn: true,
      slug: true,
      image: true,
      sortOrder: true,
      isActive: true,
      parentId: true,
      _count: { select: { products: true, children: true } },
    },
  });

  const parentNames = new Map(rows.map((row) => [row.id, { name: row.name, nameBn: row.nameBn }]));
  const categories: AdminCategoryView[] = rows.map(({ _count, ...category }) => {
    const parent = category.parentId ? parentNames.get(category.parentId) : undefined;
    return {
      ...category,
      parentName: parent?.name ?? null,
      parentNameBn: parent?.nameBn ?? null,
      productCount: _count.products,
      childCount: _count.children,
    };
  });

  return (
    <div className="space-y-6">
      <AdminPageIntro
        eyebrow={tn("admin")}
        title={ta("categoriesTitle")}
        intro={ta("categoriesIntro")}
        icon={<LayoutGrid className="size-5" aria-hidden="true" />}
      />
      <AdminSection
        id="categories"
        title={ta("categoriesTitle")}
        hideTitleOnDesktop
      >
        <CategoryManager categories={categories} locale={locale} />
      </AdminSection>
    </div>
  );
}
