"use client";

import { useId, useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { adminInputClass, adminLabelClass } from "@/components/admin/admin-ui";
import { useAdminAction } from "./use-admin-action";

function bpsToInput(bps: number): string {
  const percent = bps / 100;
  return Number.isInteger(percent) ? String(percent) : percent.toFixed(2);
}

export function RoiCommissionForm({
  initialRatesBps,
}: {
  initialRatesBps: readonly number[];
}) {
  const t = useTranslations("adminPanel");
  const fieldId = useId();
  const { pending, run } = useAdminAction();
  const [rates, setRates] = useState<string[]>(initialRatesBps.map(bpsToInput));

  const ratesBps = rates.map((value) => {
    if (value.trim() === "") return -1;
    const percent = Number(value);
    return Number.isFinite(percent) ? Math.round(percent * 100) : -1;
  });
  const invalid = ratesBps.some(
    (bps) => !Number.isInteger(bps) || bps < 0 || bps > 10_000,
  );
  const totalBps = invalid ? 0 : ratesBps.reduce((sum, bps) => sum + bps, 0);
  const savedTotalBps = initialRatesBps.reduce((sum, bps) => sum + bps, 0);

  function update(index: number, value: string) {
    setRates((current) => current.map((item, position) => (position === index ? value : item)));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (invalid) return;
    await run("/api/admin/roi-commission/rates", "POST", { ratesBps });
  }

  return (
    <div className="space-y-5">
      <form onSubmit={handleSubmit} className="glass space-y-4 rounded-2xl p-4 sm:p-5">
        <p className="text-sm leading-relaxed text-muted-foreground">{t("roiAdditionalNote")}</p>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {rates.map((rate, index) => (
            <div key={`${fieldId}-${index}`}>
              <label htmlFor={`${fieldId}-${index}`} className={adminLabelClass}>
                {t("roiRateLevelValue", { level: index + 1 })}
              </label>
              <div className="relative mt-2">
                <input
                  id={`${fieldId}-${index}`}
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={rate}
                  onChange={(event) => update(index, event.target.value)}
                  className={`${adminInputClass} pr-8 tabular-nums`}
                  translate="no"
                />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-muted-foreground">
                  %
                </span>
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-background/50 px-4 py-3">
          <p className="text-sm font-semibold text-muted-foreground">{t("roiCombinedRate")}</p>
          <p className="font-display text-xl font-bold tabular-nums text-primary">
            {(totalBps / 100).toFixed(2)}%
          </p>
        </div>
        {invalid ? (
          <p className="text-xs text-destructive" role="alert">
            {t("roiRateInvalid")}
          </p>
        ) : null}

        <div className="flex justify-end">
          <Button type="submit" disabled={pending || invalid}>
            {pending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
            {pending ? t("roiRatesSaving") : t("roiRatesSave")}
          </Button>
        </div>
      </form>

      <section
        aria-labelledby={`${fieldId}-chart-title`}
        className="glass rounded-2xl p-4 sm:p-5"
      >
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 id={`${fieldId}-chart-title`} className="font-display text-base font-bold">
            {t("roiRateChartTitle")}
          </h3>
          <p className="text-xs text-muted-foreground">{t("roiRateChartNote")}</p>
        </div>
        <div className="mt-4 space-y-3">
          {initialRatesBps.map((bps, index) => {
            const percent = (bps / 100).toFixed(2);
            const share = savedTotalBps > 0 ? (bps / savedTotalBps) * 100 : 0;
            const levelLabel = t("roiRateLevelValue", { level: index + 1 });
            return (
              <div
                key={`${fieldId}-chart-${index}`}
                className="grid grid-cols-[5rem_minmax(0,1fr)_3.5rem] items-center gap-3 text-xs sm:grid-cols-[7rem_minmax(0,1fr)_4rem]"
              >
                <span className="font-semibold">{levelLabel}</span>
                <div
                  role="img"
                  aria-label={`${levelLabel}: ${percent}%`}
                  className="h-2.5 overflow-hidden rounded-full bg-muted"
                >
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${share}%` }}
                  />
                </div>
                <span className="text-right font-semibold tabular-nums">{percent}%</span>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
