"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

/** Accessible modal shell shared by purchase and activation dialogs. */
export function DialogShell({
  title,
  intro,
  onClose,
  titleId,
  busy = false,
  shellClassName,
  panelClassName,
  children,
}: {
  title: string;
  intro: string;
  onClose: () => void;
  titleId?: string;
  /** While true, Escape, overlay and close-button dismissal are ignored. */
  busy?: boolean;
  shellClassName?: string;
  panelClassName?: string;
  children: ReactNode;
}) {
  const tc = useTranslations("common");
  const generatedTitleId = useId();
  const resolvedTitleId = titleId ?? generatedTitleId;
  const panelRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  const busyRef = useRef(busy);
  const triggerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    busyRef.current = busy;
  }, [busy]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    triggerRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;

    const contentFocusTarget = contentRef.current?.querySelector<HTMLElement>(
      "[data-dialog-autofocus]",
    );
    const focusTarget =
      contentFocusTarget ??
      panelRef.current?.querySelector<HTMLElement>("[data-dialog-autofocus]") ??
      panelRef.current;
    focusTarget?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        if (!busyRef.current) onCloseRef.current();
        return;
      }

      if (event.key !== "Tab") return;
      const panel = panelRef.current;
      if (!panel) return;
      const focusables = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
        (element) => element.getClientRects().length > 0,
      );
      if (focusables.length === 0) {
        event.preventDefault();
        panel.focus();
        return;
      }

      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement;
      if (!active || !panel.contains(active)) {
        event.preventDefault();
        first.focus();
      } else if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
      const trigger = triggerRef.current;
      if (trigger?.isConnected) trigger.focus();
    };
  }, []);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className={cn(
        "fixed inset-0 z-[80] flex items-center justify-center p-4",
        shellClassName,
      )}
    >
      <div
        aria-hidden="true"
        tabIndex={-1}
        className="absolute inset-0 cursor-default bg-black/45 backdrop-blur-sm"
        onClick={() => {
          if (!busy) onClose();
        }}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={resolvedTitleId}
        tabIndex={-1}
        className={cn(
          "relative flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-3xl border border-border bg-[var(--card-solid)] shadow-2xl",
          panelClassName,
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4 sm:px-6">
          <div className="min-w-0">
            <h2 id={resolvedTitleId} className="font-display text-lg font-bold">
              {title}
            </h2>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{intro}</p>
          </div>
          <button
            type="button"
            data-dialog-autofocus
            onClick={() => {
              if (!busy) onClose();
            }}
            aria-label={tc("cancel")}
            aria-disabled={busy || undefined}
            className="shrink-0 rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>
        <div ref={contentRef} className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">
          {children}
        </div>
      </div>
    </div>,
    document.body,
  );
}
