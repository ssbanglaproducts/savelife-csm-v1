import { getLocale, getTranslations } from "next-intl/server";
import { Search, ShoppingBag, SlidersHorizontal, X } from "lucide-react";
import type { Prisma } from "@/generated/prisma/client";
import { getAdminAccess, hasAdminPermission } from "@/lib/admin-access";
import { Link, redirect } from "@/i18n/navigation";
import {
  AdminPageIntro,
  AdminSection,
  AdminTable,
  EmptyState,
  StatusBadge,
  adminInputClass,
  adminStatusKey,
  formatDate,
  statusTone,
} from "@/components/admin/admin-ui";
import {
  CourierTrackingForm,
  OrderStatusForm,
  PickupActionForm,
} from "@/components/admin/action-forms";
import { AdminActionDialogButton } from "@/components/admin/admin-action-dialog-button";
import { OrderRecords, type OrderRecord } from "@/components/admin/order-records";
import { Button, buttonVariants } from "@/components/ui/button";
import { formatTaka } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

type OrderQuery = {
  q?: string | string[] | undefined;
  proof?: string | string[] | undefined;
  fulfillment?: string | string[] | undefined;
  status?: string | string[] | undefined;
};

type FilterKey = keyof OrderQuery;
type FilterValues = Record<FilterKey, string | undefined>;

const ORDER_STATUSES = [
  "PENDING",
  "CONFIRMED",
  "PROCESSING",
  "SHIPPED",
  "OUT_FOR_DELIVERY",
  "PICKED_UP",
  "DELIVERED",
  "CANCELLED",
  "RETURNED",
] as const;

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<OrderQuery>;
}) {
  const [session, locale, tn, ta, tc, tpu, query] = await Promise.all([
    getAdminAccess(),
    getLocale(),
    getTranslations("nav"),
    getTranslations("adminPanel"),
    getTranslations("common"),
    getTranslations("purchase"),
    searchParams,
  ]);
  if (!session || !hasAdminPermission(session, "orders.view")) redirect({ href: "/admin-login", locale });

  const search = (firstValue(query.q) ?? "").trim().slice(0, 120);
  const pendingProofOnly = firstValue(query.proof) === "pending";
  const fulfillmentValue = firstValue(query.fulfillment);
  const fulfillment =
    fulfillmentValue === "OFFICE_PICKUP" || fulfillmentValue === "HOME_DELIVERY"
      ? fulfillmentValue
      : undefined;
  const statusValue = firstValue(query.status);
  const status = ORDER_STATUSES.find((value) => value === statusValue);

  const where: Prisma.OrderWhereInput = {
    ...(pendingProofOnly ? { paymentProofs: { some: { status: "PENDING" } } } : {}),
    ...(fulfillment ? { fulfillmentType: fulfillment } : {}),
    ...(status ? { status } : {}),
    ...(search
      ? {
          OR: [
            { orderNumber: { contains: search, mode: "insensitive" } },
            { trackingNumber: { contains: search, mode: "insensitive" } },
            { courierName: { contains: search, mode: "insensitive" } },
            {
              member: {
                is: {
                  OR: [
                    { fullName: { contains: search, mode: "insensitive" } },
                    { email: { contains: search, mode: "insensitive" } },
                    { memberId: { contains: search, mode: "insensitive" } },
                  ],
                },
              },
            },
            { paymentProofs: { some: { transactionRef: { contains: search, mode: "insensitive" } } } },
            { items: { some: { productName: { contains: search, mode: "insensitive" } } } },
          ],
        }
      : {}),
  };

  const orders = await prisma.order.findMany({
    where,
    orderBy: { placedAt: "desc" },
    include: {
      member: { select: { fullName: true, email: true } },
      paymentProofs: { orderBy: { submittedAt: "desc" }, select: { status: true } },
    },
  });

  const currentFilters: FilterValues = {
    q: search || undefined,
    proof: pendingProofOnly ? "pending" : undefined,
    fulfillment,
    status,
  };

  const filterHref = (overrides: Partial<FilterValues> = {}) => {
    const next = { ...currentFilters, ...overrides };
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(next)) {
      if (value) params.set(key, value);
    }
    const suffix = params.toString();
    return suffix ? `/admin/orders?${suffix}` : "/admin/orders";
  };

  const activeFilterCount =
    (search ? 1 : 0) + (pendingProofOnly ? 1 : 0) + (fulfillment ? 1 : 0) + (status ? 1 : 0);

  const activeChips: { key: FilterKey; label: string; mono?: boolean }[] = [];
  if (search) activeChips.push({ key: "q", label: `${tc("search")}: ${search}` });
  if (pendingProofOnly) activeChips.push({ key: "proof", label: ta("pendingProofFilter") });
  if (fulfillment) {
    activeChips.push({
      key: "fulfillment",
      label: tpu(fulfillment === "OFFICE_PICKUP" ? "fulfillmentOfficePickup" : "fulfillmentHomeDelivery"),
    });
  }
  if (status) activeChips.push({ key: "status", label: ta(adminStatusKey(status)), mono: true });

  const mobileRows: OrderRecord[] = orders.map((order) => ({
    id: order.id,
    orderNumber: order.orderNumber,
    memberName: order.member.fullName,
    memberEmail: order.member.email,
    fulfillmentType: order.fulfillmentType,
    pickupStatus: order.pickupStatus,
    status: order.status,
    proofStatus: order.paymentProofs[0]?.status ?? null,
    totalPaisa: order.totalPaisa.toString(),
    placedAt: order.placedAt.toISOString(),
    courierName: order.courierName,
    trackingNumber: order.trackingNumber,
    trackingUrl: order.trackingUrl,
  }));

  return (
    <div className="space-y-8 animate-rise">
      <AdminPageIntro
        eyebrow={tn("admin")}
        title={ta("ordersTitle")}
        intro={ta("ordersIntro")}
        icon={<ShoppingBag className="size-3.5" aria-hidden="true" />}
      />
      <AdminSection id="orders" title={ta("overview")}>
        <form method="get" className="glass rounded-xl p-2">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <label className="relative min-w-0 flex-1">
              <span className="sr-only">{ta("orderSearchPlaceholder")}</span>
              <Search
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <input
                type="search"
                name="q"
                defaultValue={search}
                placeholder={ta("orderSearchPlaceholder")}
                className={cn(adminInputClass, "pl-10")}
              />
            </label>

            <details className="relative shrink-0">
              <summary
                className={cn(
                  "inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-xl border border-border bg-[var(--glass)] px-4 text-sm font-semibold transition-colors hover:border-primary/50 hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  "[&::-webkit-details-marker]:hidden list-none",
                )}
              >
                <SlidersHorizontal className="size-4" aria-hidden="true" />
                {tc("filter")}
                {activeFilterCount > 0 ? (
                  <span className="grid size-5 place-items-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                    {activeFilterCount}
                  </span>
                ) : null}
              </summary>
              <div className="absolute right-0 z-20 mt-2 w-[min(20rem,calc(100vw-2rem))] rounded-xl border border-border bg-[var(--glass-strong)] p-3 shadow-xl backdrop-blur-xl">
                <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  {ta("proof")}
                  <select
                    name="proof"
                    defaultValue={pendingProofOnly ? "pending" : ""}
                    className={cn(adminInputClass, "mt-1 h-9 text-xs normal-case tracking-normal")}
                  >
                    <option value="">{ta("showAllRecords")}</option>
                    <option value="pending">{ta("pendingProofFilter")}</option>
                  </select>
                </label>

                <label className="mt-3 block text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  {tpu("fulfillment")}
                  <select
                    name="fulfillment"
                    defaultValue={fulfillment ?? ""}
                    className={cn(adminInputClass, "mt-1 h-9 text-xs normal-case tracking-normal")}
                  >
                    <option value="">{ta("allFulfillment")}</option>
                    <option value="OFFICE_PICKUP">{tpu("fulfillmentOfficePickup")}</option>
                    <option value="HOME_DELIVERY">{tpu("fulfillmentHomeDelivery")}</option>
                  </select>
                </label>

                <label className="mt-3 block text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  {ta("orderStatusFilter")}
                  <select
                    name="status"
                    defaultValue={status ?? ""}
                    className={cn(adminInputClass, "mt-1 h-9 text-xs normal-case tracking-normal")}
                  >
                    <option value="">{ta("showAllRecords")}</option>
                    {ORDER_STATUSES.map((value) => (
                      <option key={value} value={value}>
                        {ta(adminStatusKey(value))}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="mt-3 flex justify-end gap-2">
                  <Link
                    href="/admin/orders"
                    className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
                  >
                    {ta("filterReset")}
                  </Link>
                  <Button type="submit" size="sm">
                    {ta("filterApply")}
                  </Button>
                </div>
              </div>
            </details>
          </div>
        </form>

        {activeChips.length > 0 ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              {ta("activeFilters")}
            </span>
            {activeChips.map((chip) => (
              <Link
                key={chip.key}
                href={filterHref({ [chip.key]: undefined } as Partial<FilterValues>)}
                className={cn(
                  "inline-flex items-center gap-1 rounded-full bg-accent px-2.5 py-1 text-xs font-semibold text-foreground transition-colors hover:bg-primary/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  chip.mono && "font-mono",
                )}
              >
                {chip.label}
                <X className="size-3" aria-hidden="true" />
              </Link>
            ))}
            <Link
              href="/admin/orders"
              className="text-xs font-semibold text-primary hover:underline focus-visible:rounded focus-visible:ring-2 focus-visible:ring-ring"
            >
              {ta("clearAllFilters")}
            </Link>
          </div>
        ) : null}

        {orders.length === 0 ? (
          <EmptyState message={activeFilterCount > 0 ? tc("noResults") : ta("noOrders")} />
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
            mobile={<OrderRecords rows={mobileRows} locale={locale} />}
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
                      order.pickupStatus === "PICKED_UP" ? (
                        <span className="text-xs font-semibold text-muted-foreground">
                          {ta("pickedUpNote")}
                        </span>
                      ) : (
                        <AdminActionDialogButton
                          label={ta("markPickedUp")}
                          title={ta("markPickedUp")}
                          intro={ta("pickedUpNote")}
                        >
                          <PickupActionForm
                            orderId={order.id}
                            pickupStatus={order.pickupStatus}
                          />
                        </AdminActionDialogButton>
                      )
                    ) : (
                      <AdminActionDialogButton
                        label={ta("manage")}
                        title={`${ta("ordersTitle")} · ${order.orderNumber}`}
                        intro={ta("courierTitle")}
                      >
                        <div className="space-y-6">
                          <div>
                            <p className="mb-2 text-xs font-bold text-muted-foreground">
                              {ta("statusLabel")}
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
