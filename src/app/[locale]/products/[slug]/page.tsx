import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ArrowLeft, ChevronDown, PackageCheck } from "lucide-react";
import { StoreShell } from "@/components/layout/store-shell";
import { ProductGallery } from "@/components/store/product-gallery";
import { ProductGrid } from "@/components/store/product-grid";
import { PurchasePanel } from "@/components/store/purchase-panel";
import { Link } from "@/i18n/navigation";
import { getProductBySlug, getProducts } from "@/lib/catalog";
import { formatTaka } from "@/lib/money";

export const dynamic = "force-dynamic";

function ExpandableSection({
  title,
  children,
  defaultOpen = false,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  return (
    <details
      open={defaultOpen}
      className="group rounded-2xl border border-border bg-[var(--glass)] open:bg-[var(--card-solid)]"
    >
      <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 px-5 text-sm font-bold [&::-webkit-details-marker]:hidden">
        {title}
        <ChevronDown
          className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
          aria-hidden="true"
        />
      </summary>
      <div className="border-t border-border px-5 py-4 text-sm leading-relaxed text-muted-foreground">
        {children}
      </div>
    </details>
  );
}

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  setRequestLocale(locale);

  const product = await getProductBySlug(slug);
  if (!product) notFound();

  const t = await getTranslations("product");

  const related = product.categorySlug
    ? (await getProducts({ category: product.categorySlug, sort: "recommended" }))
        .filter((item) => item.id !== product.id)
        .slice(0, 4)
    : [];
  const name = locale === "bn" && product.nameBn ? product.nameBn : product.name;
  const description =
    locale === "bn" && product.descriptionBn ? product.descriptionBn : product.description;
  const categoryName =
    locale === "bn" && product.categoryNameBn ? product.categoryNameBn : product.categoryName;
  const specifications = product.specifications ?? [];

  return (
    <StoreShell maxWidth="max-w-6xl">
      <div className="space-y-8">
        <Link
          href="/products"
          className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground transition hover:text-primary"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          {t("back")}
        </Link>

        <div className="grid gap-8 lg:grid-cols-2 lg:items-start">
          <ProductGallery images={product.images} name={name} video={product.video} />

          <div className="space-y-6">
            <div>
              {categoryName ? (
                <p className="text-xs font-bold uppercase tracking-[0.12em] text-primary">
                  {categoryName}
                </p>
              ) : null}
              <h1 className="mt-2 font-display text-3xl font-bold tracking-tight sm:text-4xl">
                {name}
              </h1>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <p className="font-display text-3xl font-bold tabular-nums text-primary">
                  {formatTaka(BigInt(product.pricePaisa), locale)}
                </p>
                {product.compareAtPaisa ? (
                  <p className="text-base text-muted-foreground line-through">
                    {formatTaka(BigInt(product.compareAtPaisa), locale)}
                  </p>
                ) : null}
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${
                    product.stock > 0
                      ? "bg-primary/10 text-primary"
                      : "bg-red-500/10 text-red-500"
                  }`}
                >
                  <PackageCheck className="size-3.5" aria-hidden="true" />
                  {product.stock > 0
                    ? t("inStock", { count: product.stock })
                    : t("outOfStock")}
                </span>
              </div>
              {product.brand ? (
                <p className="mt-2 text-xs text-muted-foreground">
                  {t("brand")}: {product.brand}
                </p>
              ) : null}
              {product.subcategory ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  {t("subcategory")}: {product.subcategory}
                </p>
              ) : null}
            </div>

            <PurchasePanel
              locale={locale}
              product={{
                id: product.id,
                name: product.name,
                nameBn: product.nameBn,
                image: product.image,
                pricePaisa: product.pricePaisa,
                stock: product.stock,
              }}
            />

            <div className="space-y-3">
              <ExpandableSection title={t("description")} defaultOpen>
                <p>{description || "—"}</p>
              </ExpandableSection>
              <ExpandableSection title={t("specifications")}>
                {specifications.length > 0 ? (
                  <dl className="grid gap-3 sm:grid-cols-2">
                    {specifications.map((spec, index) => {
                      const label =
                        locale === "bn" && spec.labelBn ? spec.labelBn : spec.label;
                      const value =
                        locale === "bn" && spec.valueBn ? spec.valueBn : spec.value;
                      return (
                        <div key={`${spec.label}-${index}`} className="rounded-xl bg-muted/40 p-3">
                          <dt className="text-xs font-bold text-foreground">{label}</dt>
                          <dd className="mt-1 text-xs">{value}</dd>
                        </div>
                      );
                    })}
                  </dl>
                ) : (
                  <dl className="grid gap-3 sm:grid-cols-2">
                    {product.sku ? (
                      <div className="rounded-xl bg-muted/40 p-3">
                        <dt className="text-xs font-bold text-foreground">SKU</dt>
                        <dd className="mt-1 text-xs" translate="no">{product.sku}</dd>
                      </div>
                    ) : null}
                    {categoryName ? (
                      <div className="rounded-xl bg-muted/40 p-3">
                        <dt className="text-xs font-bold text-foreground">{t("category")}</dt>
                        <dd className="mt-1 text-xs">{categoryName}</dd>
                      </div>
                    ) : null}
                  </dl>
                )}
              </ExpandableSection>
            </div>
          </div>
        </div>

        {related.length > 0 ? (
          <section>
            <h2 className="mb-4 font-display text-2xl font-bold tracking-tight">{t("related")}</h2>
            <ProductGrid products={related} locale={locale} />
          </section>
        ) : null}
      </div>
    </StoreShell>
  );
}
