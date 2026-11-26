"use client";

import { useId, useRef, useState, type FormEvent } from "react";
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { formatSP } from "@/lib/money";
import { cn } from "@/lib/utils";
import { AvailableBalanceCard } from "./available-balance-card";
import { TPinConfirmDialog } from "./tpin-confirm-dialog";
import {
  normalizeAccountDetails,
  type SavedWithdrawalMethodView,
  type WithdrawalMethodKey,
  withdrawalMethodValues,
} from "@/lib/withdrawal-methods";
import { memberFieldClass, memberInputClass, memberLabelClass } from "./form-styles";

export type PrincipalInvestmentOption = {
  id: string;
  label: string;
  amount: string;
};

type PendingWithdrawal = {
  type: "AVAILABLE" | "PRINCIPAL";
  investmentId?: string;
  amount: string;
  method: WithdrawalMethodKey;
  accountDetails: NonNullable<ReturnType<typeof normalizeAccountDetails>>;
  note: string;
  idempotencyKey: string;
};

const emptyMethodForm = {
  label: "",
  method: "BKASH" as WithdrawalMethodKey,
  accountName: "",
  accountNumber: "",
  bankName: "",
  branch: "",
};

export function WithdrawalForm({
  availablePaisa,
  minWithdrawalPaisa,
  feeBps,
  principalInvestments = [],
  savedMethods = [],
}: {
  availablePaisa: bigint;
  minWithdrawalPaisa: bigint;
  feeBps: number;
  principalInvestments?: readonly PrincipalInvestmentOption[];
  savedMethods?: readonly SavedWithdrawalMethodView[];
}) {
  const tPanel = useTranslations("memberPanel");
  const tCheckout = useTranslations("checkout");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const fieldId = useId();
  const formRef = useRef<HTMLFormElement>(null);
  const idempotencyKey = useRef<string | null>(null);

  const initialMethod =
    savedMethods.find((item) => item.isDefault) ?? savedMethods[0] ?? undefined;

  const [type, setType] = useState<"AVAILABLE" | "PRINCIPAL">("AVAILABLE");
  const [selectedInvestment, setSelectedInvestment] = useState("");
  const [methods, setMethods] = useState<readonly SavedWithdrawalMethodView[]>(savedMethods);
  const [selectedMethodId, setSelectedMethodId] = useState(initialMethod?.id ?? "new");
  const [showMethodForm, setShowMethodForm] = useState(!initialMethod);
  const [label, setLabel] = useState("");
  const [method, setMethod] = useState<WithdrawalMethodKey>(initialMethod?.method ?? "BKASH");
  const [accountName, setAccountName] = useState(initialMethod?.accountDetails.accountName ?? "");
  const [accountNumber, setAccountNumber] = useState(
    initialMethod?.accountDetails.accountNumber ?? "",
  );
  const [bankName, setBankName] = useState(initialMethod?.accountDetails.bankName ?? "");
  const [branch, setBranch] = useState(initialMethod?.accountDetails.branch ?? "");
  const [pending, setPending] = useState(false);
  const [savingMethod, setSavingMethod] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pendingWithdrawal, setPendingWithdrawal] = useState<PendingWithdrawal | null>(null);

  const isPrincipal = type === "PRINCIPAL";
  const chosen = principalInvestments.find((item) => item.id === selectedInvestment);
  const isNewMethod = showMethodForm || selectedMethodId === "new";

  function methodLabel(key: WithdrawalMethodKey) {
    if (key === "BKASH") return tCheckout("bkash");
    if (key === "NAGAD") return tCheckout("nagad");
    if (key === "BANK") return tCheckout("bank");
    return tCheckout("other");
  }

  function errorMessage(code: string | undefined) {
    switch (code) {
      case "MEMBER_NOT_ACTIVE":
        return tPanel("memberNotActiveError");
      case "MINIMUM_WITHDRAWAL":
        return tPanel("minimumWithdrawalError");
      case "INSUFFICIENT_BALANCE":
        return tPanel("insufficientBalanceError");
      case "DUPLICATE_REQUEST":
        return tPanel("duplicateRequestError");
      case "PRINCIPAL_NOT_MATURED":
        return tPanel("principalNotMaturedError");
      case "PRINCIPAL_NOT_ELIGIBLE":
        return tPanel("principalNotEligibleError");
      case "INVESTMENT_ID_REQUIRED":
        return tPanel("selectInvestment");
      case "INVALID_TPIN":
        return tPanel("invalidTPin");
      case "TPIN_NOT_SET":
        return tPanel("tPinNotSet");
      case "BANK_FIELDS_REQUIRED":
        return tPanel("bankFieldsRequired");
      case "DUPLICATE_LABEL":
        return tPanel("duplicateMethodLabel");
      default:
        return tCommon("error");
    }
  }

  function applyMethod(item: SavedWithdrawalMethodView) {
    setSelectedMethodId(item.id);
    setShowMethodForm(false);
    setLabel(item.label);
    setMethod(item.method);
    setAccountName(item.accountDetails.accountName ?? "");
    setAccountNumber(item.accountDetails.accountNumber ?? "");
    setBankName(item.accountDetails.bankName ?? "");
    setBranch(item.accountDetails.branch ?? "");
    setError(null);
    setSuccess(null);
  }

  function openNewMethod() {
    setSelectedMethodId("new");
    setShowMethodForm(true);
    setLabel(emptyMethodForm.label);
    setMethod(emptyMethodForm.method);
    setAccountName(emptyMethodForm.accountName);
    setAccountNumber(emptyMethodForm.accountNumber);
    setBankName(emptyMethodForm.bankName);
    setBranch(emptyMethodForm.branch);
    setError(null);
    setSuccess(null);
  }

  async function saveMethod() {
    setSavingMethod(true);
    setError(null);
    setSuccess(null);
    try {
      const response = await fetch("/api/member/withdrawal-methods", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label,
          method,
          accountDetails: { accountName, accountNumber, bankName, branch },
        }),
      });
      const data = (await response.json()) as {
        error?: string;
        method?: SavedWithdrawalMethodView;
      };
      if (!response.ok || !data.method) {
        setError(errorMessage(data.error));
        return;
      }

      setMethods((current) => [...current.filter((item) => item.id !== data.method!.id), data.method!]);
      applyMethod(data.method);
      toast.success(tPanel("methodSaved"));
    } catch {
      setError(tPanel("methodSaveFailed"));
    } finally {
      setSavingMethod(false);
    }
  }

  async function deleteMethod(id: string) {
    setPending(true);
    setError(null);
    setSuccess(null);
    try {
      const response = await fetch(`/api/member/withdrawal-methods/${id}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        setError(errorMessage(data.error) === tCommon("error") ? tPanel("methodDeleteFailed") : errorMessage(data.error));
        return;
      }

      const next = methods.filter((item) => item.id !== id);
      setMethods(next);
      if (selectedMethodId === id) {
        if (next.length > 0) applyMethod(next[0]);
        else openNewMethod();
      }
      toast.success(tPanel("methodDeleted"));
    } catch {
      setError(tPanel("methodDeleteFailed"));
    } finally {
      setPending(false);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    formRef.current = event.currentTarget;

    if (isNewMethod) {
      setError(tPanel("saveMethodBeforeRequest"));
      return;
    }

    const details = normalizeAccountDetails(method, {
      accountName,
      accountNumber,
      bankName: bankName || undefined,
      branch: branch || undefined,
    });
    if (!details) {
      setError(tPanel("bankFieldsRequired"));
      return;
    }

    setError(null);
    setSuccess(null);
    if (!idempotencyKey.current) idempotencyKey.current = crypto.randomUUID();

    const data = new FormData(event.currentTarget);
    setPendingWithdrawal({
      type,
      investmentId: isPrincipal ? selectedInvestment : undefined,
      // Principal notices always use the remaining capital shown in the select;
      // the amount is validated again by the service from live data.
      amount: isPrincipal
        ? (chosen?.amount ?? String(data.get("amount") ?? ""))
        : String(data.get("amount") ?? ""),
      method,
      ...details,
      note: String(data.get("note") ?? ""),
      accountDetails: details,
      idempotencyKey: idempotencyKey.current,
    });
  }

  async function confirmWithdrawal(tPin: string) {
    if (!pendingWithdrawal) return;
    setPending(true);
    setError(null);
    setSuccess(null);

    const { accountDetails, ...request } = pendingWithdrawal;
    try {
      const response = await fetch("/api/member/withdrawals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...request, ...accountDetails, tPin }),
      });
      const body = (await response.json()) as {
        error?: string;
        withdrawal?: { requestNumber: string; payableAt?: string | null };
      };

      if (response.status === 401) {
        router.push("/login");
        return;
      }
      if (!response.ok || !body.withdrawal) {
        setError(errorMessage(body.error));
        if (body.error === "DUPLICATE_REQUEST") {
          idempotencyKey.current = null;
          setPendingWithdrawal(null);
        }
        return;
      }

      idempotencyKey.current = null;
      setPendingWithdrawal(null);
      setSuccess(`${tCommon("success")} ${body.withdrawal.requestNumber}`);
      setSelectedInvestment("");
      formRef.current?.reset();
      router.refresh();
    } catch {
      setError(tCommon("error"));
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <form
        ref={formRef}
        onSubmit={handleSubmit}
        className="glass min-w-0 rounded-3xl p-6 shadow-xl sm:p-8"
      >
        <h2 className="font-display text-xl font-bold tracking-tight">{tPanel("requestTitle")}</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{tPanel("withdrawalsIntro")}</p>

        <div className="mt-5">
          <AvailableBalanceCard
            availablePaisa={availablePaisa}
            hint={tPanel("availableWithdrawal")}
          />
        </div>

        <dl className="mt-3 grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-border bg-background/40 p-4">
            <dt className="text-xs text-muted-foreground">{tPanel("minWithdrawal")}</dt>
            <dd className="mt-1 font-display font-bold tabular-nums">{formatSP(minWithdrawalPaisa)}</dd>
          </div>
          <div className="rounded-2xl border border-border bg-background/40 p-4">
            <dt className="text-xs text-muted-foreground">{tPanel("fee")}</dt>
            <dd className="mt-1 font-display font-bold tabular-nums">{feeBps / 100}%</dd>
          </div>
        </dl>

      <section className="mt-6 rounded-2xl border border-border bg-background/40 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="font-display text-base font-bold">{tPanel("savedPaymentMethods")}</h3>
            <p className="mt-1 text-xs text-muted-foreground">{tPanel("savedPaymentMethodsHint")}</p>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={openNewMethod}>
            <Plus className="size-4" aria-hidden="true" />
            {tPanel("addPaymentMethod")}
          </Button>
        </div>

        {methods.length > 0 ? (
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {methods.map((item) => {
              const selected = !isNewMethod && selectedMethodId === item.id;
              return (
                <div
                  key={item.id}
                  className={cn(
                    "flex min-w-0 items-center gap-2 rounded-xl border p-3 transition-colors",
                    selected
                      ? "border-primary/60 bg-primary/5 ring-1 ring-primary/20"
                      : "border-border hover:bg-accent/50",
                  )}
                >
                  <button
                    type="button"
                    onClick={() => applyMethod(item)}
                    className="min-w-0 flex-1 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    aria-pressed={selected}
                  >
                    <span className="block truncate text-sm font-semibold">{item.label}</span>
                    <span className="mt-0.5 block truncate text-xs text-muted-foreground" translate="no">
                      {methodLabel(item.method)} · {item.accountDetails.accountNumber}
                    </span>
                  </button>
                  <button
                    type="button"
                    aria-label={`${tPanel("deleteMethod")} ${item.label}`}
                    onClick={() => void deleteMethod(item.id)}
                    disabled={pending}
                    className="flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
                  >
                    <Trash2 className="size-4" aria-hidden="true" />
                  </button>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="mt-4 text-sm text-muted-foreground">{tPanel("noSavedMethods")}</p>
        )}
      </section>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <div className={memberFieldClass}>
          <label htmlFor={`${fieldId}-type`} className={memberLabelClass}>
            {tPanel("withdrawalType")}
          </label>
          <select
            id={`${fieldId}-type`}
            name="type"
            value={type}
            onChange={(event) => {
              setType(event.target.value as "AVAILABLE" | "PRINCIPAL");
              setError(null);
            }}
            className={`${memberInputClass} mt-2`}
          >
            <option value="AVAILABLE">{tPanel("availableWithdrawal")}</option>
            <option value="PRINCIPAL" disabled={principalInvestments.length === 0}>
              {tPanel("principalWithdrawal")}
            </option>
          </select>
        </div>
        {isPrincipal ? (
          <div className={memberFieldClass}>
            <label htmlFor={`${fieldId}-investment`} className={memberLabelClass}>
              {tPanel("selectInvestment")}
            </label>
            <select
              id={`${fieldId}-investment`}
              name="investmentId"
              required
              value={selectedInvestment}
              onChange={(event) => setSelectedInvestment(event.target.value)}
              className={`${memberInputClass} mt-2`}
            >
              <option value="">—</option>
              {principalInvestments.map((investment) => (
                <option key={investment.id} value={investment.id}>
                  {investment.label}
                </option>
              ))}
            </select>
          </div>
        ) : (
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
        )}
      </div>

      {isPrincipal ? (
        <p className="mt-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs leading-relaxed text-amber-600 dark:text-amber-400">
          {tPanel("principalNoticeHint")}
        </p>
      ) : null}

      <section className="mt-4 rounded-2xl border border-border bg-background/40 p-4">
        <h3 className="font-display text-base font-bold">
          {isNewMethod ? tPanel("newPaymentMethod") : tPanel("selectedPaymentMethod")}
        </h3>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {showMethodForm ? (
            <div className={memberFieldClass}>
              <label htmlFor={`${fieldId}-label`} className={memberLabelClass}>
                {tPanel("methodLabel")}
              </label>
              <input
                id={`${fieldId}-label`}
                required
                minLength={1}
                maxLength={60}
                placeholder={tPanel("methodLabelPlaceholder")}
                className={`${memberInputClass} mt-2`}
                value={label}
                onChange={(event) => setLabel(event.target.value)}
              />
            </div>
          ) : null}
          <div className={memberFieldClass}>
            <label htmlFor={`${fieldId}-method`} className={memberLabelClass}>
              {tPanel("paymentMethod")}
            </label>
            <select
              id={`${fieldId}-method`}
              value={method}
              disabled={!showMethodForm}
              onChange={(event) => setMethod(event.target.value as WithdrawalMethodKey)}
              className={cn(memberInputClass, "mt-2", !showMethodForm && "opacity-80")}
            >
              {withdrawalMethodValues.map((value) => (
                <option key={value} value={value}>
                  {methodLabel(value)}
                </option>
              ))}
            </select>
          </div>
          <div className={memberFieldClass}>
            <label htmlFor={`${fieldId}-account-name`} className={memberLabelClass}>
              {tPanel("accountName")}
            </label>
            <input
              id={`${fieldId}-account-name`}
              required
              minLength={2}
              maxLength={120}
              readOnly={!showMethodForm}
              className={cn(memberInputClass, "mt-2", !showMethodForm && "opacity-80")}
              value={accountName}
              onChange={(event) => setAccountName(event.target.value)}
            />
          </div>
          <div className={memberFieldClass}>
            <label htmlFor={`${fieldId}-account-number`} className={memberLabelClass}>
              {tPanel("accountNumber")}
            </label>
            <input
              id={`${fieldId}-account-number`}
              required
              minLength={4}
              maxLength={120}
              inputMode="numeric"
              readOnly={!showMethodForm}
              className={cn(memberInputClass, "mt-2", !showMethodForm && "opacity-80")}
              value={accountNumber}
              onChange={(event) => setAccountNumber(event.target.value)}
            />
          </div>
          {method === "BANK" ? (
            <>
              <div className={memberFieldClass}>
                <label htmlFor={`${fieldId}-bank-name`} className={memberLabelClass}>
                  {tPanel("bankName")}
                </label>
                <input
                  id={`${fieldId}-bank-name`}
                  required
                  minLength={2}
                  maxLength={120}
                  readOnly={!showMethodForm}
                  className={cn(memberInputClass, "mt-2", !showMethodForm && "opacity-80")}
                  value={bankName}
                  onChange={(event) => setBankName(event.target.value)}
                />
              </div>
              <div className={memberFieldClass}>
                <label htmlFor={`${fieldId}-branch`} className={memberLabelClass}>
                  {tPanel("branch")}
                </label>
                <input
                  id={`${fieldId}-branch`}
                  required
                  minLength={2}
                  maxLength={120}
                  readOnly={!showMethodForm}
                  className={cn(memberInputClass, "mt-2", !showMethodForm && "opacity-80")}
                  value={branch}
                  onChange={(event) => setBranch(event.target.value)}
                />
              </div>
            </>
          ) : null}
        </div>

        {showMethodForm ? (
          <div className="mt-4 flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-muted-foreground">{tPanel("savedPaymentMethodsHint")}</p>
            <Button
              type="button"
              onClick={() => void saveMethod()}
              disabled={savingMethod || !label.trim()}
            >
              {savingMethod ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
              {savingMethod ? tPanel("savingMethod") : tPanel("saveMethod")}
            </Button>
          </div>
        ) : null}
      </section>

      <div className="mt-4 max-w-sm">
        <label htmlFor={`${fieldId}-note`} className={memberLabelClass}>
          {tPanel("note")} <span className="text-muted-foreground">({tCommon("optional")})</span>
        </label>
        <input
          id={`${fieldId}-note`}
          name="note"
          maxLength={300}
          className={`${memberInputClass} mt-2`}
        />
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

      <div className="mt-8 flex flex-col gap-3 border-t border-border pt-6 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-muted-foreground">{tPanel("statusNote")}</p>
        <Button
          type="submit"
          size="lg"
          disabled={pending || savingMethod || isNewMethod || pendingWithdrawal !== null}
        >
          {pending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
          {pending
            ? isPrincipal
              ? tPanel("requestingNotice")
              : tPanel("requesting")
            : isPrincipal
              ? tPanel("requestNotice")
              : tPanel("request")}
        </Button>
      </div>
      </form>

      {pendingWithdrawal ? (
        <TPinConfirmDialog
          open
          title={tPanel("tPinDialogTitle")}
          busy={pending}
          error={error}
          onClose={() => setPendingWithdrawal(null)}
          onConfirm={(pin) => void confirmWithdrawal(pin)}
        />
      ) : null}
    </>
  );
}
