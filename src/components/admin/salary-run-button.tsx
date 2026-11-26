"use client";

import { useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { Play } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { adminInputClass } from "@/components/admin/admin-ui";

export function SalaryRunButton() {
  const ta = useTranslations("adminPanel");
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function run() {
    if (busy) return;
    setBusy(true);
    try {
      const response = await fetch("/api/admin/salary/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        distribution?: { applied?: boolean; reason?: string };
      };
      if (!response.ok || !data.ok) {
        toast.error(ta("salaryRunFailed"));
        return;
      }
      if (data.distribution?.reason === "DUPLICATE") {
        toast.info(ta("salaryRunDuplicate"));
        return;
      }
      toast.success(ta("salaryRunSuccess"));
      router.refresh();
    } catch {
      toast.error(ta("salaryRunFailed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="glass flex flex-col gap-3 rounded-2xl p-5 sm:flex-row sm:items-center sm:justify-between">
      <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
        {ta("salaryAutomationHint")}
      </p>
      <button
        type="button"
        onClick={() => void run()}
        disabled={busy}
        className={`${adminInputClass} inline-flex w-full shrink-0 items-center justify-center gap-2 bg-primary font-bold text-primary-foreground hover:bg-primary/90 disabled:opacity-60 sm:w-auto`}
      >
        <Play className="size-4" aria-hidden="true" />
        {busy ? ta("salaryRunning") : ta("salaryRun")}
      </button>
    </div>
  );
}
