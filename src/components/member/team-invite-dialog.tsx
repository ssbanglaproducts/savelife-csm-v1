"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Check, Link2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { copyText } from "@/lib/clipboard";
import type { TeamPersonSummary } from "@/lib/services/team-performance";
import { TeamDialog } from "./team-dialog";

type InviteResponse = {
  error?: string;
  token?: string;
  sponsorMemberId?: string;
  placementMemberId?: string;
  sponsor?: { memberId: string; fullName: string };
  placement?: { memberId: string; fullName: string };
};

function legLabel(t: ReturnType<typeof useTranslations>, slot: number): string {
  if (slot === 1) return t("memberPanel.teamLegA");
  if (slot === 2) return t("memberPanel.teamLegB");
  return t("memberPanel.teamLegC");
}

export function TeamInviteDialog({
  slot,
  placement,
  viewerMemberId,
  onClose,
}: {
  slot: 1 | 2 | 3;
  placement: TeamPersonSummary;
  viewerMemberId: string;
  onClose: () => void;
}) {
  const t = useTranslations();
  const locale = useLocale();
  const placementMemberId = placement.memberId;
  const [sponsorId, setSponsorId] = useState("");
  const [link, setLink] = useState<string | null>(null);
  const [verified, setVerified] = useState<InviteResponse | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function errorText(code?: string): string {
    switch (code) {
      case "SPONSOR_NOT_FOUND":
        return t("auth.sponsorInvalid");
      case "SPONSOR_NOT_ELIGIBLE":
        return t("auth.sponsorNotEligible");
      case "SPONSOR_INACTIVE":
        return t("auth.sponsorInactive");
      case "PLACEMENT_NOT_FOUND":
        return t("auth.placementInvalid");
      case "PLACEMENT_NOT_ELIGIBLE":
        return t("auth.placementNotEligible");
      case "PLACEMENT_INACTIVE":
        return t("auth.placementInactive");
      case "PLACEMENT_OUTSIDE_SPONSOR_NETWORK":
      case "PLACEMENT_CYCLE":
        return t("auth.placementOutsideNetwork");
      case "PLACEMENT_SLOT_INVALID":
        return t("auth.placementSlotInvalid");
      case "PLACEMENT_SLOT_UNAVAILABLE":
      case "PLACEMENT_SLOT_TAKEN":
        return t("auth.placementSlotTaken");
      default:
        return t("memberPanel.teamInviteFailed");
    }
  }

  function resetLink() {
    setLink(null);
    setVerified(null);
    setError(null);
  }

  async function generate() {
    setError(null);
    setPending(true);
    try {
      const response = await fetch("/api/member/signup-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sponsorMemberId: sponsorId.trim().toUpperCase(),
          placementMemberId,
          placementSlot: slot,
        }),
      });
      const data = (await response.json()) as InviteResponse;
      if (!response.ok || !data.token) {
        setError(errorText(data.error));
        resetLink();
        return;
      }

      const params = new URLSearchParams({
        sponsor: data.sponsorMemberId ?? sponsorId.trim().toUpperCase(),
        placement: data.placementMemberId ?? placementMemberId,
        slot: String(slot),
        invite: data.token,
      });
      setLink(`${window.location.origin}/${locale}/register?${params.toString()}`);
      setVerified(data);
    } catch {
      setError(t("memberPanel.teamInviteFailed"));
    } finally {
      setPending(false);
    }
  }

  async function copyLink() {
    if (!link) return;
    if (!(await copyText(link))) {
      setError(t("memberPanel.teamInviteFailed"));
      return;
    }
    toast.success(t("memberPanel.teamLinkCopied"));
  }

  const inputClass =
    "h-12 w-full rounded-xl border border-border bg-[var(--glass-strong)] px-4 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground/60 focus-visible:ring-2 focus-visible:ring-ring";

  return (
    <TeamDialog
      title={
        <>
          <span className="block">{t("memberPanel.teamSignupLinkTitle")}</span>
          <span className="mt-0.5 block whitespace-nowrap text-sm font-medium text-muted-foreground">
            {legLabel(t, slot)} · {t("memberPanel.teamSlot")} {slot}
          </span>
        </>
      }
      onClose={onClose}
    >
      <div className="space-y-5">
        <div className="space-y-2">
          <label htmlFor="invite-sponsor" className="block text-sm font-semibold">
            {t("memberPanel.teamSponsorId")}
          </label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              id="invite-sponsor"
              required
              minLength={5}
              placeholder="SL000001"
              className={`${inputClass} uppercase`}
              value={sponsorId}
              onChange={(event) => {
                setSponsorId(event.target.value.toUpperCase());
                resetLink();
              }}
            />
            <Button
              type="button"
              variant="outline"
              className="h-12 shrink-0"
              onClick={() => {
                setSponsorId(viewerMemberId);
                resetLink();
              }}
            >
              {t("memberPanel.teamMyId")}
            </Button>
          </div>
          {verified?.sponsor ? (
            <p className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-300">
              <Check className="size-3.5" aria-hidden="true" />
              {verified.sponsor.fullName} · {verified.sponsor.memberId}
            </p>
          ) : null}
        </div>

        <div className="space-y-2">
          <label htmlFor="invite-placement" className="block text-sm font-semibold">
            {t("memberPanel.teamPlacementId")}
          </label>
          <input
            id="invite-placement"
            readOnly
            className={`${inputClass} font-mono`}
            value={placementMemberId}
          />
          {verified?.placement ? (
            <p className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-300">
              <Check className="size-3.5" aria-hidden="true" />
              {verified.placement.fullName} · {verified.placement.memberId}
            </p>
          ) : null}
        </div>

        {link ? (
          <section className="space-y-2 rounded-2xl border border-primary/25 bg-primary/5 p-4">
            <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.12em] text-primary">
              <Link2 className="size-3.5" aria-hidden="true" />
              {t("memberPanel.teamSignupLink")}
            </p>
            <input readOnly value={link} className={`${inputClass} font-mono text-xs`} />
          </section>
        ) : null}

        {error ? (
          <p
            role="alert"
            className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-300"
          >
            {error}
          </p>
        ) : null}

        <Button
          type="button"
          size="lg"
          className="w-full"
          disabled={pending || sponsorId.trim().length < 5}
          onClick={() => void (link ? copyLink() : generate())}
        >
          {pending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
          {pending
            ? t("memberPanel.teamCloneChecking")
            : link
              ? t("memberPanel.teamCopyLink")
              : t("memberPanel.teamGenerateLink")}
        </Button>
      </div>
    </TeamDialog>
  );
}
