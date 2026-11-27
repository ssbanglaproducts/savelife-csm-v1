"use client";

import { useId, type ReactNode } from "react";
import { DialogShell } from "@/components/ui/dialog-shell";
import { cn } from "@/lib/utils";

/**
 * Shared create/edit dialog for admin forms.
 * Full-screen on phones, centered popup on larger screens.
 */
export function AdminFormDialog({
  title,
  intro,
  onClose,
  wide = false,
  children,
}: {
  title: string;
  intro: string;
  onClose: () => void;
  wide?: boolean;
  children: ReactNode;
}) {
  const titleId = useId();
  return (
    <DialogShell
      title={title}
      intro={intro}
      onClose={onClose}
      titleId={titleId}
      shellClassName="p-0 sm:p-4"
      panelClassName={cn(
        "h-full max-h-none w-full max-w-none rounded-none sm:h-auto sm:max-h-[92vh] sm:rounded-3xl",
        wide ? "sm:max-w-6xl" : "sm:max-w-3xl",
      )}
    >
      {children}
    </DialogShell>
  );
}
