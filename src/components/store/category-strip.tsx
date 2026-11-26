import Image from "next/image";
import { LayoutGrid } from "lucide-react";
import { Link } from "@/i18n/navigation";
import type { StoreCategory } from "@/lib/catalog";
import { cn } from "@/lib/utils";

const FALLBACK_IMAGE = "/images/store-fallback.svg";

export function CategoryStrip({
  categories,
  locale,
  activeSlug,
  basePath = "/categories",
}: {
  categories: StoreCategory[];
  locale: string;
  activeSlug?: string;
  basePath?: string;
}) {
  if (categories.length === 0) return null;

  return (
    <nav aria-label="Categories" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
      {categories.map((category) => {
        const active = category.slug === activeSlug;
        const hasImage = Boolean(category.image && category.image !== FALLBACK_IMAGE);
        return (
          <Link
            key={category.id}
            href={`${basePath}/${category.slug}`}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex min-h-11 shrink-0 items-center gap-2 rounded-full border py-1.5 pl-2 pr-4 text-sm font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-ring",
              active
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-[var(--card-solid)] text-muted-foreground hover:border-primary/40 hover:text-primary",
            )}
          >
            <span
              className={cn(
                "relative flex size-6 shrink-0 items-center justify-center overflow-hidden rounded-full ring-1 ring-inset",
                active ? "bg-primary-foreground/20 ring-primary-foreground/30" : "bg-primary/10 ring-primary/20",
              )}
            >
              {hasImage ? (
                <Image
                  src={category.image}
                  alt=""
                  fill
                  unoptimized
                  sizes="24px"
                  className="object-cover"
                />
              ) : (
                <LayoutGrid className="size-3.5 text-primary" aria-hidden="true" />
              )}
            </span>
            <span className="truncate">
              {locale === "bn" && category.nameBn ? category.nameBn : category.name}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
