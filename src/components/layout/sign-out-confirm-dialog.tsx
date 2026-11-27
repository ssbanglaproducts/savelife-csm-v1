"use client";

import { useEffect, useId } from "react";
import { createPortal } from "react-dom";
import { LogOut } from "lucide-react";
import { signOut } from "next-auth/react";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

/** Final confirmation for every sign-out affordance in the app. */
export function SignOutConfirmDialog({
  open,
  onCancel,
}: {
  open: boolean;
  onCancel: () => void;
}) {
  const t = useTranslations("nav");
  const tc = useTranslations("common");
  const locale = useLocale();
  const titleId = useId();

  useEffect(() => {
    if (!open) return;

    const dialog = document.getElementById(titleId)?.closest<HTMLElement>("[role='dialog']");
    dialog?.querySelector<HTMLElement>("[data-signout-autofocus]")?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCancel();
        return;
      }
      if (event.key !== "Tab") return;

      const buttons = dialog?.querySelectorAll<HTMLElement>("button:not([disabled])");
      if (!buttons?.length) return;
      const first = buttons[0];
      const last = buttons[buttons.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onCancel, titleId]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      <button
        type="button"
        tabIndex={-1}
        aria-label={tc("cancel")}
        onClick={onCancel}
        className="absolute inset-0 size-full cursor-default bg-black/45 backdrop-blur-sm"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative w-full max-w-sm rounded-3xl border border-destructive/30 bg-[var(--card-solid)] p-6 shadow-2xl"
      >
        <span className="flex size-11 items-center justify-center rounded-2xl bg-red-500/10 text-red-500">
          <LogOut className="size-5" aria-hidden="true" />
        </span>
        <h2 id={titleId} className="mt-4 font-display text-lg font-bold">
          {t("logoutConfirmTitle")}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          {t("logoutConfirmBody")}
        </p>
        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <Button type="button" variant="outline" onClick={onCancel} data-signout-autofocus>
            {tc("cancel")}
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={() => {
              const adminArea = window.location.pathname.startsWith(`/${locale}/admin`);
              void signOut({
                callbackUrl: adminArea ? `/${locale}/admin-login` : `/${locale}/login`,
              });
            }}
          >
            {t("logoutConfirmAction")}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
