"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import {
  AdminRecordCard,
  AdminRecordField,
  StatusBadge,
  adminStatusKey,
  formatDate,
  statusTone,
} from "@/components/admin/admin-ui";
import { AdminActionDialogButton } from "@/components/admin/admin-action-dialog-button";
import {
  CourierTrackingForm,
  OrderStatusForm,
  PickupActionForm,
} from "@/components/admin/action-forms";
import { buttonVariants } from "@/components/ui/button";
import { formatTaka } from "@/lib/money";
import { cn } from "@/lib/utils";

export type OrderRecord = {
  id: string;
  orderNumber: string;
  memberName: string;
  memberEmail: string;
  fulfillmentType: string;
  pickupStatus: string | null;
  status: string;
  proofStatus: string | null;
  totalPaisa: string;
  placedAt: string;
  courierName: string | null;
  trackingNumber: string | null;
  trackingUrl: string | null;
};

export function OrderRecords({ rows, locale }: { rows: OrderRecord[]; locale: string }) {
  const t = useTranslations("adminPanel");
  const tc = useTranslations("common");
  const tp = useTranslations("purchase");

  return (
    <div className="grid gap-3">
      {rows.map((order) => {
        const isPickup = order.fulfillmentType === "OFFICE_PICKUP";
        const displayStatus = isPickup && order.pickupStatus ? order.pickupStatus : order.status;
        const placedAt = new Date(order.placedAt);

        return (
          <AdminRecordCard
            key={order.id}
            title={order.orderNumber}
            subtitle={`${order.memberName} · ${formatDate(placedAt, locale)}`}
            status={
              <StatusBadge
                tone={statusTone(displayStatus)}
                label={t(adminStatusKey(displayStatus))}
              />
            }
          >
            <AdminRecordField
              label={tp("fulfillment")}
              value={tp(isPickup ? "fulfillmentOfficePickup" : "fulfillmentHomeDelivery")}
            />
            <AdminRecordField
              label={t("proof")}
              value={
                order.proofStatus ? (
                  <StatusBadge
                    tone={statusTone(order.proofStatus)}
                    label={t(adminStatusKey(order.proofStatus))}
                  />
                ) : (
                  "—"
                )
              }
            />
            <AdminRecordField
              label={tc("amount")}
              value={formatTaka(BigInt(order.totalPaisa), locale)}
            />
            <AdminRecordField label={t("email")} value={order.memberEmail} wide />
            <div className="col-span-2 flex flex-wrap gap-2">
              <Link
                href={`/orders/${order.orderNumber}`}
                className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "min-h-10")}
              >
                {tc("view")}
              </Link>
              {isPickup ? (
                order.pickupStatus !== "PICKED_UP" ? (
                  <AdminActionDialogButton
                    label={t("markPickedUp")}
                    title={t("markPickedUp")}
                    intro={t("pickedUpNote")}
                  >
                    <PickupActionForm
                      orderId={order.id}
                      pickupStatus={order.pickupStatus}
                    />
                  </AdminActionDialogButton>
                ) : (
                  <span className="self-center text-xs font-semibold text-muted-foreground">
                    {t("pickedUpNote")}
                  </span>
                )
              ) : (
                <AdminActionDialogButton
                  label={t("manage")}
                  title={`${t("ordersTitle")} · ${order.orderNumber}`}
                  intro={t("courierTitle")}
                  className="flex-1"
                >
                  <div className="space-y-6">
                    <div>
                      <p className="mb-2 text-xs font-bold text-muted-foreground">
                        {t("statusLabel")}
                      </p>
                      <OrderStatusForm orderId={order.id} status={order.status} />
                    </div>
                    <div className="border-t border-border pt-4">
                      <CourierTrackingForm
                        orderId={order.id}
                        courierName={order.courierName}
                        trackingNumber={order.trackingNumber}
                        trackingUrl={order.trackingUrl}
                      />
                    </div>
                  </div>
                </AdminActionDialogButton>
              )}
            </div>
          </AdminRecordCard>
        );
      })}
    </div>
  );
}
