"use client";

import { useId, useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { KeyRound, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { memberInputClass, memberLabelClass } from "./form-styles";

const pinClass = `${memberInputClass} text-center font-mono text-lg tracking-[0.4em]`;

export function TPinResetForm() {
  const t = useTranslations("auth");
  const tc = useTranslations("common");
  const fieldId = useId();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const currentPassword = String(form.get("currentPassword") ?? "");
    const newTPin = String(form.get("newTPin") ?? "");
    const confirmTPin = String(form.get("confirmTPin") ?? "");

    setPending(true);
    setError(null);
    setSaved(false);
    try {
      const response = await fetch("/api/member/tpin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newTPin, confirmTPin }),
      });
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        const messages: Record<string, string> = {
          INVALID_PASSWORD: t("invalidPassword"),
          TPIN_MISMATCH: t("tPinMismatch"),
          INVALID_TPIN: t("tPinMismatch"),
          TPIN_UNCHANGED: t("tPinUnchanged"),
        };
        setError(messages[data.error ?? ""] ?? tc("error"));
        return;
      }
      formElement.reset();
      setSaved(true);
      toast.success(t("tPinUpdated"));
    } catch {
      setError(tc("error"));
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="glass min-w-0 rounded-3xl p-6 shadow-xl sm:p-8">
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
          <ShieldCheck className="size-5" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <h2 className="font-display text-lg font-bold">{t("tPinResetTitle")}</h2>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{t("tPinResetIntro")}</p>
        </div>
      </div>

      <div className="mt-6 max-w-md">
        <label htmlFor={`${fieldId}-password`} className={memberLabelClass}>
          {t("accountPassword")}
        </label>
        <input
          id={`${fieldId}-password`}
          name="currentPassword"
          type="password"
          required
          autoComplete="current-password"
          className={`${memberInputClass} mt-2`}
        />
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor={`${fieldId}-new`} className={memberLabelClass}>
            {t("newTPin")}
          </label>
          <input
            id={`${fieldId}-new`}
            name="newTPin"
            type="password"
            inputMode="numeric"
            pattern="[0-9]{6}"
            maxLength={6}
            required
            autoComplete="off"
            className={`${pinClass} mt-2`}
          />
        </div>
        <div>
          <label htmlFor={`${fieldId}-confirm`} className={memberLabelClass}>
            {t("confirmTPin")}
          </label>
          <input
            id={`${fieldId}-confirm`}
            name="confirmTPin"
            type="password"
            inputMode="numeric"
            pattern="[0-9]{6}"
            maxLength={6}
            required
            autoComplete="off"
            className={`${pinClass} mt-2`}
          />
        </div>
      </div>

      <p className="mt-2 text-xs text-muted-foreground">{t("tPinLengthHint")}</p>

      {error ? (
        <p role="alert" className="mt-5 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-500">
          {error}
        </p>
      ) : null}
      {saved ? (
        <p role="status" className="mt-5 rounded-xl border border-primary/30 bg-primary/10 px-4 py-3 text-sm text-primary">
          {t("tPinUpdated")}
        </p>
      ) : null}

      <div className="mt-6 flex justify-end">
        <Button type="submit" size="lg" disabled={pending}>
          {pending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <KeyRound className="size-4" aria-hidden="true" />}
          {t("updateTPin")}
        </Button>
      </div>
    </form>
  );
}
