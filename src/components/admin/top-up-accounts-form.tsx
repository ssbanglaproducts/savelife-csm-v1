"use client";

import { useId, useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { adminInputClass, adminLabelClass } from "@/components/admin/admin-ui";
import type { TopUpAccounts } from "@/lib/topup-accounts";
import {
  AdminConfigCommitDialog,
  type AdminConfigChange,
} from "./admin-config-commit-dialog";
import { useAdminAction } from "./use-admin-action";

export function TopUpAccountsForm({ initialAccounts }: { initialAccounts: TopUpAccounts }) {
  const t = useTranslations("adminPanel");
  const fieldId = useId();
  const { pending, run } = useAdminAction();
  const [accounts, setAccounts] = useState(initialAccounts);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [pendingChanges, setPendingChanges] = useState<AdminConfigChange[]>([]);
  const [error, setError] = useState<string | null>(null);

  function update(key: keyof TopUpAccounts, value: string) {
    setAccounts((current) => ({ ...current, [key]: value }));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPendingChanges([
      { label: t("topUpAccountBkash"), value: accounts.BKASH },
      { label: t("topUpAccountNagad"), value: accounts.NAGAD },
      { label: t("topUpAccountBank"), value: accounts.BANK },
    ]);
    setReviewOpen(true);
  }

  async function commit(password: string) {
    const ok = await run(
      "/api/admin/top-up-accounts",
      "PATCH",
      {
        bkash: accounts.BKASH,
        nagad: accounts.NAGAD,
        bank: accounts.BANK,
        adminPassword: password,
      },
      { INVALID_ADMIN_PASSWORD: t("configInvalidPassword") },
      setError,
    );
    if (ok) {
      setReviewOpen(false);
      setError(null);
    }
    return ok;
  }

  return (
    <form onSubmit={handleSubmit} className="glass space-y-4 rounded-2xl p-4 sm:p-5">
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label htmlFor={`${fieldId}-bkash`} className={adminLabelClass}>
            {t("topUpAccountBkash")}
          </label>
          <input
            id={`${fieldId}-bkash`}
            value={accounts.BKASH}
            onChange={(event) => update("BKASH", event.target.value)}
            maxLength={200}
            className={`${adminInputClass} mt-2`}
            translate="no"
          />
        </div>
        <div>
          <label htmlFor={`${fieldId}-nagad`} className={adminLabelClass}>
            {t("topUpAccountNagad")}
          </label>
          <input
            id={`${fieldId}-nagad`}
            value={accounts.NAGAD}
            onChange={(event) => update("NAGAD", event.target.value)}
            maxLength={200}
            className={`${adminInputClass} mt-2`}
            translate="no"
          />
        </div>
        <div>
          <label htmlFor={`${fieldId}-bank`} className={adminLabelClass}>
            {t("topUpAccountBank")}
          </label>
          <input
            id={`${fieldId}-bank`}
            value={accounts.BANK}
            onChange={(event) => update("BANK", event.target.value)}
            maxLength={200}
            className={`${adminInputClass} mt-2`}
            translate="no"
          />
        </div>
      </div>
      <div className="flex justify-end">
        <Button type="submit" disabled={pending}>
          {pending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
          {pending ? t("topUpAccountsSaving") : t("topUpAccountsSave")}
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
