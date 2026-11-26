"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { AdminFormDialog } from "./admin-form-dialog";

const CloseDialogContext = createContext<() => void>(() => {});

/** Lets forms inside an action dialog close it after a successful update. */
export function useCloseAdminActionDialog() {
  return useContext(CloseDialogContext);
}

/**
 * Keeps rows and record cards calm: the action opens a full-screen mobile
 * drawer or a centered desktop dialog instead of expanding inline forms.
 */
export function AdminActionDialogButton({
  label,
  title,
  intro,
  children,
  variant = "outline",
  size = "sm",
  className,
  wide = false,
}: {
  label: string;
  title: string;
  intro: string;
  children: ReactNode;
  variant?: ButtonProps["variant"];
  size?: ButtonProps["size"];
  className?: string;
  wide?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  return (
    <>
      <Button
        type="button"
        variant={variant}
        size={size}
        className={cn("min-h-10", className)}
        onClick={() => setOpen(true)}
      >
        {label}
      </Button>
      {open ? (
        <CloseDialogContext.Provider value={close}>
          <AdminFormDialog title={title} intro={intro} onClose={close} wide={wide}>
            {children}
          </AdminFormDialog>
        </CloseDialogContext.Provider>
      ) : null}
    </>
  );
}
