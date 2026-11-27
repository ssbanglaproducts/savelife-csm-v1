"use client";

import { useId, useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { percentToBps } from "@/lib/rates";
import {
  AdminConfigCommitDialog,
  type AdminConfigChange,
} from "./admin-config-commit-dialog";
import { adminInputClass, adminLabelClass } from "./admin-ui";
import { useAdminAction } from "./use-admin-action";

type DistributionRecipient = {
  memberId: string;
  memberNo: string;
  name: string;
  eligible: string;
  receiving: string;
};

type DistributionPreview = {
  distributable: string;
  totalEligible: string;
  profitPerThousand: string;
  totalReceiving: string;
  recipients: DistributionRecipient[];
};

export function DistributionForm() {
  const t = useTranslations("adminPanel");
  const tc = useTranslations("common");
  const fieldId = useId();
  const { pending: posting, run } = useAdminAction();
  const [amount, setAmount] = useState("");
  const [preview, setPreview] = useState<DistributionPreview | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPreviewing(true);
    try {
      const response = await fetch("/api/admin/distributions/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount }),
      });
      const data = await response.json();
      if (!response.ok) {
        const message =
          data.error === "NO_ELIGIBLE_INVESTMENTS" ? t("noEligibleInvestments") : t("previewFailed");
        setError(message);
        toast.error(message);
        return;
      }
      setPreview(data as DistributionPreview);
    } catch {
      const message = t("previewFailed");
      setError(message);
      toast.error(message);
    } finally {
      setPreviewing(false);
    }
  }

  async function confirmPost() {
    const ok = await run(
      "/api/admin/distributions",
      "POST",
      { amount },
      { NO_ELIGIBLE_INVESTMENTS: t("noEligibleInvestments") },
      setError,
    );
    if (ok) {
      setPreview(null);
      setAmount("");
      setError(null);
    }
  }

  return (
    <div className="glass rounded-2xl p-4 sm:p-5">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-[minmax(0,16rem)_auto] sm:items-end">
          <div>
            <label htmlFor={`${fieldId}-amount`} className={adminLabelClass}>
              {tc("amount")} (SP)
            </label>
            <input
              id={`${fieldId}-amount`}
              name="amount"
              type="text"
              inputMode="decimal"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              required
              pattern="\d+(\.\d{1,2})?"
              title="0.00"
              className={`${adminInputClass} mt-2`}
              placeholder="0.00"
            />
          </div>
          <Button type="submit" disabled={previewing || !amount}>
            {previewing ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
            {previewing ? t("previewLoading") : t("previewDistribution")}
          </Button>
        </div>
        {error ? <p className="text-sm text-red-500">{error}</p> : null}
      </form>

      {preview ? (
        <div className="mt-5 border-t border-border pt-5">
          <div className="grid gap-2 rounded-xl bg-[var(--glass)] p-3 text-xs sm:grid-cols-3">
            <p>
              <span className="text-muted-foreground">{t("eligible")}: </span>
              <span className="font-semibold tabular-nums">{preview.totalEligible}</span>
            </p>
            <p>
              <span className="text-muted-foreground">{tc("amount")}: </span>
              <span className="font-semibold tabular-nums">{preview.distributable}</span>
            </p>
            <p>
              <span className="text-muted-foreground">{t("profitPerThousand")}: </span>
              <span className="font-semibold tabular-nums">{preview.profitPerThousand}</span>
            </p>
          </div>

          <div className="mt-4 max-h-[45vh] overflow-y-auto rounded-xl border border-border">
            <table className="w-full border-collapse text-left text-sm">
              <thead className="sticky top-0 bg-[var(--glass-strong)] text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th scope="col" className="px-3 py-2">
                    {t("recipient")}
                  </th>
                  <th scope="col" className="px-3 py-2 text-right">
                    {t("eligibleCapital")}
                  </th>
                  <th scope="col" className="px-3 py-2 text-right">
                    {t("receiving")}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {preview.recipients.map((recipient) => (
                  <tr key={recipient.memberId}>
                    <td className="px-3 py-2">
                      <span className="font-medium">{recipient.name}</span>
                      <span className="ml-2 font-mono text-xs text-muted-foreground">
                        {recipient.memberNo}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">
                      {recipient.eligible}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-right font-semibold tabular-nums">
                      {recipient.receiving}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
            <p className="text-sm font-semibold tabular-nums">
              {t("totalReceiving")}: {preview.totalReceiving}
            </p>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setPreview(null)}
                disabled={posting}
              >
                {tc("cancel")}
              </Button>
              <Button type="button" onClick={confirmPost} disabled={posting}>
                {posting ? tc("saving") : tc("confirm")}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export type SettingsDefaults = {
  installmentDurationMonths: number;
  profitOnlyLockInMonths: number;
  /** Percent deducted from a withdrawal: 10 = 10%. */
  withdrawalFeePercent: number;
  minWithdrawal: string;
};

export function SettingsForm({
  version,
  defaults,
}: {
  version: number;
  defaults: SettingsDefaults;
}) {
  const t = useTranslations("adminPanel");
  const fieldId = useId();
  const { pending, run } = useAdminAction();
  const [reviewOpen, setReviewOpen] = useState(false);
  const [pendingPayload, setPendingPayload] = useState<Record<string, unknown> | null>(null);
  const [pendingChanges, setPendingChanges] = useState<AdminConfigChange[]>([]);
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const data = new FormData(event.currentTarget);
    const installmentDurationMonths = Number(data.get("installmentDurationMonths"));
    const profitOnlyLockInMonths = Number(data.get("profitOnlyLockInMonths"));
    const withdrawalFeePercent = Number(data.get("withdrawalFeePercent"));
    const minWithdrawal = String(data.get("minWithdrawal") ?? "");
    setPendingPayload({
      installmentDurationMonths,
      profitOnlyLockInMonths,
      withdrawalFeeBps: percentToBps(withdrawalFeePercent),
      minWithdrawal,
    });
    setPendingChanges([
      { label: t("version"), value: String(version) },
      { label: t("installmentMonths"), value: String(installmentDurationMonths) },
      { label: t("capitalRepayment"), value: t("capitalOnly") },
      { label: t("lockInMonths"), value: String(profitOnlyLockInMonths) },
      { label: t("withdrawalFeePercent"), value: `${withdrawalFeePercent}%` },
      { label: t("minWithdrawal"), value: minWithdrawal },
    ]);
    setReviewOpen(true);
  }

  async function commit(password: string) {
    if (!pendingPayload) return false;
    const ok = await run(
      "/api/admin/settings",
      "POST",
      { ...pendingPayload, adminPassword: password },
      {
        INVALID_ADMIN_PASSWORD: t("configInvalidPassword"),
        VERSION_EXISTS: t("versionExists"),
        SETTINGS_FAILED: t("invalidState"),
        "Invalid request": t("invalidState"),
      },
      setError,
    );
    if (ok) {
      setReviewOpen(false);
      setPendingPayload(null);
      setError(null);
    }
    return ok;
  }

  return (
    <form onSubmit={handleSubmit} className="glass space-y-4 rounded-2xl p-4 sm:p-5">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <div>
          <span className={adminLabelClass}>{t("version")}</span>
          <output className={`${adminInputClass} mt-2 flex items-center`}>{version}</output>
        </div>
        <div>
          <label htmlFor={`${fieldId}-duration`} className={adminLabelClass}>
            {t("installmentMonths")}
          </label>
          <input
            id={`${fieldId}-duration`}
            name="installmentDurationMonths"
            type="number"
            min={1}
            max={120}
            required
            defaultValue={defaults.installmentDurationMonths}
            className={`${adminInputClass} mt-2`}
          />
        </div>
        <div>
          <span className={adminLabelClass}>{t("capitalRepayment")}</span>
          <output className={`${adminInputClass} mt-2 flex items-center`}>
            {t("capitalOnly")}
          </output>
          <p className="mt-1 text-xs text-muted-foreground">{t("capitalOnlyNote")}</p>
        </div>
        <div>
          <label htmlFor={`${fieldId}-lockin`} className={adminLabelClass}>
            {t("lockInMonths")}
          </label>
          <input
            id={`${fieldId}-lockin`}
            name="profitOnlyLockInMonths"
            type="number"
            min={1}
            max={120}
            required
            defaultValue={defaults.profitOnlyLockInMonths}
            className={`${adminInputClass} mt-2`}
          />
        </div>
        <div>
          <label htmlFor={`${fieldId}-fee`} className={adminLabelClass}>
            {t("withdrawalFeePercent")}
          </label>
          <input
            id={`${fieldId}-fee`}
            name="withdrawalFeePercent"
            type="number"
            min={0}
            max={50}
            step="0.01"
            required
            defaultValue={defaults.withdrawalFeePercent}
            className={`${adminInputClass} mt-2`}
          />
        </div>
        <div>
          <label htmlFor={`${fieldId}-min`} className={adminLabelClass}>
            {t("minWithdrawal")}
          </label>
          <input
            id={`${fieldId}-min`}
            name="minWithdrawal"
            type="text"
            inputMode="decimal"
            required
            pattern="\d+(\.\d{1,2})?"
            title="0.00"
            defaultValue={defaults.minWithdrawal}
            className={`${adminInputClass} mt-2`}
          />
        </div>
      </div>
      <div className="flex justify-end">
        <Button type="submit" disabled={pending}>
          {pending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
          {t("createVersion")}
        </Button>
      </div>

      {reviewOpen ? (
        <AdminConfigCommitDialog
          onClose={() => setReviewOpen(false)}
          changes={pendingChanges}
          pending={pending}
          error={error}
          onClearError={() => setError(null)}
          onCommit={commit}
        />
      ) : null}
    </form>
  );
}
