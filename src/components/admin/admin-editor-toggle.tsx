"use client";

import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { AdminFormDialog } from "./admin-form-dialog";

/** Reveals a large admin editor only after the admin asks for it. */
export function AdminEditorToggle({
  label,
  title,
  intro,
  wide = true,
  children,
}: {
  label: string;
  title: string;
  intro: string;
  wide?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <div className="flex justify-end">
        <Button type="button" onClick={() => setOpen(true)}>
          {label}
        </Button>
      </div>
    );
  }

  return (
    <AdminFormDialog title={title} intro={intro} onClose={() => setOpen(false)} wide={wide}>
      {children}
    </AdminFormDialog>
  );
}
