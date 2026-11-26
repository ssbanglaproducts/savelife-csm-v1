import { getTranslations, setRequestLocale } from "next-intl/server";
import { ArrowUpRight, Package, ShoppingBag } from "lucide-react";
import { auth } from "@/auth";
import { PageHeader } from "@/components/member/page-header";
import { formatMemberDate } from "@/components/member/format-date";
import { orderStatusKey } from "@/components/member/status-labels";
import { ProductThumb } from "@/components/store/product-thumb";
import {
  OrderFilterTabs,
  type OrderFulfillmentFilter,
} from "@/components/store/order-filter-tabs";
import { buttonVariants } from "@/components/ui/button";
import { Link, redirect } from "@/i18n/navigation";
import { formatTaka } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

function parseFilter(value: string | string[] | undefined): OrderFulfillmentFilter {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw === "pickup" || raw === "delivery" ? raw : "all";
}

export default async function OrdersPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const [query, session, tm, tn, tCheckout, tpu, tc, tcat] = await Promise.all([
    searchParams,
    auth(),
    getTranslations("memberPanel"),
    getTranslations("nav"),
    getTranslations("checkout"),
    getTranslations("purchase"),
    getTranslations("common"),
    getTranslations("catalogue"),
  ]);
  if (!session?.user?.id) {
    redirect({ href: "/login", locale });
    return null;
  }

  const filter = parseFilter(query.fulfillment);
  const fulfillmentType =
    filter === "pickup" ? "OFFICE_PICKUP" : filter === "delivery" ? "HOME_DELIVERY" : undefined;

  const orders = await prisma.order.findMany({
    where: {
      memberId: session.user.id,
      ...(fulfillmentType ? { fulfillmentType } : {}),
    },
    orderBy: { placedAt: "desc" },
    select: {
      id: true,
      orderNumber: true,
      placedAt: true,
      status: true,
      fulfillmentType: true,
      pickupStatus: true,
      courierName: true,
      trackingNumber: true,
      trackingUrl: true,
      totalPaisa: true,
      items: {
        select: { id: true, productName: true, productImage: true, quantity: true },
      },
    },
  });

  return (
    <div className="space-y-8 animate-rise">
      <PageHeader
        eyebrow={tn("orders")}
        title={tm("ordersTitle")}
        intro={tm("ordersIntro")}
        icon={<ShoppingBag className="size-3.5" aria-hidden="true" />}
      />

      <OrderFilterTabs active={filter} />

      <section className="glass min-w-0 rounded-3xl p-5 sm:p-8" aria-labelledby="orders-heading">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="orders-heading" className="font-display text-xl font-bold tracking-tight">
            {tm("ordersTitle")}
          </h2>
          <p className="text-xs font-semibold text-muted-foreground">
            {orders.length} {tcat("results")}
          </p>
        </div>

        {orders.length === 0 ? (
          <p className="mt-6 rounded-2xl border border-border bg-[var(--glass)] px-4 py-10 text-center text-sm text-muted-foreground">
            {tm("noOrders")}
          </p>
        ) : (
          <ul className="mt-6 space-y-4">
            {orders.map((order) => {
              const isPickup = order.fulfillmentType === "OFFICE_PICKUP";
              const itemCount = order.items.reduce((sum, item) => sum + item.quantity, 0);
              const statusLabel = isPickup
                ? tm(order.pickupStatus === "PICKED_UP" ? "pickedUp" : "pickupPending")
                : tm(orderStatusKey(order.status));

              return (
                <li
                  key={order.id}
                  className="grid gap-4 rounded-2xl border border-border bg-[var(--card-solid)] p-4 sm:grid-cols-[auto_1fr_auto] sm:items-start"
                >
                  <div className="flex items-center gap-2 sm:block">
                    <div className="flex -space-x-3">
                      {order.items.slice(0, 2).map((item) => (
                        <ProductThumb
                          key={item.id}
                          src={item.productImage}
                          alt={item.productName}
                          className={cn(
                            "size-14 rounded-xl ring-2 ring-[var(--card-solid)]",
                            order.items.length > 1 && "size-12",
                          )}
                          sizes="56px"
                        />
                      ))}
                    </div>
                    <span className="ml-2 text-xs text-muted-foreground sm:hidden">
                      {itemCount} {tc("quantity")}
                    </span>
                  </div>

                  <div className="min-w-0">
                    <p className="truncate font-display font-bold text-primary" translate="no">
                      {order.orderNumber}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {tm("placedAt")}: {formatMemberDate(order.placedAt, locale, true)}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {tCheckout("orderItems")}: {itemCount}
                    </p>
                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                      {order.items.map((item) => item.productName).join(" · ")}
                    </p>
                    <p
                      className={cn(
                        "mt-2 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold",
                        isPickup ? "bg-amber-500/10 text-amber-700 dark:text-amber-300" : "bg-primary/10 text-primary",
                      )}
                    >
                      <Package className="size-3" aria-hidden="true" />
                      {tpu(isPickup ? "fulfillmentOfficePickup" : "fulfillmentHomeDelivery")}
                    </p>
                    {isPickup ? (
                      <p className="mt-1 text-[11px] text-muted-foreground">{tm("pickupNotice")}</p>
                    ) : null}
                    {!isPickup && (order.courierName || order.trackingNumber) ? (
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        {order.courierName ? `${tm("courier")}: ${order.courierName}` : null}
                        {order.courierName && order.trackingNumber ? " · " : null}
                        {order.trackingNumber ? (
                          <>
                            {tm("trackingNumber")}:{" "}
                            {order.trackingUrl ? (
                              <a
                                href={order.trackingUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="font-semibold text-primary hover:underline focus-visible:rounded focus-visible:ring-2 focus-visible:ring-ring"
                                translate="no"
                              >
                                {order.trackingNumber}
                              </a>
                            ) : (
                              <span translate="no">{order.trackingNumber}</span>
                            )}
                          </>
                        ) : null}
                      </p>
                    ) : null}
                  </div>

                  <div className="flex items-end justify-between gap-4 sm:flex-col sm:items-end">
                    <div className="text-right">
                      <p className="font-display font-bold tabular-nums">
                        {formatTaka(order.totalPaisa, locale)}
                      </p>
                      <span className="glass mt-2 inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold text-primary">
                        {statusLabel}
                      </span>
                    </div>
                    <Link
                      href={`/orders/${order.orderNumber}`}
                      className={cn(buttonVariants({ variant: "outline", size: "sm" }), "min-h-11")}
                    >
                      {tm("viewDetails")}
                      <ArrowUpRight className="size-3.5" aria-hidden="true" />
                    </Link>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
