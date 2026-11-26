import type { StoreProduct } from "@/lib/catalog";
import { ProductCard } from "./product-card";

export function ProductGrid({
  products,
  locale,
}: {
  products: StoreProduct[];
  locale: string;
}) {
  if (products.length === 0) return null;

  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
      {products.map((product) => (
        <ProductCard key={product.id} product={product} locale={locale} />
      ))}
    </div>
  );
}
