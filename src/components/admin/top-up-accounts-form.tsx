"use client";

import { useId, useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { adminInputClass, adminLabelClass } from "@/components/admin/admin-ui";
import {
  formatTopUpAccount,
  TOP_UP_ACCOUNT_KINDS,
  TOP_UP_METHODS,
  type TopUpAccountEntry,
  type TopUpAccountKind,
  type TopUpAccountSettings,
  type TopUpMethod,
} from "@/lib/topup-accounts";
import {
  AdminConfigCommitDialog,
  type AdminConfigChange,
} from "./admin-config-commit-dialog";
import { useAdminAction } from "./use-admin-action";

function newEntry(): TopUpAccountEntry {
  const suffix =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().slice(0, 8).replace(/-/g, "")
      : `${Date.now()}`;
  return {
    id: `entry-${suffix}`,
    method: "BKASH",
    kind: "PERSONAL",
    label: "",
    accountName: "",
    accountNumber: "",
    bankName: "",
    branch: "",
    routing: "",
    ifsc: "",
    swift: "",
  };
}

export function TopUpAccountsForm({
  initialSettings,
}: {
  initialSettings: TopUpAccountSettings;
}) {
  const t = useTranslations("adminPanel");
  const fieldId = useId();
  const { pending, run } = useAdminAction();
  const [settings, setSettings] = useState(initialSettings);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [pendingChanges, setPendingChanges] = useState<AdminConfigChange[]>([]);
  const [error, setError] = useState<string | null>(null);

  function updateEntry(id: string, patch: Partial<TopUpAccountEntry>) {
    setSettings((current) => ({
      ...current,
      entries: current.entries.map((entry) =>
        entry.id === id ? { ...entry, ...patch } : entry,
      ),
    }));
  }

  function addEntry() {
    setSettings((current) => ({ ...current, entries: [...current.entries, newEntry()] }));
  }

  function removeEntry(id: string) {
    setSettings((current) => ({
      ...current,
      entries: current.entries.filter((entry) => entry.id !== id),
    }));
  }

  function methodLabel(method: TopUpMethod) {
    return method === "BKASH"
      ? t("topUpAccountBkash")
      : method === "NAGAD"
        ? t("topUpAccountNagad")
        : t("topUpAccountBank");
  }

  function entryLabel(entry: TopUpAccountEntry, index: number) {
    const base = entry.label.trim() || methodLabel(entry.method);
    return `${base} #${index + 1}`;
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPendingChanges(
      settings.entries.map((entry, index) => ({
        label: entryLabel(entry, index),
        value: formatTopUpAccount(entry) || t("authBannerVideoNone"),
      })),
    );
    setReviewOpen(true);
  }

  async function commit(password: string) {
    const ok = await run(
      "/api/admin/top-up-accounts",
      "PATCH",
      {
        bkash: settings.BKASH,
        nagad: settings.NAGAD,
        bank: settings.BANK,
        entries: settings.entries,
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
      <div className="space-y-4">
        {settings.entries.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
            {t("topUpAccountsNoEntries")}
          </p>
        ) : null}

        {settings.entries.map((entry, index) => {
          const isBank = entry.method === "BANK";
          return (
            <fieldset
              key={entry.id}
              className="space-y-3 rounded-2xl border border-border bg-[var(--glass)] p-3 sm:p-4"
            >
              <legend className="px-1 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                {entryLabel(entry, index)}
              </legend>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <div>
                  <label htmlFor={`${fieldId}-${entry.id}-method`} className={adminLabelClass}>
                    {t("topUpAccountMethod")}
                  </label>
                  <select
                    id={`${fieldId}-${entry.id}-method`}
                    value={entry.method}
                    onChange={(event) =>
                      updateEntry(entry.id, {
                        method: event.target.value as TopUpMethod,
                        kind: event.target.value === "BANK" ? null : (entry.kind ?? "PERSONAL"),
                      })
                    }
                    className={`${adminInputClass} mt-1.5`}
                  >
                    {TOP_UP_METHODS.map((method) => (
                      <option key={method} value={method}>
                        {methodLabel(method)}
                      </option>
                    ))}
                  </select>
                </div>
                {!isBank ? (
                  <div>
                    <label htmlFor={`${fieldId}-${entry.id}-kind`} className={adminLabelClass}>
                      {t("topUpAccountKind")}
                    </label>
                    <select
                      id={`${fieldId}-${entry.id}-kind`}
                      value={entry.kind ?? "PERSONAL"}
                      onChange={(event) =>
                        updateEntry(entry.id, {
                          kind: event.target.value as TopUpAccountKind,
                        })
                      }
                      className={`${adminInputClass} mt-1.5`}
                    >
                      {TOP_UP_ACCOUNT_KINDS.map((kind) => (
                        <option key={kind} value={kind}>
                          {t(kind === "PERSONAL" ? "topUpAccountKindPersonal" : "topUpAccountKindAgent")}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : null}
                <div>
                  <label htmlFor={`${fieldId}-${entry.id}-label`} className={adminLabelClass}>
                    {t("topUpAccountLabel")}
                  </label>
                  <input
                    id={`${fieldId}-${entry.id}-label`}
                    value={entry.label}
                    maxLength={80}
                    onChange={(event) => updateEntry(entry.id, { label: event.target.value })}
                    className={`${adminInputClass} mt-1.5`}
                  />
                </div>
                <div>
                  <label htmlFor={`${fieldId}-${entry.id}-name`} className={adminLabelClass}>
                    {t("topUpAccountName")}
                  </label>
                  <input
                    id={`${fieldId}-${entry.id}-name`}
                    value={entry.accountName}
                    maxLength={120}
                    onChange={(event) => updateEntry(entry.id, { accountName: event.target.value })}
                    className={`${adminInputClass} mt-1.5`}
                    translate="no"
                  />
                </div>
                <div>
                  <label htmlFor={`${fieldId}-${entry.id}-number`} className={adminLabelClass}>
                    {t("topUpAccountNumber")}
                  </label>
                  <input
                    id={`${fieldId}-${entry.id}-number`}
                    value={entry.accountNumber}
                    required
                    maxLength={200}
                    onChange={(event) => updateEntry(entry.id, { accountNumber: event.target.value })}
                    className={`${adminInputClass} mt-1.5`}
                    translate="no"
                  />
                </div>
                {isBank ? (
                  <>
                    <div>
                      <label htmlFor={`${fieldId}-${entry.id}-bank`} className={adminLabelClass}>
                        {t("topUpAccountBankName")}
                      </label>
                      <input
                        id={`${fieldId}-${entry.id}-bank`}
                        value={entry.bankName}
                        required
                        maxLength={120}
                        onChange={(event) => updateEntry(entry.id, { bankName: event.target.value })}
                        className={`${adminInputClass} mt-1.5`}
                      />
                    </div>
                    <div>
                      <label htmlFor={`${fieldId}-${entry.id}-branch`} className={adminLabelClass}>
                        {t("topUpAccountBranch")}
                      </label>
                      <input
                        id={`${fieldId}-${entry.id}-branch`}
                        value={entry.branch}
                        required
                        maxLength={120}
                        onChange={(event) => updateEntry(entry.id, { branch: event.target.value })}
                        className={`${adminInputClass} mt-1.5`}
                      />
                    </div>
                    <div>
                      <label htmlFor={`${fieldId}-${entry.id}-routing`} className={adminLabelClass}>
                        {t("topUpAccountRouting")}
                      </label>
                      <input
                        id={`${fieldId}-${entry.id}-routing`}
                        value={entry.routing}
                        maxLength={120}
                        onChange={(event) => updateEntry(entry.id, { routing: event.target.value })}
                        className={`${adminInputClass} mt-1.5`}
                      />
                    </div>
                    <div>
                      <label htmlFor={`${fieldId}-${entry.id}-ifsc`} className={adminLabelClass}>
                        {t("topUpAccountIfsc")}
                      </label>
                      <input
                        id={`${fieldId}-${entry.id}-ifsc`}
                        value={entry.ifsc}
                        maxLength={120}
                        onChange={(event) => updateEntry(entry.id, { ifsc: event.target.value })}
                        className={`${adminInputClass} mt-1.5`}
                      />
                    </div>
                    <div>
                      <label htmlFor={`${fieldId}-${entry.id}-swift`} className={adminLabelClass}>
                        {t("topUpAccountSwift")}
                      </label>
                      <input
                        id={`${fieldId}-${entry.id}-swift`}
                        value={entry.swift}
                        maxLength={120}
                        onChange={(event) => updateEntry(entry.id, { swift: event.target.value })}
                        className={`${adminInputClass} mt-1.5`}
                      />
                    </div>
                  </>
                ) : null}
              </div>
              <div className="flex justify-end">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeEntry(entry.id)}
                >
                  <Trash2 className="size-4" aria-hidden="true" />
                  {t("topUpAccountRemove")}
                </Button>
              </div>
            </fieldset>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button type="button" variant="outline" onClick={addEntry} disabled={settings.entries.length >= 30}>
          <Plus className="size-4" aria-hidden="true" />
          {t("topUpAccountAdd")}
        </Button>
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
