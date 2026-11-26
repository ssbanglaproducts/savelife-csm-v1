import { getTranslations } from "next-intl/server";
import { Check, Circle, PackageCheck, Store, Truck } from "lucide-react";
import { formatMemberDate } from "@/components/member/format-date";
import { orderStatusKey } from "@/components/member/status-labels";
import { cn } from "@/lib/utils";

export type OrderTrackingEntry = {
  id: string;
  fromStatus: string | null;
  toStatus: string;
  note: string | null;
  createdAt: Date;
};

const deliverySteps = [
  "CONFIRMED",
  "PROCESSING",
  "SHIPPED",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
] as const;

function TrackingStep({
  label,
  timeText,
  reached,
  current,
  icon: Icon,
}: {
  label: string;
  timeText: string;
  reached: boolean;
  current: boolean;
  icon: typeof Check;
}) {
  return (
    <li
      className={cn(
        "rounded-2xl border p-3",
        current
          ? "border-primary/40 bg-primary/[0.08]"
          : reached
            ? "border-primary/20 bg-primary/[0.04]"
            : "border-border",
      )}
      aria-current={current ? "step" : undefined}
    >
      <div className="flex items-center gap-2">
        <span
          className={cn(
            "flex size-7 shrink-0 items-center justify-center rounded-full",
            reached ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
          )}
        >
          <Icon className="size-3.5" aria-hidden="true" />
        </span>
        <span className={cn("text-xs font-bold", !reached && "text-muted-foreground")}>{label}</span>
      </div>
      <p className="mt-2 text-[11px] text-muted-foreground">{timeText}</p>
    </li>
  );
}

export async function OrderTracking({
  status,
  history,
  locale,
  fulfillment = "HOME_DELIVERY",
  pickupStatus = null,
  courierName = null,
  trackingNumber = null,
  trackingUrl = null,
}: {
  status: string;
  history: OrderTrackingEntry[];
  locale: string;
  fulfillment?: string;
  pickupStatus?: string | null;
  courierName?: string | null;
  trackingNumber?: string | null;
  trackingUrl?: string | null;
}) {
  const t = await getTranslations("memberPanel");
  const isPickup = fulfillment === "OFFICE_PICKUP";
  const currentIndex = deliverySteps.indexOf(status as (typeof deliverySteps)[number]);
  const closed = status === "CANCELLED" || status === "RETURNED";
  const timeFor = (step: string) => history.find((entry) => entry.toStatus === step)?.createdAt;

  const timeline = (
    <h3 className="mt-8 text-sm font-bold">{t("trackingHistory")}</h3>
  );

  const historyList = history.length === 0 ? (
    <p className="mt-3 text-sm text-muted-foreground">{t("trackingNoHistory")}</p>
  ) : (
    <ol className="mt-4 space-y-4 border-l border-border pl-5">
      {history.map((entry) => (
        <li key={entry.id} className="relative">
          <span className="absolute -left-[1.5625rem] top-1.5 size-2.5 rounded-full bg-primary ring-4 ring-background" />
          <p className="text-sm font-semibold">
            {entry.fromStatus ? `${t(orderStatusKey(entry.fromStatus))} → ` : ""}
            {t(orderStatusKey(entry.toStatus))}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {formatMemberDate(entry.createdAt, locale, true)}
          </p>
          {entry.note ? (
            <p className="mt-2 break-words rounded-xl bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
              {entry.note}
            </p>
          ) : null}
        </li>
      ))}
    </ol>
  );

  if (isPickup) {
    const pickedUp = pickupStatus === "PICKED_UP";
    return (
      <section className="glass rounded-3xl p-6 sm:p-8" aria-labelledby="tracking-heading">
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-xl bg-primary/15 text-primary">
            <Store className="size-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h2 id="tracking-heading" className="font-display text-xl font-bold">
              {t("fulfillmentOfficePickup")}
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground">{t("pickupNotice")}</p>
          </div>
        </div>

        <ol className="mt-6 grid gap-3 sm:grid-cols-2">
          <TrackingStep
            label={t("pickupPending")}
            timeText={
              timeFor("CONFIRMED")
                ? formatMemberDate(timeFor("CONFIRMED")!, locale, true)
                : t("trackingPending")
            }
            reached
            current={!pickedUp}
            icon={Store}
          />
          <TrackingStep
            label={t("pickedUp")}
            timeText={
              pickedUp && timeFor("PICKED_UP")
                ? formatMemberDate(timeFor("PICKED_UP")!, locale, true)
                : t("trackingPending")
            }
            reached={pickedUp}
            current={pickedUp}
            icon={PackageCheck}
          />
        </ol>

        {timeline}
        {historyList}
      </section>
    );
  }

  return (
    <section className="glass rounded-3xl p-6 sm:p-8" aria-labelledby="tracking-heading">
      <div className="flex items-center gap-3">
        <span className="flex size-10 items-center justify-center rounded-xl bg-primary/15 text-primary">
          <Truck className="size-5" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <h2 id="tracking-heading" className="font-display text-xl font-bold">
            {t("deliveryTracking")}
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">{t("deliveryTrackingIntro")}</p>
        </div>
      </div>

      {closed ? (
        <p className="mt-6 rounded-2xl border border-border bg-muted/40 px-4 py-3 text-sm font-semibold">
          {t("trackingClosed", { status: t(orderStatusKey(status)) })}
        </p>
      ) : null}

      <ol className="mt-6 grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {deliverySteps.map((step, index) => {
          const reached = !closed && (currentIndex < 0 || index <= currentIndex);
          const current = !closed && index === currentIndex;
          const time = timeFor(step);
          const Icon =
            step === "SHIPPED" || step === "OUT_FOR_DELIVERY"
              ? Truck
              : step === "DELIVERED"
                ? PackageCheck
                : reached
                  ? Check
                  : Circle;

          return (
            <TrackingStep
              key={step}
              label={t(orderStatusKey(step))}
              timeText={time ? formatMemberDate(time, locale, true) : t("trackingPending")}
              reached={reached}
              current={current}
              icon={Icon}
            />
          );
        })}
      </ol>

      {courierName || trackingNumber ? (
        <div className="mt-6 grid gap-3 rounded-2xl border border-border bg-[var(--glass)] p-4 sm:grid-cols-2">
          {courierName ? (
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                {t("courier")}
              </p>
              <p className="mt-1 text-sm font-semibold">{courierName}</p>
            </div>
          ) : null}
          {trackingNumber ? (
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                {t("trackingNumber")}
              </p>
              <p className="mt-1 text-sm font-semibold" translate="no">
                {trackingUrl ? (
                  <a
                    href={trackingUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline focus-visible:rounded focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {trackingNumber}
                  </a>
                ) : (
                  trackingNumber
                )}
              </p>
            </div>
          ) : null}
        </div>
      ) : null}

      {timeline}
      {historyList}
    </section>
  );
}
