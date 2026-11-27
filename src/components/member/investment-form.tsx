"use client";

import { useId, useState, type FormEvent, type ReactNode } from "react";
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { ArrowRight, Check, Info, Loader2, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { UploadField } from "@/components/ui/upload-field";
import { formatSP, paisaToSP, spToPaisa, type Paisa } from "@/lib/money";
import {
  formatTopUpAccount,
  topUpAccountDetails,
  type TopUpAccountEntry,
  type TopUpAccounts,
} from "@/lib/topup-accounts";
import { uploadImage } from "@/lib/upload-client";
import { PaymentAccountCard } from "./payment-account-card";
import { memberFieldClass, memberInputClass, memberLabelClass } from "./form-styles";

type PlanType = "INSTALLMENT" | "PROFIT_ONLY";
type PaymentMethod = keyof TopUpAccounts | "OTHER";

function parseAmount(value: string): Paisa | null {
  if (!/^\d+(\.\d{1,2})?$/.test(value)) return null;
  try {
    return spToPaisa(value);
  } catch {
    return null;
  }
}

function formatMonthlyCapital(amountPaisa: Paisa, months: number): string {
  const monthlyPaisa = amountPaisa / BigInt(months);
  const wholeSP = monthlyPaisa / 100n;
  return paisaToSP(wholeSP * 100n);
}

export function InvestmentForm({
  installmentDurationMonths,
  profitOnlyLockInMonths,
  accounts,
  entries = [],
}: {
  installmentDurationMonths: number;
  profitOnlyLockInMonths: number;
  accounts: TopUpAccounts;
  entries?: readonly TopUpAccountEntry[];
}) {
  const tPanel = useTranslations("memberPanel");
  const [plan, setPlan] = useState<PlanType | null>(null);

  return (
    <div className="min-w-0" aria-label={tPanel("applyTitle")}>
      {plan === null ? (
        <PlanPicker
          installmentDurationMonths={installmentDurationMonths}
          profitOnlyLockInMonths={profitOnlyLockInMonths}
          onSelect={setPlan}
        />
      ) : (
        <PlanApplicationForm
          key={plan}
          plan={plan}
          installmentDurationMonths={installmentDurationMonths}
          profitOnlyLockInMonths={profitOnlyLockInMonths}
          accounts={accounts}
          entries={entries}
          onChangePlan={() => setPlan(null)}
        />
      )}
    </div>
  );
}

function PlanPicker({
  installmentDurationMonths,
  profitOnlyLockInMonths,
  onSelect,
}: {
  installmentDurationMonths: number;
  profitOnlyLockInMonths: number;
  onSelect: (plan: PlanType) => void;
}) {
  const tPanel = useTranslations("memberPanel");
  const exampleAmount = formatSP(spToPaisa("100000"));
  const installmentExample = tPanel("installmentPlanExample", {
    months: installmentDurationMonths,
    example: exampleAmount,
    monthly: `${formatMonthlyCapital(spToPaisa("100000"), installmentDurationMonths)} SP`,
  });
  const profitOnlyExample = tPanel("profitOnlyPlanExample", {
    months: profitOnlyLockInMonths,
    example: exampleAmount,
  });

  return (
    <fieldset className="min-w-0">
      <legend className="font-display text-xl font-bold tracking-tight sm:text-2xl">
        {tPanel("choosePlan")}
      </legend>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
        {tPanel("choosePlanIntro")}
      </p>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <PlanCard
          plan="INSTALLMENT"
          title={tPanel("installment")}
          icon={<TrendingUp className="size-5" aria-hidden="true" />}
          summary={tPanel("installmentPlanSummary")}
          example={installmentExample}
          onSelect={onSelect}
        />
        <PlanCard
          plan="PROFIT_ONLY"
          title={tPanel("profitOnly")}
          icon={<Info className="size-5" aria-hidden="true" />}
          summary={tPanel("profitOnlyPlanSummary")}
          example={profitOnlyExample}
          onSelect={onSelect}
        />
      </div>
    </fieldset>
  );
}

function PlanCard({
  plan,
  title,
  icon,
  summary,
  example,
  onSelect,
}: {
  plan: PlanType;
  title: string;
  icon: ReactNode;
  summary: string;
  example: string;
  onSelect: (plan: PlanType) => void;
}) {
  const tPanel = useTranslations("memberPanel");

  return (
    <label className="glass relative flex h-full cursor-pointer flex-col rounded-3xl border border-border/60 p-5 transition-[border-color,transform] hover:-translate-y-0.5 hover:border-primary/50 focus-within:border-primary/70 sm:p-6">
      <input
        type="radio"
        name="investment-plan"
        value={plan}
        aria-label={title}
        className="peer sr-only"
        onChange={() => onSelect(plan)}
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 rounded-3xl peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-background"
      />

      <div className="flex items-start justify-between gap-3">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-primary/12 text-primary ring-1 ring-primary/15">
          {icon}
        </span>
        <span
          aria-hidden="true"
          className="flex size-5 shrink-0 items-center justify-center rounded-full border border-border/70 bg-muted/40"
        >
          <Check className="size-3 text-transparent" />
        </span>
      </div>

      <h3 className="mt-4 font-display text-xl font-bold tracking-tight">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{summary}</p>

      <div className="mt-5 rounded-2xl border border-primary/15 bg-primary/[0.06] p-3.5">
        <p className="text-[10px] font-bold tracking-[0.1em] text-primary uppercase">
          {tPanel("planExampleLabel")}
        </p>
        <p className="mt-1.5 text-sm font-semibold leading-relaxed tabular-nums">{example}</p>
      </div>

      <span className="mt-auto flex items-center gap-2 pt-5 text-sm font-bold text-primary">
        {tPanel("continueWithPlan", { plan: title })}
        <ArrowRight className="size-4" aria-hidden="true" />
      </span>
    </label>
  );
}

function PlanApplicationForm({
  plan,
  installmentDurationMonths,
  profitOnlyLockInMonths,
  accounts,
  entries = [],
  onChangePlan,
}: {
  plan: PlanType;
  installmentDurationMonths: number;
  profitOnlyLockInMonths: number;
  accounts: TopUpAccounts;
  entries?: readonly TopUpAccountEntry[];
  onChangePlan: () => void;
}) {
  const tPanel = useTranslations("memberPanel");
  const tCheckout = useTranslations("checkout");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const fieldId = useId();
  const [amount, setAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("BKASH");
  const [selectedEntryId, setSelectedEntryId] = useState("");
  const [pending, setPending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [paymentImageUrl, setPaymentImageUrl] = useState("");
  const [proofName, setProofName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const amountPaisa = parseAmount(amount);
  const planTitle = plan === "INSTALLMENT" ? tPanel("installment") : tPanel("profitOnly");
  const months = plan === "INSTALLMENT" ? installmentDurationMonths : profitOnlyLockInMonths;
  const entryMethodLabel = (method: "BKASH" | "NAGAD" | "BANK") =>
    method === "BKASH"
      ? tCheckout("bkash")
      : method === "NAGAD"
        ? tCheckout("nagad")
        : tCheckout("bank");
  const methodEntries =
    paymentMethod === "OTHER"
      ? []
      : entries.filter((entry) => entry.method === paymentMethod);
  const activeEntry =
    methodEntries.find((entry) => entry.id === selectedEntryId) ?? methodEntries[0] ?? null;
  const activeAccount = activeEntry
    ? formatTopUpAccount(activeEntry)
    : paymentMethod === "OTHER"
      ? ""
      : accounts[paymentMethod as keyof TopUpAccounts] || "";
  const activeDetails = activeEntry
    ? [
        activeEntry.kind === "PERSONAL"
          ? tPanel("topUpAccountPersonal")
          : activeEntry.kind === "AGENT"
            ? tPanel("topUpAccountAgent")
            : "",
        ...topUpAccountDetails(activeEntry),
      ].filter(Boolean)
    : [];

  async function handleFile(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const url = await uploadImage(file);
      setPaymentImageUrl(url);
      setProofName(file.name);
    } catch {
      setPaymentImageUrl("");
      setProofName(null);
      setError(tCommon("error"));
    } finally {
      setUploading(false);
    }
  }

  function errorMessage(code: string | undefined) {
    switch (code) {
      case "MEMBER_NOT_ACTIVE":
        return tPanel("memberNotActiveError");
      case "MINIMUM_INVESTMENT":
        return tPanel("minimumInvestment");
      default:
        return tCommon("error");
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    setSuccess(null);

    const form = event.currentTarget;
    const data = new FormData(form);
    const payload = {
      type: plan,
      amount: String(data.get("amount") ?? ""),
      paymentMethod: String(data.get("paymentMethod") ?? "BKASH"),
      transactionRef: String(data.get("transactionRef") ?? ""),
      paymentImageUrl,
    };

    try {
      const response = await fetch("/api/member/investments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = (await response.json()) as {
        error?: string;
        investment?: { investmentNumber: string };
      };

      if (response.status === 401) {
        router.push("/login");
        return;
      }
      if (!response.ok || !body.investment) {
        setError(errorMessage(body.error));
        return;
      }

      setSuccess(`${tCommon("success")} ${body.investment.investmentNumber}`);
      form.reset();
      setAmount("");
      setPaymentMethod("BKASH");
      setPaymentImageUrl("");
      setProofName(null);
      router.refresh();
    } catch {
      setError(tCommon("error"));
    } finally {
      setPending(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-2xl border border-border/60 bg-[var(--glass-strong)]/40 p-5 sm:p-6"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-primary">{tPanel("selectedPlan")}</p>
          <h3 className="mt-1 font-display text-lg font-bold">{planTitle}</h3>
        </div>
        <Button type="button" variant="ghost" size="sm" onClick={onChangePlan}>
          {tPanel("changePlan")}
        </Button>
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1fr)_260px]">
        <div className="min-w-0 space-y-4">
          <div className={memberFieldClass}>
            <label htmlFor={`${fieldId}-amount`} className={memberLabelClass}>
              {tPanel("amount")}
            </label>
            <input
              id={`${fieldId}-amount`}
              name="amount"
              required
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              inputMode="decimal"
              pattern="\d+(\.\d{1,2})?"
              min="1000"
              step="0.01"
              placeholder="1000"
              aria-describedby={`${fieldId}-amount-help`}
              className={`${memberInputClass} mt-2`}
            />
            <p id={`${fieldId}-amount-help`} className="mt-1.5 text-xs text-muted-foreground">
              {tPanel("minimumInvestment")} ·{" "}
              {plan === "INSTALLMENT"
                ? tPanel("installmentAmountHint", { months: installmentDurationMonths })
                : tPanel("profitOnlyAmountHint", { months: profitOnlyLockInMonths })}
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className={memberFieldClass}>
              <label htmlFor={`${fieldId}-method`} className={memberLabelClass}>
                {tPanel("paymentMethod")}
              </label>
              <select
                id={`${fieldId}-method`}
                name="paymentMethod"
                value={paymentMethod}
                onChange={(event) => setPaymentMethod(event.target.value as PaymentMethod)}
                className={`${memberInputClass} mt-2`}
              >
                <option value="BKASH">{tCheckout("bkash")}</option>
                <option value="NAGAD">{tCheckout("nagad")}</option>
                <option value="BANK">{tCheckout("bank")}</option>
                <option value="OTHER">{tCheckout("other")}</option>
              </select>
              {methodEntries.length > 1 ? (
                <select
                  aria-label={tPanel("topUpAccountOption")}
                  value={activeEntry?.id ?? ""}
                  onChange={(event) => setSelectedEntryId(event.target.value)}
                  className={`${memberInputClass} mt-2`}
                >
                  {methodEntries.map((entry, index) => (
                    <option key={entry.id} value={entry.id}>
                      {entry.label.trim() || `${entryMethodLabel(entry.method)} ${index + 1}`}
                    </option>
                  ))}
                </select>
              ) : null}
            </div>
            <div className={memberFieldClass}>
              <label htmlFor={`${fieldId}-ref`} className={memberLabelClass}>
                {tPanel("transactionRef")}
              </label>
              <input
                id={`${fieldId}-ref`}
                name="transactionRef"
                required
                minLength={3}
                maxLength={120}
                className={`${memberInputClass} mt-2`}
              />
            </div>
          </div>

          <PaymentAccountCard
            method={paymentMethod}
            account={activeAccount}
            details={activeDetails}
            sendToLabel={tPanel("topUpSendTo")}
            missingLabel={tPanel("topUpAccountMissing")}
          />

          <div>
            <p className={memberLabelClass}>
              {tPanel("uploadProof")} <span className="text-muted-foreground">({tCommon("optional")})</span>
            </p>
            <UploadField
              id={`${fieldId}-proof`}
              accept="image/jpeg,image/png,image/webp"
              actionLabel={tPanel("uploadProof")}
              hint={tCheckout("uploadHint")}
              uploading={uploading}
              selectedName={proofName}
              onSelect={(files) => void handleFile(files)}
              onRemove={() => {
                setPaymentImageUrl("");
                setProofName(null);
              }}
              className="mt-2"
            />
          </div>
        </div>

        <EstimatedReturn plan={plan} amountPaisa={amountPaisa} months={months} />
      </div>

      {error ? (
        <p role="alert" className="mt-6 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-500">
          {error}
        </p>
      ) : null}
      {success ? (
        <p role="status" className="mt-6 rounded-xl border border-primary/30 bg-primary/10 px-4 py-3 text-sm text-primary">
          {success}
        </p>
      ) : null}

      <div className="mt-6 flex flex-col gap-3 border-t border-border pt-5 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs leading-relaxed text-muted-foreground">{tPanel("disclosure")}</p>
        <Button type="submit" size="lg" disabled={pending || uploading}>
          {pending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
          {pending ? tPanel("submitting") : tPanel("submit")}
        </Button>
      </div>
    </form>
  );
}

function EstimatedReturn({
  plan,
  amountPaisa,
  months,
}: {
  plan: PlanType;
  amountPaisa: Paisa | null;
  months: number;
}) {
  const tPanel = useTranslations("memberPanel");
  const total = amountPaisa ? paisaToSP(amountPaisa) : null;
  const monthly = amountPaisa ? formatMonthlyCapital(amountPaisa, months) : null;

  return (
    <aside className="h-fit rounded-2xl border border-primary/20 bg-primary/5 p-5" aria-live="polite">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <TrendingUp className="size-4 text-primary" aria-hidden="true" />
        {tPanel("estimatedReturn")}
      </div>

      {plan === "INSTALLMENT" ? (
        <>
          <p className="mt-4 font-display text-2xl font-bold tabular-nums">
            {monthly ? `~${monthly} SP` : "—"}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {tPanel("estimatedMonthlyCapital", { months })}
          </p>
          <div className="mt-4 border-t border-primary/10 pt-4">
            <p className="text-sm font-semibold tabular-nums">{total ? `${total} SP` : "—"}</p>
            <p className="mt-1 text-xs text-muted-foreground">{tPanel("estimatedTotalCapital")}</p>
          </div>
        </>
      ) : (
        <>
          <p className="mt-4 font-display text-2xl font-bold tabular-nums">
            {total ? `${total} SP` : "—"}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">{tPanel("estimatedPrincipalHeld")}</p>
          <div className="mt-4 border-t border-primary/10 pt-4">
            <p className="text-sm font-semibold tabular-nums">
              {months} {tPanel("months")}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">{tPanel("estimatedBeforeNotice")}</p>
          </div>
        </>
      )}

      <p className="mt-4 rounded-xl bg-background/60 p-3 text-xs leading-relaxed text-muted-foreground">
        {tPanel("estimatedProfitNote")}
      </p>
    </aside>
  );
}
