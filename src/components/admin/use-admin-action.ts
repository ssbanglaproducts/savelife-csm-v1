"use client";

import { useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

export function useAdminAction() {
  const router = useRouter();
  const tc = useTranslations("common");
  const [pending, setPending] = useState(false);

  async function run(
    url: string,
    method: "POST" | "PATCH",
    payload: Record<string, unknown>,
    errorMessages?: Record<string, string>,
    onError?: (error: string) => void,
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
        const message =
          (data.error ? errorMessages?.[data.error] : undefined) || data.error || tc("error");
        toast.error(message);
        onError?.(message);
        return false;
      }

      toast.success(tc("success"));
      router.refresh();
      return true;
    } catch {
      toast.error(tc("error"));
      return false;
    } finally {
      setPending(false);
    }
  }

  return { pending, run };
}
