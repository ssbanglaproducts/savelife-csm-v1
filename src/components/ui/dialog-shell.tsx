"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

/** Accessible modal shell shared by purchase and activation dialogs. */
export function DialogShell({
  title,
  intro,
  onClose,
  titleId,
  shellClassName,
  panelClassName,
  children,
}: {
  title: string;
  intro: string;
  onClose: () => void;
  titleId: string;
  shellClassName?: string;
  panelClassName?: string;
  children: ReactNode;
}) {
  const tc = useTranslations("common");
  const panelRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const contentFocusTarget = contentRef.current?.querySelector<HTMLElement>(
      "[data-dialog-autofocus]",
    );
    const focusTarget =
      contentFocusTarget ??
      panelRef.current?.querySelector<HTMLElement>("[data-dialog-autofocus]");
    focusTarget?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
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
      <button
        type="button"
        className="absolute inset-0 cursor-default bg-black/45 backdrop-blur-sm"
        aria-label={tc("cancel")}
        onClick={onClose}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={cn(
          "relative flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-3xl border border-border bg-[var(--card-solid)] shadow-2xl",
          panelClassName,
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4 sm:px-6">
          <div className="min-w-0">
            <h2 id={titleId} className="font-display text-lg font-bold">
              {title}
            </h2>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{intro}</p>
          </div>
          <button
            type="button"
            data-dialog-autofocus
            onClick={onClose}
            aria-label={tc("cancel")}
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
