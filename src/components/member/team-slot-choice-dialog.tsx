"use client";

import { useTranslations } from "next-intl";
import { CopyPlus, Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { TeamPersonSummary } from "@/lib/services/team-performance";
import { TeamDialog } from "./team-dialog";

function legLabel(t: ReturnType<typeof useTranslations>, slot: number): string {
  if (slot === 1) return t("memberPanel.teamLegA");
  if (slot === 2) return t("memberPanel.teamLegB");
  return t("memberPanel.teamLegC");
}

/** First step when an empty placement slot is tapped. */
export function TeamSlotChoiceDialog({
  slot,
  placement,
  onGenerate,
  onClone,
  onClose,
}: {
  slot: 1 | 2 | 3;
  placement: TeamPersonSummary;
  onGenerate: () => void;
  onClone: () => void;
  onClose: () => void;
}) {
  const t = useTranslations();

  return (
    <TeamDialog
      title={
        <>
          <span className="block">{t("memberPanel.teamSlotActionTitle")}</span>
          <span className="mt-0.5 block whitespace-nowrap text-sm font-medium text-muted-foreground">
            {legLabel(t, slot)} · {t("memberPanel.teamSlot")} {slot}
          </span>
        </>
      }
      onClose={onClose}
    >
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          {t("memberPanel.teamSlotActionHint", { memberId: placement.memberId })}
        </p>

        <div className="grid gap-3">
          <Button type="button" size="lg" className="w-full justify-start" onClick={onGenerate}>
            <Link2 className="size-4" aria-hidden="true" />
            {t("memberPanel.teamSlotActionGenerate")}
          </Button>
          <Button
            type="button"
            size="lg"
            variant="outline"
            className="w-full justify-start"
            onClick={onClone}
          >
            <CopyPlus className="size-4" aria-hidden="true" />
            {t("memberPanel.teamSlotActionClone")}
          </Button>
        </div>
      </div>
    </TeamDialog>
  );
}
