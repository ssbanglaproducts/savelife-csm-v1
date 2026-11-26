"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { Loader2, Plus, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { UploadField } from "@/components/ui/upload-field";
import { statusLabelKey } from "@/components/member/status-labels";
import { formatMemberDate } from "@/components/member/format-date";
import { formatSP } from "@/lib/money";
import { uploadImage } from "@/lib/upload-client";
import { AvailableBalanceCard } from "./available-balance-card";
import { PaymentAccountCard } from "./payment-account-card";
import { memberFieldClass, memberInputClass, memberLabelClass } from "./form-styles";

export type Method = "BKASH" | "NAGAD" | "BANK";
export type { Method as TopUpMethod };

export type TopUpRequest = {
  requestNumber: string;
  amountPaisa: string;
  method: Method;
  transactionRef: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  note: string | null;
  createdAt: string;
  reviewedAt: string | null;
};

export function TopUpForm({
  accounts,
  initialRequests,
  locale,
  availablePaisa,
}: {
  accounts: Record<Method, string>;
  initialRequests: TopUpRequest[];
  locale: string;
  availablePaisa: bigint;
}) {
  const tPanel = useTranslations("memberPanel");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const [method, setMethod] = useState<Method>("BKASH");
  const [pending, setPending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [proofImageUrl, setProofImageUrl] = useState("");
  const [proofName, setProofName] = useState<string | null>(null);
  const [requests, setRequests] = useState(initialRequests);

  async function refreshRequests() {
    try {
      const response = await fetch("/api/member/wallet-topups", { cache: "no-store" });
      if (!response.ok) return;
      const data = (await response.json()) as { requests: TopUpRequest[] };
      setRequests(data.requests);
    } catch {
      // The submitted request still succeeds if the follow-up refresh fails.
    }
  }

  async function handleFile(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadImage(file);
      setProofImageUrl(url);
      setProofName(file.name);
    } catch {
      setProofImageUrl("");
      setProofName(null);
      toast.error(tCommon("error"));
    } finally {
      setUploading(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const payload = {
      amount: String(form.get("amount") ?? "").trim(),
      method,
      transactionRef: String(form.get("transactionRef") ?? "").trim(),
      proofImageUrl,
      note: String(form.get("note") ?? "").trim(),
    };

    try {
      const response = await fetch("/api/member/wallet-topups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await response.json()) as { error?: string; request?: { requestNumber: string } };
      if (!response.ok || !data.request) {
        toast.error(data.error === "INVALID_AMOUNT" ? tPanel("invalidAmount") : tCommon("error"));
        return;
      }
      toast.success(`${tPanel("topUpSubmitted")} ${data.request.requestNumber}`);
      formElement.reset();
      setProofImageUrl("");
      setProofName(null);
      setMethod("BKASH");
      await refreshRequests();
      router.refresh();
    } catch {
      toast.error(tCommon("error"));
    } finally {
      setPending(false);
    }
  }

  const activeAccount = accounts[method];

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
      <form onSubmit={handleSubmit} className="glass rounded-3xl p-6 sm:p-8">
        <h2 className="font-display text-xl font-bold">{tPanel("topUpRequestTitle")}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{tPanel("topUpRequestIntro")}</p>

        <div className="mt-5">
          <AvailableBalanceCard availablePaisa={availablePaisa} />
        </div>

        <div className="mt-6 grid gap-5 sm:grid-cols-2">
          <div className={memberFieldClass}>
            <label htmlFor="top-up-amount" className={memberLabelClass}>
              {tCommon("amount")}
            </label>
            <input
              id="top-up-amount"
              name="amount"
              required
              inputMode="decimal"
              pattern="^\d+(\.\d{1,2})?$"
              placeholder="0.00"
              className={`${memberInputClass} mt-2 tabular-nums`}
            />
          </div>
          <div className={memberFieldClass}>
            <label htmlFor="top-up-method" className={memberLabelClass}>
              {tPanel("topUpMethod")}
            </label>
            <select
              id="top-up-method"
              value={method}
              onChange={(event) => setMethod(event.target.value as Method)}
              className={`${memberInputClass} mt-2`}
            >
              <option value="BKASH">bKash</option>
              <option value="NAGAD">Nagad</option>
              <option value="BANK">{tPanel("bank")}</option>
            </select>
          </div>
        </div>

        <PaymentAccountCard
          className="mt-4"
          method={method}
          account={activeAccount}
          sendToLabel={tPanel("topUpSendTo")}
          missingLabel={tPanel("topUpAccountMissing")}
        />

        <div className="mt-5 grid gap-5 sm:grid-cols-2">
          <div className={memberFieldClass}>
            <label htmlFor="top-up-ref" className={memberLabelClass}>
              {tPanel("topUpTransactionRef")}
            </label>
            <input
              id="top-up-ref"
              name="transactionRef"
              required
              minLength={3}
              maxLength={120}
              className={`${memberInputClass} mt-2`}
            />
          </div>
          <div className={memberFieldClass}>
            <label htmlFor="top-up-note" className={memberLabelClass}>
              {tPanel("transactionNote")} <span className="text-muted-foreground">({tCommon("optional")})</span>
            </label>
            <input
              id="top-up-note"
              name="note"
              maxLength={300}
              className={`${memberInputClass} mt-2`}
            />
          </div>
        </div>

        <div className="mt-5">
          <p className={memberLabelClass}>
            {tPanel("topUpProof")} <span className="text-muted-foreground">({tCommon("optional")})</span>
          </p>
          <UploadField
            id="top-up-proof"
            accept="image/jpeg,image/png,image/webp"
            actionLabel={tPanel("topUpProof")}
            uploading={uploading}
            selectedName={proofName}
            onSelect={(files) => void handleFile(files)}
            onRemove={() => {
              setProofImageUrl("");
              setProofName(null);
            }}
            className="mt-2"
          />
        </div>

        <div className="mt-7 flex flex-col gap-4 border-t border-border pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <ShieldCheck className="size-4 shrink-0 text-primary" aria-hidden="true" />
            {tPanel("topUpReviewHint")}
          </p>
          <Button type="submit" size="lg" disabled={pending || uploading}>
            {pending || uploading ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <Plus className="size-4" aria-hidden="true" />
            )}
            {pending || uploading ? tPanel("submitting") : tPanel("submitTopUp")}
          </Button>
        </div>
      </form>

      <aside className="glass h-fit rounded-3xl p-6">
        <h2 className="font-display text-lg font-bold">{tPanel("topUpHistoryTitle")}</h2>
        {requests.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">{tPanel("topUpEmpty")}</p>
        ) : (
          <ul className="mt-4 divide-y divide-border">
            {requests.map((request) => (
              <li key={request.requestNumber} className="py-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-mono text-xs font-bold" translate="no">
                      {request.requestNumber}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {request.method} · {formatMemberDate(new Date(request.createdAt), locale, true)}
                    </p>
                  </div>
                  <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-bold text-primary">
                    {tPanel(statusLabelKey(request.status))}
                  </span>
                </div>
                <p className="mt-2 font-display font-bold tabular-nums">
                  {formatSP(BigInt(request.amountPaisa))}
                </p>
              </li>
            ))}
          </ul>
        )}
      </aside>
    </div>
  );
}
