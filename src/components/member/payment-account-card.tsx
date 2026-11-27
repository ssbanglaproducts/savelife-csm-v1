"use client";

import { useTranslations } from "next-intl";
import { CheckCircle2, Landmark, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";

export type PaymentAccountMethod = "BKASH" | "NAGAD" | "BANK" | "OTHER";

function MethodMark({ method }: { method: PaymentAccountMethod }) {
  const className =
    method === "BKASH"
      ? "bg-rose-500/10 text-rose-600 ring-rose-500/25 dark:text-rose-300"
      : method === "NAGAD"
        ? "bg-orange-500/10 text-orange-600 ring-orange-500/25 dark:text-orange-300"
        : method === "BANK"
          ? "bg-sky-500/10 text-sky-600 ring-sky-500/25 dark:text-sky-300"
          : "bg-muted text-muted-foreground ring-border";

  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex size-10 shrink-0 items-center justify-center rounded-xl font-display text-xs font-black ring-1 ring-inset",
        className,
      )}
    >
      {method === "BKASH" ? (
        <span className="tracking-tight">bK</span>
      ) : method === "NAGAD" ? (
        <span className="tracking-tight">N</span>
      ) : method === "BANK" ? (
        <Landmark className="size-5" />
      ) : (
        <Wallet className="size-5" />
      )}
    </span>
  );
}

/** Platform receiving account with a method mark and verified state. */
export function PaymentAccountCard({
  method,
  account,
  details,
  sendToLabel,
  missingLabel,
  className,
}: {
  method: PaymentAccountMethod;
  account: string;
  details?: readonly string[];
  sendToLabel: string;
  missingLabel: string;
  className?: string;
}) {
  const tc = useTranslations("common");
  const configured = method !== "OTHER" && account.trim().length > 0;

  if (!configured) {
    return (
      <div
        className={cn(
          "flex items-start gap-3 rounded-2xl border border-dashed border-border px-4 py-3 text-xs text-muted-foreground",
          className,
        )}
      >
        <MethodMark method={method} />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-muted-foreground">{sendToLabel}</p>
          <p className="mt-1">{missingLabel}</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-2xl border border-primary/20 bg-primary/[0.04] px-4 py-3 text-sm",
        className,
      )}
    >
      <MethodMark method={method} />
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold text-primary">{sendToLabel}</p>
        <p className="mt-1 break-words font-mono text-sm font-bold" translate="no">
          {account}
        </p>
        {details && details.length > 0 ? (
          <ul className="mt-1.5 space-y-0.5 text-xs text-muted-foreground">
            {details.map((detail) => (
              <li key={detail} className="break-words" translate="no">
                {detail}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      <span
        role="img"
        aria-label={tc("verified")}
        title={tc("verified")}
        className="flex size-7 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 ring-1 ring-inset ring-emerald-500/20 dark:text-emerald-300"
      >
        <CheckCircle2 className="size-4" aria-hidden="true" />
      </span>
    </div>
  );
}
