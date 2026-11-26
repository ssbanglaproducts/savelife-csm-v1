import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

export type OrderFulfillmentFilter = "all" | "pickup" | "delivery";

export async function OrderFilterTabs({ active }: { active: OrderFulfillmentFilter }) {
  const t = await getTranslations("memberPanel");
  const tabs: Array<{ value: OrderFulfillmentFilter; label: string }> = [
    { value: "all", label: t("orderFilterAll") },
    { value: "pickup", label: t("orderFilterPickup") },
    { value: "delivery", label: t("orderFilterDelivery") },
  ];

  return (
    <nav aria-label={t("fulfillment")} className="flex flex-wrap gap-2">
      {tabs.map((tab) => {
        const selected = tab.value === active;
        return (
          <Link
            key={tab.value}
            href={tab.value === "all" ? "/member/orders" : `/member/orders?fulfillment=${tab.value}`}
            aria-current={selected ? "page" : undefined}
            className={cn(
              "flex min-h-11 items-center rounded-full border px-4 text-sm font-bold transition-colors focus-visible:ring-2 focus-visible:ring-ring",
              selected
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-[var(--card-solid)] text-muted-foreground hover:border-primary/40 hover:text-primary",
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
