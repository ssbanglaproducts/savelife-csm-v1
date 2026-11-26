"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";
import { Loader2, ShieldCheck, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { memberInputClass, memberLabelClass } from "./form-styles";

/**
 * Shared T-PIN prompt. Action forms collect their details first, then open
 * this dialog when the submit button is pressed.
 */
export function TPinConfirmDialog({
  open,
  title,
  hint,
  busy,
  error,
  onClose,
  onConfirm,
}: {
  open: boolean;
  title: string;
  hint?: string;
  busy: boolean;
  error?: string | null;
  onClose: () => void;
  onConfirm: (tPin: string) => void | Promise<void>;
}) {
  const tc = useTranslations("common");
  const tPanel = useTranslations("memberPanel");
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const [tPin, setTPin] = useState("");

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panelRef.current?.querySelector<HTMLInputElement>("[data-tpin-autofocus]")?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) {
        event.preventDefault();
        onClose();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, busy, onClose]);

  if (!open || typeof document === "undefined") return null;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || tPin.length !== 6) return;
    void onConfirm(tPin);
  }

  return createPortal(
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 cursor-default bg-black/45 backdrop-blur-sm"
        aria-label={tc("cancel")}
        disabled={busy}
        onClick={onClose}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative w-full max-w-md overflow-hidden rounded-3xl border border-border bg-[var(--card-solid)] p-6 shadow-2xl"
      >
        <button
          type="button"
          onClick={onClose}
          disabled={busy}
          aria-label={tc("cancel")}
          className="absolute right-4 top-4 rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
        >
          <X className="size-4" aria-hidden="true" />
        </button>

        <span className="flex size-12 items-center justify-center rounded-2xl bg-primary/15 text-primary ring-1 ring-primary/25">
          <ShieldCheck className="size-6" aria-hidden="true" />
        </span>
        <h2 id={titleId} className="mt-4 font-display text-xl font-bold">
          {title}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">{hint ?? tPanel("tPinHint")}</p>

        <form onSubmit={handleSubmit} className="mt-5">
          <label htmlFor="tpin-confirm-input" className={memberLabelClass}>
            {tPanel("tPinDialogLabel")}
          </label>
          <input
            id="tpin-confirm-input"
            data-tpin-autofocus
            type="password"
            required
            inputMode="numeric"
            autoComplete="off"
            maxLength={6}
            pattern="[0-9]{6}"
            value={tPin}
            onChange={(event) => setTPin(event.target.value.replace(/\D/g, "").slice(0, 6))}
            className={`${memberInputClass} mt-2 text-center font-mono text-lg tracking-[0.4em]`}
          />

          {error ? (
            <p role="alert" className="mt-3 rounded-xl border border-red-500/25 bg-red-500/10 px-3 py-2 text-sm text-red-500">
              {error}
            </p>
          ) : null}

          <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button type="button" variant="ghost" onClick={onClose} disabled={busy}>
              {tc("cancel")}
            </Button>
            <Button type="submit" size="lg" disabled={busy || tPin.length !== 6}>
              {busy ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
              {busy ? tPanel("confirming") : tc("confirm")}
            </Button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}
