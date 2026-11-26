import { getLocale, getTranslations } from "next-intl/server";
import { ShoppingBag } from "lucide-react";
import { auth } from "@/auth";
import { Link, redirect } from "@/i18n/navigation";
import {
  AdminPageIntro,
  AdminSection,
  AdminTable,
  EmptyState,
  StatusBadge,
  adminStatusKey,
  formatDate,
  statusTone,
} from "@/components/admin/admin-ui";
import {
  CourierTrackingForm,
  OrderStatusForm,
  PickupActionForm,
} from "@/components/admin/action-forms";
import { buttonVariants } from "@/components/ui/button";
import { formatTaka } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

type OrderQuery = {
  proof?: string | string[] | undefined;
  fulfillment?: string | string[] | undefined;
};

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<OrderQuery>;
}) {
  const [session, locale, tn, ta, tc, tpu, query] = await Promise.all([
    auth(),
    getLocale(),
    getTranslations("nav"),
    getTranslations("adminPanel"),
    getTranslations("common"),
    getTranslations("purchase"),
    searchParams,
  ]);
  if (session?.user?.role !== "ADMIN") redirect({ href: "/login", locale });

  const pendingProofOnly = query.proof === "pending";
  const fulfillment =
    query.fulfillment === "OFFICE_PICKUP" || query.fulfillment === "HOME_DELIVERY"
      ? query.fulfillment
      : undefined;

  const orders = await prisma.order.findMany({
    where: {
      ...(pendingProofOnly ? { paymentProofs: { some: { status: "PENDING" } } } : {}),
      ...(fulfillment ? { fulfillmentType: fulfillment } : {}),
    },
    orderBy: { placedAt: "desc" },
    include: {
      member: { select: { fullName: true, email: true } },
      paymentProofs: { orderBy: { submittedAt: "desc" }, select: { status: true } },
    },
  });

  const filterHref = (options: { proof?: string; fulfillment?: string }) => {
    const params = new URLSearchParams();
    if (options.proof) params.set("proof", options.proof);
    if (options.fulfillment) params.set("fulfillment", options.fulfillment);
    const suffix = params.toString();
    return suffix ? `/admin/orders?${suffix}` : "/admin/orders";
  };

  return (
    <div className="space-y-8 animate-rise">
      <AdminPageIntro
        eyebrow={tn("admin")}
        title={ta("ordersTitle")}
        intro={ta("ordersIntro")}
        icon={<ShoppingBag className="size-3.5" aria-hidden="true" />}
      />
      <AdminSection id="orders" title={ta("overview")}>
        <div className="flex flex-wrap gap-2">
          <Link
            href={filterHref({ fulfillment })}
            className={cn(buttonVariants({ variant: pendingProofOnly ? "outline" : "default", size: "sm" }))}
          >
            {ta("showAllRecords")}
          </Link>
          <Link
            href={filterHref({ proof: "pending", fulfillment })}
            className={cn(buttonVariants({ variant: pendingProofOnly ? "default" : "outline", size: "sm" }))}
          >
            {ta("pendingProofFilter")}
          </Link>
          <span className="mx-1 hidden w-px bg-border sm:block" aria-hidden="true" />
          <Link
            href={filterHref({ proof: pendingProofOnly ? "pending" : undefined })}
            className={cn(buttonVariants({ variant: !fulfillment ? "default" : "outline", size: "sm" }))}
          >
            {ta("allFulfillment")}
          </Link>
          <Link
            href={filterHref({ fulfillment: "OFFICE_PICKUP", proof: pendingProofOnly ? "pending" : undefined })}
            className={cn(
              buttonVariants({
                variant: fulfillment === "OFFICE_PICKUP" ? "default" : "outline",
                size: "sm",
              }),
            )}
          >
            {tpu("fulfillmentOfficePickup")}
          </Link>
          <Link
            href={filterHref({ fulfillment: "HOME_DELIVERY", proof: pendingProofOnly ? "pending" : undefined })}
            className={cn(
              buttonVariants({
                variant: fulfillment === "HOME_DELIVERY" ? "default" : "outline",
                size: "sm",
              }),
            )}
          >
            {tpu("fulfillmentHomeDelivery")}
          </Link>
        </div>

        {orders.length === 0 ? (
          <EmptyState message={pendingProofOnly ? ta("noProofMatches") : ta("noOrders")} />
        ) : (
          <AdminTable
            caption={ta("ordersTitle")}
            headers={[
              ta("orderNumber"),
              ta("member"),
              tpu("fulfillment"),
              tc("status"),
              ta("proof"),
              tc("amount"),
              tc("date"),
              ta("statusLabel"),
            ]}
          >
            {orders.map((order) => {
              const proof = order.paymentProofs[0];
              const isPickup = order.fulfillmentType === "OFFICE_PICKUP";
              const displayStatus = isPickup && order.pickupStatus ? order.pickupStatus : order.status;
              return (
                <tr key={order.id} className="align-top">
                  <td className="whitespace-nowrap px-4 py-3 font-mono text-xs">
                    <Link
                      href={`/orders/${order.orderNumber}`}
                      className="font-semibold text-primary hover:underline focus-visible:rounded focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {order.orderNumber}
                    </Link>
                  </td>
                  <td className="min-w-[160px] px-4 py-3">
                    <span className="block font-semibold">{order.member.fullName}</span>
                    <span className="block break-all text-xs text-muted-foreground">
                      {order.member.email}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge
                      tone={isPickup ? "warning" : "neutral"}
                      label={tpu(isPickup ? "fulfillmentOfficePickup" : "fulfillmentHomeDelivery")}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge
                      tone={statusTone(displayStatus)}
                      label={ta(adminStatusKey(displayStatus))}
                    />
                  </td>
                  <td className="px-4 py-3">
                    {proof ? (
                      <StatusBadge
                        tone={statusTone(proof.status)}
                        label={ta(adminStatusKey(proof.status))}
                      />
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 font-semibold tabular-nums">
                    {formatTaka(order.totalPaisa, locale)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground">
                    {formatDate(order.placedAt, locale)}
                  </td>
                  <td className="px-4 py-3">
                    {isPickup ? (
                      <PickupActionForm orderId={order.id} pickupStatus={order.pickupStatus} />
                    ) : (
                      <div className="flex flex-col gap-3">
                        <OrderStatusForm orderId={order.id} status={order.status} />
                        <CourierTrackingForm
                          orderId={order.id}
                          courierName={order.courierName}
                          trackingNumber={order.trackingNumber}
                          trackingUrl={order.trackingUrl}
                        />
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </AdminTable>
        )}
      </AdminSection>
    </div>
  );
}
