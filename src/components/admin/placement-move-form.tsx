"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export function PlacementMoveForm({
  memberId,
  currentParentId,
  currentSlot,
}: {
  memberId: string;
  currentParentId: string | null;
  currentSlot: number | null;
}) {
  const t = useTranslations("adminPanel");
  const [parentId, setParentId] = useState("");
  const [slot, setSlot] = useState<number | null>(currentSlot);
  const [pending, setPending] = useState(false);

  async function handleMove() {
    if (!parentId.trim() || slot === null) {
      toast.error(t("invalidPlacementMove"));
      return;
    }
    if (!window.confirm(t("movePlacementConfirm"))) return;

    setPending(true);
    try {
      const response = await fetch(`/api/admin/members/${memberId}/placement`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          placementMemberId: parentId.trim().toUpperCase(),
          placementSlot: slot,
        }),
      });
      await response.json();
      if (!response.ok) {
        toast.error(t("invalidPlacementMove"));
        return;
      }
      toast.success(t("placementMoved"));
      window.location.reload();
    } catch {
      toast.error(t("invalidPlacementMove"));
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mt-6 rounded-2xl border border-border/70 p-4">
      <h3 className="text-sm font-bold">{t("movePlacementTitle")}</h3>
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{t("movePlacementNote")}</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_100px_auto] sm:items-end">
        <label className="block">
          <span className="text-xs font-semibold">{t("targetParent")}</span>
          <input
            value={parentId}
            onChange={(event) => setParentId(event.target.value.toUpperCase())}
            placeholder={currentParentId ?? "SL000001"}
            className="mt-1.5 h-11 w-full rounded-xl border border-border bg-[var(--glass-strong)] px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </label>
        <label className="block">
          <span className="text-xs font-semibold">{t("targetSlot")}</span>
          <select
            value={slot ?? ""}
            onChange={(event) => setSlot(Number(event.target.value))}
            className="mt-1.5 h-11 w-full rounded-xl border border-border bg-[var(--glass-strong)] px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="">—</option>
            {[1, 2, 3].map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
        <Button type="button" onClick={() => void handleMove()} disabled={pending}>
          {pending ? <Loader2 className="size-4 animate-spin" /> : null}
          {t("movePlacement")}
        </Button>
      </div>
      <p className="mt-3 text-[11px] text-muted-foreground">{t("placementHistoryNote")}</p>
    </div>
  );
}
