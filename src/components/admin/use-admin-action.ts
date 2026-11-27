"use client";

import { useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

/** Central mapping for API error codes so raw codes never reach the UI. */
const ADMIN_ERROR_KEYS = {
  INVALID_REQUEST: "adminErrorInvalidRequest",
  "Invalid request": "adminErrorInvalidRequest",
  FORBIDDEN: "adminErrorForbidden",
  SETTINGS_FAILED: "adminErrorSettingsFailed",
  INVALID_ADMIN_PASSWORD: "configInvalidPassword",
  STALE_VERSION: "adminErrorStaleVersion",
  VERSION_EXISTS: "versionExists",
  DUPLICATE: "adminErrorDuplicate",
  DUPLICATE_REQUEST: "adminErrorDuplicate",
  INSUFFICIENT_BALANCE: "adminErrorInsufficientBalance",
  INVALID_STATE: "invalidState",
  ALREADY_REVIEWED: "invalidState",
  NO_ELIGIBLE_INVESTMENTS: "noEligibleInvestments",
  NOTE_REQUIRED: "noteRequired",
  TPIN_MISMATCH: "resetTpinMismatch",
  INVALID_TPIN: "resetTpinMismatch",
  TPIN_UNCHANGED: "resetTpinUnchanged",
  "Please check the amount": "amountRequired",
} as const;

type AdminErrorKey = (typeof ADMIN_ERROR_KEYS)[keyof typeof ADMIN_ERROR_KEYS];

export function useAdminAction() {
  const router = useRouter();
  const tc = useTranslations("common");
  const ta = useTranslations("adminPanel");
  const [pending, setPending] = useState(false);

  function defaultErrorMessage(code: string | undefined): string {
    if (code && code in ADMIN_ERROR_KEYS) {
      return ta(ADMIN_ERROR_KEYS[code as keyof typeof ADMIN_ERROR_KEYS] as AdminErrorKey);
    }
    return tc("error");
  }

  async function run(
    url: string,
    method: "POST" | "PATCH",
    payload: Record<string, unknown>,
    errorMessages?: Record<string, string>,
    onError?: (error: string, code?: string) => void,
  ): Promise<boolean> {
    setPending(true);
    try {
      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await response.json().catch(() => ({}))) as { error?: string };

      if (!response.ok) {
        const code = data.error;
        const message = (code && errorMessages?.[code]) || defaultErrorMessage(code);
        toast.error(message);
        onError?.(message, code);
        return false;
      }

      toast.success(tc("success"));
      router.refresh();
      return true;
    } catch {
      const message = tc("error");
      toast.error(message);
      onError?.(message);
      return false;
    } finally {
      setPending(false);
    }
  }

  return { pending, run };
}
