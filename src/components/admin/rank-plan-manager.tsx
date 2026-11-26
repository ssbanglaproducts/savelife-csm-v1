"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { useRouter } from "@/i18n/navigation";

export function RankCollectionButton({ achievementId }: { achievementId: string }) {
  const ta = useTranslations("adminPanel");
  const tc = useTranslations("common");
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function collect() {
    setPending(true);
    try {
      const response = await fetch(`/api/admin/rank-achievements/${achievementId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "MARK_COLLECTED" }),
      });
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        toast.error(data.error || ta("rankPlanCollectFailed"));
        return;
      }
      toast.success(ta("rankPlanCollected"));
      router.refresh();
    } catch {
      toast.error(ta("rankPlanCollectFailed"));
    } finally {
      setPending(false);
    }
  }

  return (
    <button
      type="button"
      onClick={collect}
      disabled={pending}
      className="whitespace-nowrap rounded-lg border border-border px-3 py-1.5 text-xs font-semibold transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
    >
      {pending ? tc("saving") : ta("rankPlanCollect")}
    </button>
  );
}
