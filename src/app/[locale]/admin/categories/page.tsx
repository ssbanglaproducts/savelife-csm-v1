import { getLocale, getTranslations } from "next-intl/server";
import { LayoutGrid } from "lucide-react";
import { auth } from "@/auth";
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
    auth(),
    getLocale(),
    getTranslations("nav"),
    getTranslations("adminPanel"),
  ]);
  if (session?.user?.role !== "ADMIN") redirect({ href: "/admin-login", locale });

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
      _count: { select: { products: true } },
    },
  });

  const categories: AdminCategoryView[] = rows.map(({ _count, ...category }) => ({
    ...category,
    productCount: _count.products,
  }));

  return (
    <div className="space-y-6">
      <AdminPageIntro
        eyebrow={tn("admin")}
        title={ta("categoriesTitle")}
        intro={ta("categoriesIntro")}
        icon={<LayoutGrid className="size-5" aria-hidden="true" />}
      />
      <AdminSection id="categories" title={ta("categoriesTitle")}>
        <CategoryManager categories={categories} />
      </AdminSection>
    </div>
  );
}
