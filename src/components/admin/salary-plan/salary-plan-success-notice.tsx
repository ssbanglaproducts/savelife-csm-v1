"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

const STORAGE_KEY = "salaryPlanCommittedVersion";

export function queueSalaryPlanSuccess(version: number): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(STORAGE_KEY, String(version));
}

export function SalaryPlanSuccessNotice() {
  const ta = useTranslations("adminPanel");

  useEffect(() => {
    const version = window.sessionStorage.getItem(STORAGE_KEY);
    if (!version) return;
    window.sessionStorage.removeItem(STORAGE_KEY);
    toast.success(ta("salaryPlanCommitted", { version }));
  }, [ta]);

  return null;
}
