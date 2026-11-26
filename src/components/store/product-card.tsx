import Image from "next/image";
import { Link } from "@/i18n/navigation";
import type { StoreProduct } from "@/lib/catalog";
import { formatTaka } from "@/lib/money";
import { ProductActions } from "./product-actions";

export async function ProductCard({
  product,
  locale,
}: {
  product: StoreProduct;
  locale: string;
}) {
  const name = locale === "bn" && product.nameBn ? product.nameBn : product.name;

  return (
    <article className="glass glass-hover group relative flex min-w-0 flex-col overflow-hidden rounded-3xl">
      <Link
        href={`/products/${product.slug}`}
        className="relative block aspect-square overflow-hidden rounded-t-3xl focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
        aria-label={name}
      >
        <Image
          src={product.image}
          alt={name}
          fill
          unoptimized
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 25vw"
          className="object-cover transition-transform duration-500 group-hover:scale-105"
        />
        <span className="pointer-events-none absolute inset-0 bg-gradient-to-t from-background/60 via-transparent to-transparent" />
      </Link>

      <div className="flex min-w-0 flex-1 flex-col p-5">
        <h3 className="truncate font-display text-base font-bold">{name}</h3>

        <div className="mt-4">
          <p className="font-display text-xl font-bold tabular-nums">
            {formatTaka(BigInt(product.pricePaisa), locale)}
          </p>
          {product.compareAtPaisa ? (
            <p className="text-xs text-muted-foreground line-through">
              {formatTaka(BigInt(product.compareAtPaisa), locale)}
            </p>
          ) : null}
        </div>

        <div className="mt-5 pt-1">
          <ProductActions
            product={{
              id: product.id,
              name: product.name,
              nameBn: product.nameBn,
              image: product.image,
              pricePaisa: product.pricePaisa,
              stock: product.stock,
            }}
            compact
          />
        </div>
      </div>
    </article>
  );
}
