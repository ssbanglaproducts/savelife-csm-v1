"use client";

import { useId, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { Store } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { DialogShell } from "@/components/ui/dialog-shell";
import { ActivationGuidanceDialog } from "@/components/member/activation-guidance";
import {
  activationGuidanceState,
  hasSufficientBalance,
  buyNowMode,
  remainingBalancePaisa,
} from "@/lib/purchase-rules";
import { formatSP, formatTaka } from "@/lib/money";
import type { Viewer } from "@/lib/viewer";
import { TPinConfirmDialog } from "@/components/member/tpin-confirm-dialog";
import { AddressPicker } from "./address-picker";
import { AddToCartButton } from "./add-to-cart-button";

export type PurchaseProduct = {
  id: string;
  name: string;
  nameBn: string | null;
  image: string;
  pricePaisa: string;
  stock: number;
  quantity?: number;
};

type ViewerResponse = { viewer: Viewer | null; availablePaisa: string };

type PurchaseResponse = {
  order: { id: string; orderNumber: string };
  activated: boolean;
  availablePaisa: string;
};

function SummaryRow({
  label,
  value,
  highlight = false,
  danger = false,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  danger?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl bg-[var(--glass)] px-3 py-2.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span
        className={`text-sm font-bold tabular-nums ${
          danger ? "text-red-600 dark:text-red-300" : highlight ? "text-primary" : ""
        }`}
      >
        {value}
      </span>
    </div>
  );
}

function purchaseErrorMessage(
  code: string | undefined,
  t: (key: "invalidTPin" | "tPinNotSet" | "insufficientBalance") => string,
  tc: (key: "error") => string,
) {
  switch (code) {
    case "INVALID_TPIN":
      return t("invalidTPin");
    case "TPIN_NOT_SET":
      return t("tPinNotSet");
    case "INSUFFICIENT_BALANCE":
      return t("insufficientBalance");
    default:
      return tc("error");
  }
}

function ActivationDialog({
  product,
  quantity,
  availablePaisa,
  onClose,
}: {
  product: PurchaseProduct;
  quantity: number;
  availablePaisa: bigint;
  onClose: () => void;
}) {
  const t = useTranslations("purchase");
  const tc = useTranslations("common");
  const locale = useLocale();
  const router = useRouter();
  const queryClient = useQueryClient();
  const titleId = useId();
  const requestKey = useRef(crypto.randomUUID());
  const [pinOpen, setPinOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const name = locale === "bn" && product.nameBn ? product.nameBn : product.name;
  const cost = BigInt(product.pricePaisa) * BigInt(quantity);
  const sufficient = hasSufficientBalance(availablePaisa, cost);
  const remaining = remainingBalancePaisa(availablePaisa, cost);

  function requestPin() {
    if (!sufficient) return;
    setError(null);
    setPinOpen(true);
  }

  async function confirmPurchase(tPin: string) {
    setPending(true);
    setError(null);
    try {
      const response = await fetch("/api/store/purchases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          flow: "ACTIVATION",
          productId: product.id,
          quantity,
          tPin,
          idempotencyKey: requestKey.current,
          locale,
        }),
      });
      const data = (await response.json()) as PurchaseResponse & { error?: string };
      if (!response.ok) {
        const message = purchaseErrorMessage(data.error, t, tc);
        setError(message);
        toast.error(message);
        if (data.error === "DUPLICATE_REQUEST") requestKey.current = crypto.randomUUID();
        return;
      }
      setPinOpen(false);
      toast.success(t("activationSuccess"));
      await queryClient.invalidateQueries({ queryKey: ["viewer"] });
      onClose();
      router.push(`/orders/${data.order.orderNumber}`);
      router.refresh();
    } catch {
      const message = tc("error");
      setError(message);
      toast.error(message);
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <DialogShell title={t("confirmTitle")} intro={t("confirmIntro")} titleId={titleId} onClose={onClose}>
        <div className="space-y-4">
        <div className="flex items-center gap-3 rounded-2xl border border-border p-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={product.image} alt="" className="size-14 shrink-0 rounded-xl object-cover" />
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">{t("product")}</p>
            <p className="truncate font-display font-bold">{name}</p>
          </div>
        </div>

        <div className="space-y-2">
          <SummaryRow label={tc("quantity")} value={String(quantity)} />
          <SummaryRow label={t("price")} value={formatTaka(cost, locale)} />
          <SummaryRow label={t("spCost")} value={formatSP(cost)} />
          <SummaryRow label={t("availableBalance")} value={formatSP(availablePaisa)} />
          <SummaryRow
            label={t("remainingBalance")}
            value={formatSP(remaining)}
            highlight={sufficient}
            danger={!sufficient}
          />
        </div>

        {!sufficient ? (
          <p
            role="alert"
            className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2.5 text-xs font-semibold text-red-600 dark:text-red-300"
          >
            {t("insufficientBalance")}
          </p>
        ) : null}

        <p className="rounded-xl bg-primary/10 px-3 py-2.5 text-xs leading-relaxed text-primary">
          <Store className="mr-1.5 inline size-3.5 align-[-2px]" aria-hidden="true" />
          {t("officePickupNote")}
        </p>

        <Button
          type="button"
          onClick={requestPin}
          disabled={pending || !sufficient}
          className="w-full"
        >
          {pending ? t("confirming") : t("confirmPurchase")}
        </Button>
      </div>
    </DialogShell>

    {pinOpen ? (
      <TPinConfirmDialog
        open
        title={t("tPinDialogTitle")}
        busy={pending}
        error={error}
        onClose={() => {
          if (!pending) setPinOpen(false);
        }}
        onConfirm={(pin) => void confirmPurchase(pin)}
      />
    ) : null}
    </>
  );
}

function DeliveryDialog({
  product,
  quantity,
  viewer,
  availablePaisa,
  onClose,
}: {
  product: PurchaseProduct;
  quantity: number;
  viewer: Viewer;
  availablePaisa: bigint;
  onClose: () => void;
}) {
  const t = useTranslations("purchase");
  const tc = useTranslations("common");
  const locale = useLocale();
  const router = useRouter();
  const queryClient = useQueryClient();
  const titleId = useId();
  const requestKey = useRef(crypto.randomUUID());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pinOpen, setPinOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const name = locale === "bn" && product.nameBn ? product.nameBn : product.name;
  const cost = BigInt(product.pricePaisa) * BigInt(quantity);
  const sufficient = hasSufficientBalance(availablePaisa, cost);
  const remaining = remainingBalancePaisa(availablePaisa, cost);

  function requestPin() {
    if (!selectedId || !sufficient) return;
    setError(null);
    setPinOpen(true);
  }

  async function confirmOrder(tPin: string) {
    if (!selectedId) return;
    setPending(true);
    setError(null);
    try {
      const response = await fetch("/api/store/purchases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          flow: "DELIVERY",
          productId: product.id,
          quantity,
          addressId: selectedId,
          tPin,
          idempotencyKey: requestKey.current,
          locale,
        }),
      });
      const data = (await response.json()) as PurchaseResponse & { error?: string };
      if (!response.ok) {
        const message = purchaseErrorMessage(data.error, t, tc);
        setError(message);
        toast.error(message);
        if (data.error === "DUPLICATE_REQUEST") requestKey.current = crypto.randomUUID();
        return;
      }
      setPinOpen(false);
      toast.success(t("deliverySuccess"));
      await queryClient.invalidateQueries({ queryKey: ["viewer"] });
      onClose();
      router.push(`/orders/${data.order.orderNumber}`);
      router.refresh();
    } catch {
      setError(tc("error"));
      toast.error(tc("error"));
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <DialogShell title={t("addressTitle")} intro={t("addressIntro")} titleId={titleId} onClose={onClose}>
        <div className="space-y-5">
        <AddressPicker viewer={viewer} selectedId={selectedId} onSelect={setSelectedId} disabled={pending} />

        <section className="space-y-2">
          <SummaryRow label={t("product")} value={name} />
          <SummaryRow label={tc("quantity")} value={String(quantity)} />
          <SummaryRow label={t("price")} value={formatTaka(cost, locale)} />
          <SummaryRow label={t("spCost")} value={formatSP(cost)} />
          <SummaryRow label={t("availableBalance")} value={formatSP(availablePaisa)} />
          <SummaryRow
            label={t("remainingBalance")}
            value={formatSP(remaining)}
            highlight={sufficient}
            danger={!sufficient}
          />
        </section>

        {!sufficient ? (
          <p
            role="alert"
            className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2.5 text-xs font-semibold text-red-600 dark:text-red-300"
          >
            {t("insufficientBalance")}
          </p>
        ) : null}

        <Button
          type="button"
          onClick={requestPin}
          disabled={pending || !selectedId || !sufficient}
          className="w-full"
        >
          {pending ? t("confirming") : t("confirmPlaceOrder")}
        </Button>
      </div>
      </DialogShell>

      {pinOpen ? (
        <TPinConfirmDialog
          open
          title={t("tPinDialogTitle")}
          busy={pending}
          error={error}
          onClose={() => {
            if (!pending) setPinOpen(false);
          }}
          onConfirm={(pin) => void confirmOrder(pin)}
        />
      ) : null}
    </>
  );
}

export function ProductActions({ product, compact = false }: { product: PurchaseProduct; compact?: boolean }) {
  const tp = useTranslations("product");
  const t = useTranslations("purchase");
  const { data } = useQuery<ViewerResponse>({
    queryKey: ["viewer"],
    queryFn: async () => {
      const response = await fetch("/api/me", { cache: "no-store" });
      if (!response.ok) return { viewer: null, availablePaisa: "0" };
      return response.json() as Promise<ViewerResponse>;
    },
    staleTime: 30_000,
  });

  const viewer = data?.viewer ?? null;
  const status = viewer?.role === "MEMBER" ? viewer.status : null;
  const mode = buyNowMode(status);
  const soldOut = product.stock <= 0;
  const quantity = Math.max(1, Math.min(product.quantity ?? 1, Math.max(product.stock, 1)));
  const availablePaisa = BigInt(data?.availablePaisa ?? "0");
  const cost = BigInt(product.pricePaisa) * BigInt(quantity);
  const [dialog, setDialog] = useState<"activation" | "delivery" | null>(null);
  const [guidanceCost, setGuidanceCost] = useState<bigint | null>(null);

  const showCart = status !== "INACTIVE" && status !== "SUSPENDED";

  function openPurchase() {
    if (
      mode === "activation" &&
      activationGuidanceState(availablePaisa, cost) !== "ready"
    ) {
      setGuidanceCost(cost);
      return;
    }
    setDialog(mode === "activation" ? "activation" : "delivery");
  }

  return (
    <>
      <div className={compact ? "flex flex-col items-stretch gap-2" : "flex flex-wrap items-center gap-2"}>
        {mode !== "hidden" && !soldOut ? (
          <Button
            type="button"
            size={compact ? "sm" : "default"}
            className={compact ? "w-full" : undefined}
            onClick={openPurchase}
          >
            <Store className="size-4" aria-hidden="true" />
            {tp("buyNow")}
          </Button>
        ) : null}
        {showCart ? (
          <AddToCartButton
            productId={product.id}
            quantity={quantity}
            disabled={soldOut}
            compact={compact}
            className={compact ? "w-full" : undefined}
          />
        ) : null}
        {mode === "activation" ? (
          <p className="w-full text-xs text-muted-foreground">{t("activationHint")}</p>
        ) : null}
      </div>

      {dialog === "activation" && viewer ? (
        <ActivationDialog
          product={product}
          quantity={quantity}
          availablePaisa={availablePaisa}
          onClose={() => setDialog(null)}
        />
      ) : null}
      {dialog === "delivery" && viewer ? (
        <DeliveryDialog
          product={product}
          quantity={quantity}
          viewer={viewer}
          availablePaisa={availablePaisa}
          onClose={() => setDialog(null)}
        />
      ) : null}
      <ActivationGuidanceDialog
        open={guidanceCost !== null}
        availablePaisa={availablePaisa}
        requiredPaisa={guidanceCost ?? undefined}
        onClose={() => setGuidanceCost(null)}
      />
    </>
  );
}
