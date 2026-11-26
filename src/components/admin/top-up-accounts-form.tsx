"use client";

import { useId, useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { adminInputClass, adminLabelClass } from "@/components/admin/admin-ui";
import type { TopUpAccounts } from "@/lib/topup-accounts";
import { AdminFormDialog } from "./admin-form-dialog";
import { useAdminAction } from "./use-admin-action";

export function TopUpAccountsForm({ initialAccounts }: { initialAccounts: TopUpAccounts }) {
  const t = useTranslations("adminPanel");
  const fieldId = useId();
  const { pending, run } = useAdminAction();
  const [showForm, setShowForm] = useState(false);
  const [accounts, setAccounts] = useState(initialAccounts);

  function update(key: keyof TopUpAccounts, value: string) {
    setAccounts((current) => ({ ...current, [key]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const ok = await run("/api/admin/top-up-accounts", "PATCH", {
      bkash: accounts.BKASH,
      nagad: accounts.NAGAD,
      bank: accounts.BANK,
    });
    if (ok) setShowForm(false);
  }

  if (!showForm) {
    return (
      <div className="flex justify-end">
        <Button type="button" onClick={() => setShowForm(true)}>
          {t("topUpAccountsTitle")}
        </Button>
      </div>
    );
  }

  return (
    <AdminFormDialog
      title={t("topUpAccountsTitle")}
      intro={t("topUpAccountsIntro")}
      onClose={() => setShowForm(false)}
    >
    <form onSubmit={handleSubmit} className="space-y-4">
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
      <div className="mt-5 flex justify-end">
        <Button type="submit" disabled={pending}>
          {pending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
          {pending ? t("topUpAccountsSaving") : t("topUpAccountsSave")}
        </Button>
      </div>
    </form>
    </AdminFormDialog>
  );
}
