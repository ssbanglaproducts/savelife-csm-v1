"use client";

import { useEffect, useId, useState } from "react";
import { useTranslations } from "next-intl";
import { Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DialogShell } from "@/components/ui/dialog-shell";
import { adminLabelClass, adminInputClass } from "./admin-ui";

const REVIEW_SECONDS = 10;

export type AdminConfigChange = {
  label: string;
  value: string;
};

/**
 * Two-stage authorization gate for live configuration changes. Stage one shows
 * the exact values with a short review period; stage two requires the current
 * administrator password. The save request stays with the caller and is only
 * made after stage two is accepted.
 */
export function AdminConfigCommitDialog({
  onClose,
  changes,
  pending,
  error,
  onClearError,
  onCommit,
}: {
  onClose: () => void;
  changes: readonly AdminConfigChange[];
  pending: boolean;
  error?: string | null;
  onClearError?: () => void;
  onCommit: (password: string) => Promise<boolean>;
}) {
  const t = useTranslations("adminPanel");
  const tc = useTranslations("common");
  const reviewTitleId = useId();
  const finalTitleId = useId();
  const passwordId = useId();
  const [stage, setStage] = useState<"review" | "final">("review");
  const [countdown, setCountdown] = useState(REVIEW_SECONDS);
  const [password, setPassword] = useState("");

  useEffect(() => {
    if (stage !== "review") return;
    const startedAt = Date.now();
    const timer = window.setInterval(() => {
      const remaining = Math.max(
        0,
        REVIEW_SECONDS - Math.floor((Date.now() - startedAt) / 1000),
      );
      setCountdown(remaining);
      if (remaining === 0) window.clearInterval(timer);
    }, 100);
    return () => window.clearInterval(timer);
  }, [stage]);

  function confirmReview(): void {
    if (countdown > 0) return;
    setStage("final");
    setPassword("");
  }

  function goBack(): void {
    onClearError?.();
    setPassword("");
    setCountdown(REVIEW_SECONDS);
    setStage("review");
  }

  return (
    <>
      {stage === "review" ? (
        <DialogShell
          title={t("configReviewTitle")}
          intro={t("configReviewIntro")}
          titleId={reviewTitleId}
          onClose={onClose}
        >
          <div className="space-y-4">
            <div className="divide-y divide-border overflow-hidden rounded-xl border border-border">
              {changes.map((change) => (
                <div
                  key={change.label}
                  className="flex flex-wrap items-baseline justify-between gap-2 px-3 py-2.5 text-sm"
                >
                  <span className="font-semibold text-muted-foreground">{change.label}</span>
                  <span
                    className="min-w-0 break-words text-right font-semibold tabular-nums"
                    translate="no"
                  >
                    {change.value}
                  </span>
                </div>
              ))}
            </div>
            <div
              className={
                countdown > 0
                  ? "rounded-xl bg-amber-500/15 px-3 py-2 text-sm font-semibold text-amber-700"
                  : "rounded-xl bg-emerald-500/15 px-3 py-2 text-sm font-semibold text-emerald-700"
              }
              aria-live="polite"
            >
              {countdown > 0
                ? t("configReviewCountdown", { seconds: countdown })
                : t("configReviewReady")}
            </div>
            <p className="text-xs leading-relaxed text-muted-foreground">{t("configReviewNote")}</p>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={onClose} disabled={pending}>
                {tc("cancel")}
              </Button>
              <Button type="button" disabled={countdown > 0} onClick={confirmReview}>
                {t("configConfirmChanges")}
              </Button>
            </div>
          </div>
        </DialogShell>
      ) : null}

      {stage === "final" ? (
        <DialogShell
          title={t("configFinalTitle")}
          intro={t("configFinalIntro")}
          titleId={finalTitleId}
          onClose={onClose}
        >
          <div className="space-y-4">
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3">
              <div className="flex items-center gap-2 text-sm font-bold text-red-700">
                <ShieldCheck className="size-4" aria-hidden="true" />
                {t("configFinalWarningTitle")}
              </div>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-xs leading-relaxed text-red-700">
                <li>{t("configFinalWarning1")}</li>
                <li>{t("configFinalWarning2")}</li>
                <li>{t("configFinalWarning3")}</li>
              </ul>
            </div>

            <div className="space-y-1.5">
              <label htmlFor={passwordId} className={adminLabelClass}>
                {t("configAdminPassword")}
              </label>
              <input
                id={passwordId}
                type="password"
                autoComplete="current-password"
                data-dialog-autofocus
                className={adminInputClass}
                value={password}
                onChange={(event) => {
                  setPassword(event.target.value);
                  onClearError?.();
                }}
              />
            </div>
            {error ? (
              <p role="alert" className="text-sm font-semibold text-red-600">
                {error}
              </p>
            ) : null}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={goBack} disabled={pending}>
                {t("configGoBack")}
              </Button>
              <Button
                type="button"
                variant="destructive"
                disabled={pending || !password}
                onClick={() => void onCommit(password)}
              >
                {pending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
                {pending ? t("configCommitting") : t("configConfirmCommit")}
              </Button>
            </div>
          </div>
        </DialogShell>
      ) : null}
    </>
  );
}
