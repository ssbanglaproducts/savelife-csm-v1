"use client";

import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { CheckCircle2, Loader2, ShieldCheck, Wallet } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { AddressPicker } from "@/components/store/address-picker";
import { TPinConfirmDialog } from "@/components/member/tpin-confirm-dialog";
import type { CartSummary } from "@/lib/cart";
import { formatSP, formatTaka } from "@/lib/money";
import type { Viewer } from "@/lib/viewer";

export function CheckoutForm({
  cart,
  availablePaisa,
  locale,
  viewer,
}: {
  cart: CartSummary;
  availablePaisa: bigint;
  locale: string;
  viewer: Viewer;
}) {
  const t = useTranslations("checkout");
  const tc = useTranslations("common");
  const tm = useTranslations("memberPanel");
  const router = useRouter();
  const queryClient = useQueryClient();
  const idempotencyKey = useRef<string | null>(null);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [pinOpen, setPinOpen] = useState(false);
  const [pinError, setPinError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const orderTotalPaisa = BigInt(cart.subtotalPaisa);
  const sufficient = availablePaisa >= orderTotalPaisa;

  function errorMessage(code: string | undefined) {
    switch (code) {
      case "INVALID_TPIN":
        return t("errorInvalidTPin");
      case "TPIN_NOT_SET":
        return t("errorTPinNotSet");
      case "INSUFFICIENT_BALANCE":
        return t("errorInsufficientBalance");
      case "DUPLICATE_REQUEST":
        return tm("duplicateRequestError");
      case "CART_EMPTY":
        return t("errorCartEmpty");
      case "MEMBER_SUSPENDED":
        return t("errorMemberSuspended");
      default:
        return tc("error");
    }
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedAddressId) {
      toast.error(t("addressRequired"));
      return;
    }
    if (!sufficient) {
      toast.error(t("errorInsufficientBalance"));
      return;
    }
    setPinError(null);
    idempotencyKey.current ??= `${Date.now()}:${Math.random().toString(36).slice(2)}`;
    setPinOpen(true);
  }

  async function confirmOrder(tPin: string) {
    if (!selectedAddressId) return;
    setPending(true);
    setPinError(null);

    try {
      const response = await fetch("/api/store/purchases/cart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          addressId: selectedAddressId,
          tPin,
          locale,
          idempotencyKey: idempotencyKey.current,
        }),
      });
      const data = (await response.json()) as {
        error?: string;
        order?: { orderNumber: string };
      };

      if (response.status === 401) {
        setPinOpen(false);
        router.push("/login");
        return;
      }

      if (!response.ok || !data.order) {
        const message = errorMessage(data.error);
        setPinError(message);
        toast.error(message);
        if (data.error === "DUPLICATE_REQUEST") {
          idempotencyKey.current = null;
          setPinOpen(false);
        }
        return;
      }

      setPinOpen(false);
      toast.success(t("orderCreated"));
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["cart-count"] }),
        queryClient.invalidateQueries({ queryKey: ["viewer"] }),
      ]);
      router.push(`/orders/${data.order.orderNumber}`);
      router.refresh();
    } catch {
      const message = tc("error");
      setPinError(message);
      toast.error(message);
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <form onSubmit={handleSubmit} className="glass relative overflow-hidden rounded-3xl p-6 shadow-xl sm:p-8">
        <span
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary to-transparent"
          aria-hidden="true"
        />

        <fieldset className="space-y-4">
          <legend className="font-display text-lg font-bold">{t("addressTitle")}</legend>
          <AddressPicker
            viewer={viewer}
            selectedId={selectedAddressId}
            onSelect={setSelectedAddressId}
            disabled={pending}
          />
        </fieldset>

        <fieldset className="mt-8 space-y-4">
          <legend className="font-display text-lg font-bold">{t("walletPayTitle")}</legend>
          <div className="rounded-2xl border border-primary/20 bg-primary/[0.04] p-4">
            <div className="flex items-center gap-3">
              <span
                className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary"
                aria-hidden="true"
              >
                <Wallet className="size-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-primary">{tm("available")}</p>
                <p className="font-display text-xl font-bold tabular-nums">{formatSP(availablePaisa)}</p>
              </div>
              <Link
                href="/member/top-up"
                className="text-xs font-bold text-primary hover:underline focus-visible:rounded focus-visible:ring-2 focus-visible:ring-ring"
              >
                {tm("addMoney")}
              </Link>
            </div>
            <div className="mt-4 flex items-center justify-between border-t border-primary/15 pt-3 text-sm">
              <span className="text-muted-foreground">{t("orderTotal")}</span>
              <span className="font-bold tabular-nums">{formatTaka(orderTotalPaisa, locale)}</span>
            </div>
            <p
              className={`mt-2 flex items-center gap-1.5 text-xs font-semibold ${
                sufficient ? "text-emerald-600 dark:text-emerald-300" : "text-red-600 dark:text-red-300"
              }`}
              role="status"
            >
              {sufficient ? <CheckCircle2 className="size-3.5" aria-hidden="true" /> : null}
              {sufficient ? t("sufficientBalance") : t("insufficientBalance")}
            </p>
          </div>
        </fieldset>

        <div className="mt-8 flex flex-col gap-4 border-t border-border pt-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{t("summary")}</p>
            <p className="font-display text-2xl font-bold tabular-nums">
              {formatTaka(orderTotalPaisa, locale)}
            </p>
          </div>
          <Button
            type="submit"
            size="lg"
            disabled={pending || !selectedAddressId || !sufficient || cart.lines.length === 0}
          >
            {pending ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <ShieldCheck className="size-4" aria-hidden="true" />
            )}
            {pending ? t("confirming") : t("confirmPay")}
          </Button>
        </div>
      </form>

      {pinOpen ? (
        <TPinConfirmDialog
          open
          title={tm("tPinDialogTitle")}
          busy={pending}
          error={pinError}
          onClose={() => {
            if (!pending) setPinOpen(false);
          }}
          onConfirm={(pin) => void confirmOrder(pin)}
        />
      ) : null}
    </>
  );
}
