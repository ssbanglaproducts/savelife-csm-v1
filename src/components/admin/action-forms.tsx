"use client";

import { useId, useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { adminInputClass, adminStatusKey } from "./admin-ui";
import { useCloseAdminActionDialog } from "./admin-action-dialog-button";
import { useAdminAction } from "./use-admin-action";

const orderStatuses = [
  "PENDING",
  "CONFIRMED",
  "PROCESSING",
  "SHIPPED",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
  "CANCELLED",
  "RETURNED",
] as const;

/** Pickup orders have one terminal action; no delivery transitions are offered. */
export function PickupActionForm({
  orderId,
  pickupStatus,
}: {
  orderId: string;
  pickupStatus: string | null;
}) {
  const t = useTranslations("adminPanel");
  const { pending, run } = useAdminAction();
  const closeDialog = useCloseAdminActionDialog();

  async function markPickedUp() {
    if (await run("/api/admin/orders", "PATCH", { orderId, status: "PICKED_UP" })) {
      closeDialog();
    }
  }

  if (pickupStatus === "PICKED_UP") {
    return <span className="text-xs font-semibold text-muted-foreground">{t("pickedUpNote")}</span>;
  }

  return (
    <Button
      type="button"
      disabled={pending}
      onClick={() => void markPickedUp()}
    >
      {pending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
      {t("markPickedUp")}
    </Button>
  );
}

/** Courier fields are delivery-only and never shown for pickup orders. */
export function CourierTrackingForm({
  orderId,
  courierName,
  trackingNumber,
  trackingUrl,
}: {
  orderId: string;
  courierName: string | null;
  trackingNumber: string | null;
  trackingUrl: string | null;
}) {
  const t = useTranslations("adminPanel");
  const fieldId = useId();
  const { pending, run } = useAdminAction();
  const closeDialog = useCloseAdminActionDialog();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const ok = await run("/api/admin/orders", "PATCH", {
      orderId,
      courierName: String(data.get("courierName") ?? "") || null,
      trackingNumber: String(data.get("trackingNumber") ?? "") || null,
      trackingUrl: String(data.get("trackingUrl") ?? "") || null,
    });
    if (ok) closeDialog();
  }

  return (
    <form onSubmit={handleSubmit} className="flex min-w-[220px] flex-col gap-2">
      <span className="text-xs font-bold">{t("courierTitle")}</span>
      <label htmlFor={`${fieldId}-courier`} className="sr-only">{t("courierName")}</label>
      <input
        id={`${fieldId}-courier`}
        name="courierName"
        defaultValue={courierName ?? ""}
        maxLength={80}
        placeholder={t("courierName")}
        className={adminInputClass}
      />
      <label htmlFor={`${fieldId}-tracking`} className="sr-only">{t("trackingNumber")}</label>
      <input
        id={`${fieldId}-tracking`}
        name="trackingNumber"
        defaultValue={trackingNumber ?? ""}
        maxLength={80}
        placeholder={t("trackingNumber")}
        className={adminInputClass}
      />
      <label htmlFor={`${fieldId}-url`} className="sr-only">{t("trackingUrl")}</label>
      <input
        id={`${fieldId}-url`}
        name="trackingUrl"
        type="url"
        defaultValue={trackingUrl ?? ""}
        maxLength={500}
        placeholder={t("trackingUrl")}
        className={adminInputClass}
      />
      <Button type="submit" variant="outline" disabled={pending}>
        {pending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
        {t("saveTracking")}
      </Button>
    </form>
  );
}

export function OrderStatusForm({ orderId, status }: { orderId: string; status: string }) {
  const t = useTranslations("adminPanel");
  const fieldId = useId();
  const { pending, run } = useAdminAction();
  const closeDialog = useCloseAdminActionDialog();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const ok = await run("/api/admin/orders", "PATCH", {
      orderId,
      status: String(new FormData(form).get("status") ?? ""),
      note: String(new FormData(form).get("note") ?? ""),
    });
    if (ok) closeDialog();
  }

  return (
    <form onSubmit={handleSubmit} className="flex min-w-[220px] flex-col gap-2">
      <label htmlFor={`${fieldId}-status`} className="sr-only">
        {t("statusLabel")}
      </label>
      <select
        id={`${fieldId}-status`}
        name="status"
        defaultValue={status}
        className={adminInputClass}
        required
      >
        {orderStatuses.map((option) => (
          <option key={option} value={option}>
            {t(adminStatusKey(option))}
          </option>
        ))}
      </select>
      <label htmlFor={`${fieldId}-note`} className="sr-only">
        {t("note")}
      </label>
      <input
        id={`${fieldId}-note`}
        name="note"
        className={adminInputClass}
        maxLength={300}
        placeholder={t("note")}
      />
      <Button type="submit" disabled={pending}>
        {pending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
        {t("update")}
      </Button>
    </form>
  );
}

export function PaymentReviewForm({ proofId }: { proofId: string }) {
  const t = useTranslations("adminPanel");
  const fieldId = useId();
  const { pending, run } = useAdminAction();
  const closeDialog = useCloseAdminActionDialog();
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Approval is always an explicit button press; Enter in the note is inert.
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
  }

  async function review(action: "APPROVE" | "REJECT") {
    setError(null);
    const ok = await run(
      "/api/admin/payments",
      "PATCH",
      { proofId, action, note },
      undefined,
      setError,
    );
    if (ok) closeDialog();
  }

  return (
    <form onSubmit={handleSubmit} className="min-w-[210px] space-y-2">
      <label htmlFor={`${fieldId}-note`} className="sr-only">
        {t("note")}
      </label>
      <input
        id={`${fieldId}-note`}
        name="note"
        className={adminInputClass}
        maxLength={300}
        placeholder={t("note")}
        value={note}
        onChange={(event) => setNote(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") event.preventDefault();
        }}
      />
      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={() => void review("APPROVE")} disabled={pending}>
          {t("approve")}
        </Button>
        <Button
          type="button"
          onClick={() => void review("REJECT")}
          variant="outline"
          disabled={pending}
        >
          {t("reject")}
        </Button>
      </div>
      {error ? (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </form>
  );
}

export function WithdrawalReviewForm({
  withdrawalId,
  actions,
}: {
  withdrawalId: string;
  actions: Array<"APPROVE" | "REJECT" | "PAID">;
}) {
  const t = useTranslations("adminPanel");
  const fieldId = useId();
  const { pending, run } = useAdminAction();
  const closeDialog = useCloseAdminActionDialog();
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  const labels: Record<(typeof actions)[number], string> = {
    APPROVE: t("approve"),
    REJECT: t("reject"),
    PAID: t("markPaid"),
  };

  // Approval is always an explicit button press; Enter in the note is inert.
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
  }

  async function review(action: (typeof actions)[number]) {
    setError(null);
    const ok = await run(
      "/api/admin/withdrawals",
      "PATCH",
      {
        withdrawalId,
        action,
        note,
      },
      undefined,
      setError,
    );
    if (ok) closeDialog();
  }

  if (actions.length === 0) {
    return <p className="text-xs text-muted-foreground">{t("invalidState")}</p>;
  }

  return (
    <form onSubmit={handleSubmit} className="min-w-[200px] space-y-2">
      <label htmlFor={`${fieldId}-note`} className="sr-only">
        {t("note")}
      </label>
      <input
        id={`${fieldId}-note`}
        name="note"
        className={adminInputClass}
        maxLength={300}
        placeholder={t("note")}
        value={note}
        onChange={(event) => setNote(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") event.preventDefault();
        }}
      />
      <div className="flex flex-wrap gap-2">
        {actions.map((action) => (
          <Button
            key={action}
            type="button"
            onClick={() => void review(action)}
            variant={action === "APPROVE" || action === "PAID" ? "default" : "outline"}
            disabled={pending}
          >
            {pending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
            {labels[action]}
          </Button>
        ))}
      </div>
      {error ? (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </form>
  );
}

export function InvestmentRejectForm({ investmentId }: { investmentId: string }) {
  const t = useTranslations("adminPanel");
  const { pending, run } = useAdminAction();
  const closeDialog = useCloseAdminActionDialog();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const ok = await run("/api/admin/investments", "POST", {
      action: "REJECT",
      investmentId,
    });
    if (ok) closeDialog();
  }

  return (
    <form onSubmit={handleSubmit}>
      <Button type="submit" variant="outline" disabled={pending}>
        {pending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
        {t("reject")}
      </Button>
    </form>
  );
}

export function ReverseInstallmentForm({ installmentId }: { installmentId: string }) {
  const t = useTranslations("adminPanel");
  const { pending, run } = useAdminAction();
  const closeDialog = useCloseAdminActionDialog();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const ok = await run("/api/admin/investments", "POST", {
      action: "REVERSE_INSTALLMENT",
      installmentId,
    });
    if (ok) closeDialog();
  }

  return (
    <form onSubmit={handleSubmit} className="inline-flex">
      <Button
        type="submit"
        variant="outline"
        size="sm"
        disabled={pending}
        aria-label={`${t("reverseInstallment")} — ${t("installmentId")} ${installmentId}`}
      >
        {pending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
        {t("reverseInstallment")}
      </Button>
    </form>
  );
}
