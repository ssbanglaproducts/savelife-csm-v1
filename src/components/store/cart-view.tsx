"use client";

import { useState } from "react";
import Image from "next/image";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { Minus, Plus, ShoppingBag, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Link } from "@/i18n/navigation";
import { buttonVariants } from "@/components/ui/button";
import type { CartSummary } from "@/lib/cart";
import { formatTaka } from "@/lib/money";
import { cn } from "@/lib/utils";

export function CartView({
  initialCart,
  locale,
  canCheckout,
}: {
  initialCart: CartSummary;
  locale: string;
  canCheckout: boolean;
}) {
  const t = useTranslations("cart");
  const tc = useTranslations("common");
  const queryClient = useQueryClient();
  const [cart, setCart] = useState(initialCart);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function mutate(url: string, options: RequestInit, fallback: string) {
    setBusyId(fallback);
    try {
      const response = await fetch(url, options);
      if (!response.ok) throw new Error("Cart update failed");
      const updated = (await response.json()) as CartSummary;
      setCart(updated);
      await queryClient.invalidateQueries({ queryKey: ["cart-count"] });
    } catch {
      toast.error(tc("error"));
    } finally {
      setBusyId(null);
    }
  }

  function changeQuantity(productId: string, quantity: number) {
    void mutate(
      "/api/cart/items",
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId, quantity }),
      },
      productId,
    );
  }

  function remove(productId: string) {
    void mutate(`/api/cart/items?productId=${encodeURIComponent(productId)}`, { method: "DELETE" }, productId);
  }

  if (cart.lines.length === 0) {
    return (
      <div className="glass flex flex-col items-center rounded-3xl px-6 py-16 text-center">
        <span className="flex size-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <ShoppingBag className="size-7" aria-hidden="true" />
        </span>
        <h2 className="mt-5 font-display text-2xl font-bold">{t("emptyTitle")}</h2>
        <p className="mt-2 max-w-sm text-sm text-muted-foreground">{t("emptyBody")}</p>
        <Link href="/products" className={cn(buttonVariants(), "mt-6")}>
          {t("continueShopping")}
        </Link>
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <section aria-label={t("title")} className="glass overflow-hidden rounded-3xl">
        <ul className="divide-y divide-border">
          {cart.lines.map((line) => {
            const name = locale === "bn" && line.nameBn ? line.nameBn : line.name;
            const busy = busyId === line.productId;

            return (
              <li key={line.productId} className="flex gap-4 p-4 sm:p-5">
                <Link
                  href={`/products/${line.slug}`}
                  className="relative size-20 shrink-0 overflow-hidden rounded-2xl ring-1 ring-border"
                >
                  <Image src={line.image} alt={name} fill unoptimized sizes="80px" className="object-cover" />
                </Link>

                <div className="flex min-w-0 flex-1 flex-col justify-between gap-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <Link
                        href={`/products/${line.slug}`}
                        className="truncate font-display font-bold hover:text-primary"
                      >
                        {name}
                      </Link>
                      <p className="mt-1 text-sm font-semibold text-primary">
                        {formatTaka(BigInt(line.unitPricePaisa), locale)}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => remove(line.productId)}
                      disabled={busy}
                      aria-label={`${tc("remove")} ${name}`}
                      className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-red-500/10 hover:text-red-500 disabled:opacity-50"
                    >
                      <Trash2 className="size-4" aria-hidden="true" />
                    </button>
                  </div>

                  <div className="flex items-center justify-between gap-3">
                    <div className="inline-flex items-center rounded-xl border border-border">
                      <button
                        type="button"
                        onClick={() => changeQuantity(line.productId, line.quantity - 1)}
                        disabled={busy}
                        aria-label={`${tc("remove")} 1`}
                        className="rounded-l-xl p-2 hover:bg-accent disabled:opacity-50"
                      >
                        <Minus className="size-3.5" aria-hidden="true" />
                      </button>
                      <span className="min-w-8 text-center text-sm font-bold tabular-nums">{line.quantity}</span>
                      <button
                        type="button"
                        onClick={() => changeQuantity(line.productId, line.quantity + 1)}
                        disabled={busy || line.quantity >= line.stock}
                        aria-label={`${tc("quantity")} +1`}
                        className="rounded-r-xl p-2 hover:bg-accent disabled:opacity-50"
                      >
                        <Plus className="size-3.5" aria-hidden="true" />
                      </button>
                    </div>
                    <p className="font-display font-bold tabular-nums">
                      {formatTaka(BigInt(line.lineTotalPaisa), locale)}
                    </p>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <aside className="glass h-fit rounded-3xl p-6">
        <h2 className="font-display text-xl font-bold">{t("summary")}</h2>
        <dl className="mt-5 space-y-3 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">{t("subtotal")}</dt>
            <dd className="font-semibold tabular-nums">
              {formatTaka(BigInt(cart.subtotalPaisa), locale)}
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">{t("shipping")}</dt>
            <dd className="font-semibold text-primary">{t("free")}</dd>
          </div>
          <div className="flex justify-between gap-4 border-t border-border pt-4 text-base">
            <dt className="font-bold">{t("total")}</dt>
            <dd className="font-display font-bold tabular-nums">
              {formatTaka(BigInt(cart.subtotalPaisa), locale)}
            </dd>
          </div>
        </dl>

        {canCheckout ? (
          <Link href="/checkout" className={cn(buttonVariants({ size: "lg" }), "mt-6 w-full")}>
            {t("checkout")}
          </Link>
        ) : (
          <div className="mt-6 space-y-2">
            <Link href="/login" className={cn(buttonVariants({ variant: "outline" }), "w-full")}>
              {tc("login")}
            </Link>
            <Link href="/register" className={cn(buttonVariants(), "w-full")}>
              {tc("register")}
            </Link>
          </div>
        )}

        <Link
          href="/products"
          className="mt-4 block text-center text-sm font-semibold text-primary hover:underline"
        >
          {t("continueShopping")}
        </Link>
      </aside>
    </div>
  );
}
