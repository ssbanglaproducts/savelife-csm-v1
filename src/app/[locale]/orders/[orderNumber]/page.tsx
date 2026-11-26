import type { ReactNode } from "react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { CheckCircle2, FileText, Package, SearchX } from "lucide-react";
import { auth } from "@/auth";
import { PaymentReviewForm } from "@/components/admin/action-forms";
import { Header } from "@/components/layout/header";
import { SiteFooter } from "@/components/layout/site-footer";
import { StoreBottomNav } from "@/components/layout/store-bottom-nav";
import { MemberAccessNotice } from "@/components/member/member-access-notice";
import { OrderTracking } from "@/components/member/order-tracking";
import { orderStatusKey } from "@/components/member/status-labels";
import { ProductThumb } from "@/components/store/product-thumb";
import { buttonVariants } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { formatSP, formatTaka } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ locale: string; orderNumber: string }>;
}) {
  const { locale, orderNumber } = await params;
  setRequestLocale(locale);

  const [t, tc, tn, ta, tm, tpu, session] = await Promise.all([
    getTranslations("checkout"),
    getTranslations("common"),
    getTranslations("nav"),
    getTranslations("adminPanel"),
    getTranslations("memberPanel"),
    getTranslations("purchase"),
    auth(),
  ]);

  function formatDate(value: Date) {
    return new Intl.DateTimeFormat(locale === "bn" ? "bn-BD" : "en-BD", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(value);
  }

  const isAdmin = session?.user.role === "ADMIN";

  const shell = (children: ReactNode) => (
    <>
      <Header />
      <main id="main-content" tabIndex={-1} className="mx-auto w-full max-w-4xl flex-1 px-4 pb-28 pt-8 sm:px-6 sm:pt-12 md:pb-12 lg:px-10">
        {children}
      </main>
      <SiteFooter />
      {!isAdmin ? <StoreBottomNav /> : null}
    </>
  );

  if (!session?.user) {
    return shell(
      <section className="glass flex flex-col items-center rounded-3xl px-6 py-16 text-center">
        <span className="flex size-16 items-center justify-center rounded-2xl bg-primary/15 text-primary">
          <FileText className="size-7" aria-hidden="true" />
        </span>
        <h1 className="mt-5 font-display text-2xl font-bold">{t("notLoggedIn")}</h1>
        <Link href="/login" className={cn(buttonVariants(), "mt-6")}>
          {tn("login")}
        </Link>
      </section>,
    );
  }

  if (!isAdmin) {
    const member = await prisma.member.findUnique({
      where: { id: session.user.id },
      select: {
        status: true,
        deactivationNote: true,
        wallet: { select: { availablePaisa: true } },
      },
    });
    if (member && member.status !== "ACTIVE") {
      return shell(
        <MemberAccessNotice
          status={member.status === "SUSPENDED" ? "SUSPENDED" : "INACTIVE"}
          note={member.deactivationNote}
          availablePaisa={member.wallet?.availablePaisa.toString() ?? "0"}
        />,
      );
    }
  }

  const order = await prisma.order.findFirst({
    where: {
      orderNumber,
      ...(isAdmin ? {} : { memberId: session.user.id }),
    },
    include: {
      items: true,
      statusHistory: { orderBy: { createdAt: "asc" } },
      paymentProofs: { orderBy: { submittedAt: "desc" } },
    },
  });

  if (!order) {
    return shell(
      <section className="glass flex flex-col items-center rounded-3xl px-6 py-16 text-center">
        <span className="flex size-16 items-center justify-center rounded-2xl bg-red-500/10 text-red-500">
          <SearchX className="size-7" aria-hidden="true" />
        </span>
        <h1 className="mt-5 font-display text-2xl font-bold">{t("orderNotFound")}</h1>
        <p className="mt-2 max-w-md text-sm text-muted-foreground">{t("orderNotFoundBody")}</p>
        <Link href="/member/orders" className={cn(buttonVariants(), "mt-6")}>
          {t("viewOrders")}
        </Link>
      </section>,
    );
  }

  const isPickup = order.fulfillmentType === "OFFICE_PICKUP";
  const snapshot = order.addressSnapshot as
    | {
        label?: string | null;
        fullName?: string | null;
        phone?: string | null;
        street?: string | null;
        thana?: string | null;
        district?: string | null;
        postalCode?: string | null;
      }
    | null;

  return shell(
    <div className="space-y-6 animate-rise">
      <section className="mesh glass relative overflow-hidden rounded-3xl p-6 sm:p-8">
        <div className="pointer-events-none absolute -right-20 -top-24 size-64 rounded-full bg-primary/10 blur-3xl" aria-hidden="true" />
        <div className="relative">
          <div className="flex items-center gap-2 text-xs font-bold tracking-[0.12em] text-primary">
            <CheckCircle2 className="size-3.5" aria-hidden="true" />
            {t("orderCreated")}
          </div>
          <h1 className="mt-3 font-display text-3xl font-bold tracking-tight sm:text-4xl">{t("orderTitle")}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{t("orderIntro")}</p>

          <dl className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="glass rounded-2xl p-4">
              <dt className="text-xs text-muted-foreground">{t("orderNumber")}</dt>
              <dd className="mt-1 truncate font-display font-bold text-primary" translate="no">{order.orderNumber}</dd>
            </div>
            <div className="glass rounded-2xl p-4">
              <dt className="text-xs text-muted-foreground">{t("orderStatus")}</dt>
              <dd className="mt-1 font-display font-bold">
                {isPickup
                  ? tm(order.pickupStatus === "PICKED_UP" ? "pickedUp" : "pickupPending")
                  : tm(orderStatusKey(order.status))}
              </dd>
            </div>
            <div className="glass rounded-2xl p-4">
              <dt className="text-xs text-muted-foreground">{tpu("fulfillment")}</dt>
              <dd className="mt-1 font-display text-sm font-bold">
                {tpu(isPickup ? "fulfillmentOfficePickup" : "fulfillmentHomeDelivery")}
              </dd>
            </div>
            <div className="glass rounded-2xl p-4">
              <dt className="text-xs text-muted-foreground">{t("placedAt")}</dt>
              <dd className="mt-1 font-display text-sm font-bold">{formatDate(order.placedAt)}</dd>
            </div>
          </dl>
        </div>
      </section>

      <OrderTracking
        status={order.status}
        history={order.statusHistory}
        locale={locale}
        fulfillment={order.fulfillmentType}
        pickupStatus={order.pickupStatus}
        courierName={order.courierName}
        trackingNumber={order.trackingNumber}
        trackingUrl={order.trackingUrl}
      />

      <section className="glass rounded-3xl p-6 sm:p-8">
        <h2 className="font-display text-xl font-bold">
          {isPickup ? tpu("pickupLocation") : tpu("deliveryAddress")}
        </h2>
        {snapshot ? (
          <address className="mt-4 grid gap-3 rounded-2xl border border-border bg-[var(--glass)] p-4 text-sm not-italic sm:grid-cols-2">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                {t("fullName")}
              </p>
              <p className="mt-1 font-semibold">{snapshot.fullName || "—"}</p>
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                {t("phone")}
              </p>
              <p className="mt-1 font-semibold" dir="ltr">{snapshot.phone || "—"}</p>
            </div>
            <div className="sm:col-span-2">
              <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                {tpu("fullAddress")}
              </p>
              <p className="mt-1 font-semibold">
                {isPickup
                  ? tpu("officePickupNote")
                  : [snapshot.street, snapshot.thana, snapshot.district, snapshot.postalCode]
                      .filter(Boolean)
                      .join(", ")}
              </p>
            </div>
          </address>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">{tpu("noAddress")}</p>
        )}
        {!isPickup ? (
          <p className="mt-3 text-xs text-muted-foreground">{tpu("addressSnapshotNote")}</p>
        ) : null}
      </section>

      <section className="glass rounded-3xl p-6 sm:p-8">
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-xl bg-primary/15 text-primary">
            <Package className="size-5" aria-hidden="true" />
          </span>
          <h2 className="font-display text-xl font-bold">{t("orderItems")}</h2>
        </div>
        <ul className="mt-6 divide-y divide-border">
          {order.items.map((item) => (
            <li key={item.id} className="flex items-center justify-between gap-4 py-4 text-sm">
              <div className="flex min-w-0 items-center gap-3">
                <ProductThumb
                  src={item.productImage}
                  alt={item.productName}
                  className="size-14 rounded-xl"
                  sizes="56px"
                />
                <div className="min-w-0">
                  <p className="truncate font-semibold">{item.productName}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {tc("quantity")}: {item.quantity}
                  </p>
                </div>
              </div>
              <p className="shrink-0 font-bold tabular-nums">
                {formatTaka(item.lineTotalPaisa, locale)}
              </p>
            </li>
          ))}
        </ul>
        <div className="mt-4 flex justify-between border-t border-border pt-5 text-base font-bold">
          <span>{tc("amount")}</span>
          <span className="tabular-nums">{formatTaka(order.totalPaisa, locale)}</span>
        </div>
      </section>

      {order.paymentProofs.length > 0 ? (
        <section className="glass rounded-3xl p-6 sm:p-8">
          <h2 className="font-display text-xl font-bold">{t("paymentProof")}</h2>
          <dl className="mt-5 grid gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-xs text-muted-foreground">{t("paymentMethod")}</dt>
              <dd className="mt-1 font-semibold">{order.paymentProofs[0].method}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">{t("transactionRef")}</dt>
              <dd className="mt-1 font-semibold" translate="no">{order.paymentProofs[0].transactionRef}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">{tc("status")}</dt>
              <dd className="mt-1 font-semibold">{order.paymentProofs[0].status}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">{tc("date")}</dt>
              <dd className="mt-1 font-semibold">{formatDate(order.paymentProofs[0].submittedAt)}</dd>
            </div>
          </dl>

          {isAdmin ? (
            <div className="mt-6 border-t border-border pt-6">
              <h3 className="font-display text-lg font-bold">{ta("paymentsTitle")}</h3>
              <div className="mt-4 space-y-4">
                {order.paymentProofs.map((proof) => (
                  <div key={proof.id} className="rounded-2xl border border-border p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-semibold">{proof.method}</p>
                      <p className="font-mono text-xs text-muted-foreground" translate="no">
                        {proof.transactionRef}
                      </p>
                    </div>
                    <p className="mt-2 font-display text-lg font-bold tabular-nums">
                      {formatSP(proof.amountPaisa)}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {tc("status")}: {proof.status}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {ta("submittedAt")}: {formatDate(proof.submittedAt)}
                    </p>
                    {proof.reviewedAt ? (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {ta("verifiedAt")}: {formatDate(proof.reviewedAt)}
                      </p>
                    ) : null}
                    {proof.note ? (
                      <p className="mt-2 break-words text-xs text-muted-foreground">
                        {ta("note")}: {proof.note}
                      </p>
                    ) : null}
                    {proof.imageUrl ? (
                      <a
                        href={proof.imageUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-3 inline-flex text-xs font-semibold text-primary hover:underline focus-visible:rounded focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        {tc("view")} {t("paymentProof")}
                      </a>
                    ) : null}
                    {proof.status === "PENDING" ? (
                      <div className="mt-4">
                        <PaymentReviewForm proofId={proof.id} />
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </section>
      ) : null}

      <Link href="/member/orders" className={cn(buttonVariants({ variant: "outline" }))}>
        {t("viewOrders")}
      </Link>
    </div>,
  );
}
