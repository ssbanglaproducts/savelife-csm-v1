"use client";

import { useId, useRef, useState, type FormEvent } from "react";
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatSP } from "@/lib/money";
import { memberFieldClass, memberInputClass, memberLabelClass } from "./form-styles";

export function WalletTransferForm({
  profitPaisa,
  affiliatePaisa,
  rankRewardPaisa,
}: {
  profitPaisa: bigint;
  affiliatePaisa: bigint;
  rankRewardPaisa: bigint;
}) {
  const tPanel = useTranslations("memberPanel");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const fieldId = useId();
  const idempotencyKey = useRef<string | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  function errorMessage(code: string | undefined) {
    switch (code) {
      case "MEMBER_NOT_ACTIVE":
        return tPanel("memberNotActiveError");
      case "INSUFFICIENT_BALANCE":
        return tPanel("insufficientBalanceError");
      case "DUPLICATE_REQUEST":
        return tPanel("duplicateRequestError");
      default:
        return tCommon("error");
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    setSuccess(false);

    // One key per submission attempt; retries keep the same key until the
    // server accepts it, then the next submission gets a fresh key.
    if (!idempotencyKey.current) idempotencyKey.current = crypto.randomUUID();

    const form = event.currentTarget;
    const data = new FormData(form);
    const payload = {
      from: String(data.get("from") ?? "PROFIT"),
      amount: String(data.get("amount") ?? ""),
      idempotencyKey: idempotencyKey.current,
    };

    try {
      const response = await fetch("/api/member/wallet-transfer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = (await response.json()) as { error?: string };

      if (response.status === 401) {
        router.push("/login");
        return;
      }
      if (!response.ok) {
        setError(errorMessage(body.error));
        return;
      }

      idempotencyKey.current = null;
      setSuccess(true);
      form.reset();
      router.refresh();
    } catch {
      setError(tCommon("error"));
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="glass min-w-0 rounded-3xl p-6 shadow-xl sm:p-8">
      <h2 className="font-display text-xl font-bold tracking-tight">{tPanel("transferTitle")}</h2>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{tPanel("walletIntro")}</p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <div className={memberFieldClass}>
          <label htmlFor={`${fieldId}-from`} className={memberLabelClass}>
            {tPanel("transferFrom")}
          </label>
          <select
            id={`${fieldId}-from`}
            name="from"
            defaultValue="PROFIT"
            aria-describedby={`${fieldId}-from-help`}
            className={`${memberInputClass} mt-2`}
          >
            <option value="PROFIT">{tPanel("profit")}</option>
            <option value="AFFILIATE">{tPanel("affiliate")}</option>
            <option value="RANK_REWARD">{tPanel("rankReward")}</option>
          </select>
          <p id={`${fieldId}-from-help`} className="mt-1.5 text-xs text-muted-foreground">
            {tPanel("profit")}: {formatSP(profitPaisa)} · {tPanel("affiliate")}:{" "}
            {formatSP(affiliatePaisa)} · {tPanel("rankReward")}: {formatSP(rankRewardPaisa)}
          </p>
        </div>
        <div className={memberFieldClass}>
          <label htmlFor={`${fieldId}-amount`} className={memberLabelClass}>
            {tPanel("amount")}
          </label>
          <input
            id={`${fieldId}-amount`}
            name="amount"
            required
            inputMode="decimal"
            pattern="\d+(\.\d{1,2})?"
            step="0.01"
            className={`${memberInputClass} mt-2`}
          />
        </div>
      </div>

      {error ? (
        <p role="alert" className="mt-6 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-500">
          {error}
        </p>
      ) : null}
      {success ? (
        <p role="status" className="mt-6 rounded-xl border border-primary/30 bg-primary/10 px-4 py-3 text-sm text-primary">
          {tCommon("success")}
        </p>
      ) : null}

      <div className="mt-8 flex justify-end border-t border-border pt-6">
        <Button type="submit" size="lg" disabled={pending}>
          {pending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
          {pending ? tPanel("transferring") : tPanel("transfer")}
        </Button>
      </div>
    </form>
  );
}
