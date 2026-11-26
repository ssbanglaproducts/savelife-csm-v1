"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Minus, Plus } from "lucide-react";
import type { PurchaseProduct } from "./product-actions";
import { ProductActions } from "./product-actions";
import { formatTaka } from "@/lib/money";

export function PurchasePanel({
  product,
  locale,
}: {
  product: PurchaseProduct;
  locale: string;
}) {
  const t = useTranslations("product");
  const tc = useTranslations("common");
  const max = Math.max(1, product.stock);
  const [quantity, setQuantity] = useState(1);

  const bounded = Math.max(1, Math.min(quantity, max));
  const total = BigInt(product.pricePaisa) * BigInt(bounded);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.1em] text-muted-foreground">
            {tc("quantity")}
          </p>
          <div className="mt-2 inline-flex h-12 items-center rounded-xl border border-border bg-[var(--card-solid)]">
            <button
              type="button"
              onClick={() => setQuantity((value) => Math.max(1, value - 1))}
              disabled={bounded <= 1}
              aria-label={`${tc("quantity")} -1`}
              className="flex size-11 items-center justify-center rounded-l-xl transition hover:bg-accent disabled:opacity-40"
            >
              <Minus className="size-4" aria-hidden="true" />
            </button>
            <span className="min-w-12 text-center font-bold tabular-nums">{bounded}</span>
            <button
              type="button"
              onClick={() => setQuantity((value) => Math.min(max, value + 1))}
              disabled={bounded >= max}
              aria-label={`${tc("quantity")} +1`}
              className="flex size-11 items-center justify-center rounded-r-xl transition hover:bg-accent disabled:opacity-40"
            >
              <Plus className="size-4" aria-hidden="true" />
            </button>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">{t("maxQuantity", { count: max })}</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-muted-foreground">{t("total")}</p>
          <p className="font-display text-2xl font-bold tabular-nums">{formatTaka(total, locale)}</p>
        </div>
      </div>

      <ProductActions product={{ ...product, quantity: bounded }} />
    </div>
  );
}
