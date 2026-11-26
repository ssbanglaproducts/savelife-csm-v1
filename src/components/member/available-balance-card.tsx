import { Wallet } from "lucide-react";
import { useTranslations } from "next-intl";
import { formatSP } from "@/lib/money";

/** Shared, high-contrast balance summary used on wallet action pages. */
export function AvailableBalanceCard({
  availablePaisa,
  hint,
}: {
  availablePaisa: bigint;
  hint?: string;
}) {
  const tPanel = useTranslations("memberPanel");

  return (
    <section className="relative overflow-hidden rounded-2xl border border-primary/35 bg-gradient-to-br from-primary/[0.16] via-[var(--glass-strong)] to-secondary/[0.14] px-5 py-4 shadow-[0_0_0_1px_color-mix(in_srgb,var(--primary)_12%,transparent)]">
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -right-10 -top-12 size-36 rounded-full bg-primary/20 blur-3xl"
      />
      <div className="relative flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-primary">
            {tPanel("availableBalance")}
          </p>
          <p className="gradient-text mt-1 font-display text-3xl font-bold tabular-nums sm:text-4xl">
            {formatSP(availablePaisa)}
          </p>
          {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
        </div>
        <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-primary/15 text-primary ring-1 ring-primary/25">
          <Wallet className="size-6" aria-hidden="true" />
        </span>
      </div>
    </section>
  );
}
