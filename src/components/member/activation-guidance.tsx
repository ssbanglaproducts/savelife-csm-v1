"use client";

import { useId, useState } from "react";
import { useTranslations } from "next-intl";
import { Store } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Button, buttonVariants } from "@/components/ui/button";
import { DialogShell } from "@/components/ui/dialog-shell";
import { formatSP } from "@/lib/money";
import { activationGuidanceState } from "@/lib/purchase-rules";
import { cn } from "@/lib/utils";

/**
 * One activation explanation reused by the dashboard Activate button, the
 * activation-pending notice, and the store when SP is missing.
 */
export function ActivationGuidanceContent({
  availablePaisa,
  requiredPaisa,
}: {
  availablePaisa: bigint;
  requiredPaisa?: bigint;
}) {
  const t = useTranslations("purchase");
  const state = activationGuidanceState(availablePaisa, requiredPaisa);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-red-500/25 bg-red-500/10 px-4 py-3">
        <p className="text-xs font-bold uppercase tracking-[0.12em] text-red-600 dark:text-red-300">
          {t("activationGuideTitle")}
        </p>
        <p className="mt-2 text-sm font-semibold leading-relaxed">
          {t("activationGuideIntro")}
        </p>
      </div>

      <div className="flex items-center justify-between gap-4 rounded-xl bg-[var(--glass)] px-3 py-2.5">
        <span className="text-xs text-muted-foreground">{t("activationGuideBalance")}</span>
        <span className="text-sm font-bold tabular-nums text-red-600 dark:text-red-300">
          {formatSP(availablePaisa)}
        </span>
      </div>

      <p
        role={state === "ready" ? undefined : "alert"}
        className="text-xs leading-relaxed text-muted-foreground"
      >
        {state === "empty"
          ? t("activationGuideEmpty")
          : state === "insufficient"
            ? t("activationGuideInsufficient")
            : t("activationGuideReady")}
      </p>

      <p className="flex items-start gap-2 text-xs leading-relaxed text-muted-foreground">
        <Store className="mt-0.5 size-3.5 shrink-0 text-red-500" aria-hidden="true" />
        {t("activationGuidePickup")}
      </p>

      <div className="flex flex-wrap gap-2">
        {state === "empty" ? (
          <Link href="/member/top-up" className={cn(buttonVariants(), "min-w-32")}>
            {t("activationGuideAddSp")}
          </Link>
        ) : (
          <>
            <Link
              href="/member/top-up"
              className={cn(buttonVariants({ variant: "outline" }), "min-w-32")}
            >
              {t("activationGuideAddSp")}
            </Link>
            <Link href="/" className={cn(buttonVariants(), "min-w-32")}>
              {t("activationGuideStore")}
            </Link>
          </>
        )}
      </div>
    </div>
  );
}

export function ActivationGuidanceDialog({
  open,
  availablePaisa,
  requiredPaisa,
  onClose,
}: {
  open: boolean;
  availablePaisa: bigint;
  requiredPaisa?: bigint;
  onClose: () => void;
}) {
  const t = useTranslations("purchase");
  const titleId = useId();

  if (!open) return null;

  return (
    <DialogShell
      title={t("activationGuideTitle")}
      intro={t("activationGuideDialogIntro")}
      titleId={titleId}
      onClose={onClose}
    >
      <ActivationGuidanceContent
        availablePaisa={availablePaisa}
        requiredPaisa={requiredPaisa}
      />
    </DialogShell>
  );
}

/** Desktop-only dashboard action that opens the shared activation guidance. */
export function ActivateButton({ availablePaisa }: { availablePaisa: string }) {
  const t = useTranslations("purchase");
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        type="button"
        variant="destructive"
        className="hidden shrink-0 md:inline-flex"
        onClick={() => setOpen(true)}
      >
        {t("activateNow")}
      </Button>
      <ActivationGuidanceDialog
        open={open}
        availablePaisa={BigInt(availablePaisa || "0")}
        onClose={() => setOpen(false)}
      />
    </>
  );
}
