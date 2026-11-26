"use client";

import { useState } from "react";
import Image from "next/image";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@/i18n/navigation";
import { useLocale, useTranslations } from "next-intl";
import { ShoppingCart } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

type CartLineDTO = {
  productId: string;
  name: string;
  nameBn: string | null;
  image: string;
};

const ADDED_QUANTITY = 1;

export function AddToCartButton({
  productId,
  quantity = ADDED_QUANTITY,
  disabled = false,
  compact = false,
  className,
}: {
  productId: string;
  quantity?: number;
  disabled?: boolean;
  compact?: boolean;
  className?: string;
}) {
  const addedQuantity = Math.max(1, Math.trunc(quantity));
  const t = useTranslations("store");
  const tc = useTranslations("common");
  const locale = useLocale();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [pending, setPending] = useState(false);

  async function addToCart() {
    setPending(true);
    try {
      const response = await fetch("/api/cart/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId, quantity: addedQuantity }),
      });

      if (!response.ok) throw new Error("Unable to add item");

      const cart = (await response.json()) as { lines: CartLineDTO[] };
      const line = cart.lines.find((item) => item.productId === productId);

      await queryClient.invalidateQueries({ queryKey: ["cart-count"] });

      if (line) {
        const name = locale === "bn" && line.nameBn ? line.nameBn : line.name;
        const count = new Intl.NumberFormat(locale).format(addedQuantity);

        toast.success(
          <div className="flex items-center gap-3 py-0.5 pr-1">
            <Image
              src={line.image}
              alt=""
              width={44}
              height={44}
              unoptimized
              className="size-11 shrink-0 rounded-lg object-cover"
            />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{name}</p>
              <p className="mt-0.5 truncate text-xs text-muted-foreground">
                {t("addedQuantity", { count })}
              </p>
            </div>
          </div>,
        );
      } else {
        toast.success(t("added"));
      }

      router.refresh();
    } catch {
      toast.error(tc("error"));
    } finally {
      setPending(false);
    }
  }

  return (
    <Button
      type="button"
      onClick={addToCart}
      disabled={disabled || pending}
      size={compact ? "sm" : "default"}
      className={className}
      aria-label={t("addToCart")}
    >
      <ShoppingCart className="size-4" aria-hidden="true" />
      <span>{pending ? tc("loading") : t("addToCart")}</span>
    </Button>
  );
}
