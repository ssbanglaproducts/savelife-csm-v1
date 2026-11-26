"use client";

import { useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { UploadField } from "@/components/ui/upload-field";
import { UserAvatar } from "@/components/ui/user-avatar";
import { cn } from "@/lib/utils";
import type { PlacementSlotInfo } from "@/lib/services/placement";
import { TeamDialog } from "./team-dialog";

type VerifiedMember = {
  memberId: string;
  fullName: string;
  status: string;
  profileImage: string | null;
};

type OwnedAccount = {
  memberId: string;
  name: string;
};

type Validation = {
  sponsor: VerifiedMember;
  placement: VerifiedMember;
  slots: PlacementSlotInfo[];
  errors: string[];
};

export function TeamCloneDialog({
  viewerMemberId,
  placementMemberId,
  placementSlot,
  onClose,
  onSuccess,
}: {
  viewerMemberId: string;
  placementMemberId?: string;
  placementSlot?: 1 | 2 | 3;
  onClose: () => void;
  onSuccess?: () => void;
}) {
  const t = useTranslations();
  const queryClient = useQueryClient();
  const [sponsorId, setSponsorId] = useState("");
  const [placementId, setPlacementId] = useState(placementMemberId ?? "");
  const [selectedSlot, setSelectedSlot] = useState<1 | 2 | 3 | null>(placementSlot ?? null);
  const [fullNameOverride, setFullNameOverride] = useState<string | null>(null);
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [profileName, setProfileName] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const accountsQuery = useQuery({
    queryKey: ["me-accounts"],
    queryFn: async (): Promise<OwnedAccount[]> => {
      const response = await fetch("/api/me/accounts", { cache: "no-store" });
      const data = (await response.json()) as { accounts?: OwnedAccount[] };
      if (!response.ok) throw new Error("ACCOUNTS_FAILED");
      return data.accounts ?? [];
    },
    staleTime: 10_000,
  });

  const accounts = accountsQuery.data ?? [];
  const currentAccount =
    accounts.find((account) => account.memberId === viewerMemberId.toUpperCase()) ?? accounts[0];
  const baseName = (currentAccount?.name ?? "").trim().replace(/\s+\d+$/, "");
  const suggestedName = baseName ? `${baseName} ${accounts.length + 1}` : "";
  const fullName = fullNameOverride ?? suggestedName;

  const ready = sponsorId.trim().length >= 5 && placementId.trim().length >= 5;
  const validation = useQuery({
    queryKey: ["clone-account-validation", sponsorId.trim().toUpperCase(), placementId.trim().toUpperCase()],
    queryFn: async (): Promise<Validation> => {
      const response = await fetch("/api/member/clone-accounts/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sponsorMemberId: sponsorId.trim().toUpperCase(),
          placementMemberId: placementId.trim().toUpperCase(),
        }),
      });
      const data = (await response.json()) as Validation & { error?: string };
      if (!response.ok) throw new Error(data.error ?? "VALIDATION_FAILED");
      return data;
    },
    enabled: ready,
    retry: false,
    staleTime: 10_000,
  });

  const availableSlots = validation.data?.slots.filter((slot) => !slot.occupied) ?? [];
  const targetSlot = placementSlot ?? selectedSlot;
  const slotAvailable = availableSlots.some((slot) => slot.slot === targetSlot);
  const validationIssues = validation.data?.errors ?? [];
  const canCreate =
    ready &&
    accountsQuery.isSuccess &&
    fullName.trim().length >= 2 &&
    validation.isSuccess &&
    validationIssues.length === 0 &&
    slotAvailable &&
    !uploading &&
    !creating;

  function messageFor(code?: string): string {
    switch (code) {
      case "ORIGINAL_INACTIVE":
        return t("memberPanel.teamCloneOriginalInactive");
      case "SPONSOR_NOT_FOUND":
        return t("auth.sponsorInvalid");
      case "SPONSOR_INACTIVE":
        return t("auth.sponsorInactive");
      case "PLACEMENT_NOT_FOUND":
        return t("auth.placementInvalid");
      case "PLACEMENT_INACTIVE":
        return t("auth.placementInactive");
      case "PLACEMENT_OUTSIDE_SPONSOR_NETWORK":
      case "PLACEMENT_CYCLE":
        return t("auth.placementOutsideNetwork");
      case "PLACEMENT_SLOT_INVALID":
        return t("auth.placementSlotInvalid");
      case "PLACEMENT_SLOT_UNAVAILABLE":
      case "PLACEMENT_SLOT_TAKEN":
        return t("memberPanel.teamCloneSlotUnavailable");
      case "INVALID_IMAGE":
        return t("auth.invalidImage");
      default:
        return t("memberPanel.teamCloneFailed");
    }
  }

  async function uploadProfilePicture(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    setError(null);
    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);
    try {
      const response = await fetch("/api/registration/upload", { method: "POST", body: formData });
      const data = (await response.json()) as { url?: string; error?: string };
      if (!response.ok || !data.url) {
        setError(t("auth.invalidImage"));
        return;
      }
      setProfileImage(data.url);
      setProfileName(file.name);
    } catch {
      setError(t("auth.invalidImage"));
    } finally {
      setUploading(false);
    }
  }

  async function createClone() {
    if (!targetSlot || !fullName.trim()) return;
    setError(null);
    setCreating(true);
    try {
      const response = await fetch("/api/member/clone-accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: fullName.trim(),
          profileImage,
          sponsorMemberId: sponsorId.trim().toUpperCase(),
          placementMemberId: placementId.trim().toUpperCase(),
          placementSlot: targetSlot,
        }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(messageFor(data.error));
        void validation.refetch();
        return;
      }
      toast.success(t("memberPanel.teamCloneSuccess"));
      await queryClient.invalidateQueries({ queryKey: ["me-accounts"] });
      onSuccess?.();
      onClose();
    } catch {
      setError(t("memberPanel.teamCloneFailed"));
    } finally {
      setCreating(false);
    }
  }

  const inputClass =
    "h-12 w-full rounded-xl border border-border bg-[var(--glass-strong)] px-4 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground/60 focus-visible:ring-2 focus-visible:ring-ring";

  return (
    <TeamDialog title={t("memberPanel.teamCloneTitle")} onClose={onClose} wide>
      <div className="space-y-5">
        <div className="rounded-2xl border border-border/70 bg-[var(--glass-strong)] p-4">
          <div className="space-y-2">
            <label htmlFor="clone-full-name" className="block text-sm font-semibold">
              {t("auth.fullName")}
            </label>
            <input
              id="clone-full-name"
              required
              minLength={2}
              maxLength={120}
              className={inputClass}
              value={fullName}
              disabled={!accountsQuery.isSuccess || creating}
              onChange={(event) => setFullNameOverride(event.target.value)}
            />
            <p className="text-xs text-muted-foreground">{t("memberPanel.teamCloneNameHint")}</p>
          </div>
          <div className="mt-4 border-t border-border/60 pt-4">
            <span className="block text-sm font-semibold">
              {t("auth.profilePicture")}{" "}
              <span className="font-normal text-muted-foreground">({t("common.optional")})</span>
            </span>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <UserAvatar
                name={fullName || "?"}
                src={profileImage}
                className="size-14 rounded-full"
                textClassName="text-sm"
              />
              <UploadField
                accept="image/jpeg,image/png,image/webp"
                actionLabel={t("auth.choosePicture")}
                hint={t("auth.invalidImage")}
                disabled={creating || uploading}
                uploading={uploading}
                selectedName={profileName}
                onSelect={(files) => void uploadProfilePicture(files)}
                onRemove={() => {
                  setProfileImage(null);
                  setProfileName(null);
                }}
              />
            </div>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <MemberIdField
            id="clone-sponsor"
            label={t("memberPanel.teamSponsorId")}
            value={sponsorId}
            verified={validation.data?.sponsor}
            inputClass={inputClass}
            onChange={(value) => {
              setSponsorId(value);
              if (!placementSlot) setSelectedSlot(null);
              setError(null);
            }}
            action={
              <Button
                type="button"
                variant="outline"
                className="h-12 shrink-0"
                onClick={() => {
                  setSponsorId(viewerMemberId);
                  if (!placementSlot) setSelectedSlot(null);
                  setError(null);
                }}
              >
                {t("memberPanel.teamMyId")}
              </Button>
            }
          />
          <MemberIdField
            id="clone-placement"
            label={t("memberPanel.teamPlacementId")}
            value={placementId}
            verified={validation.data?.placement}
            inputClass={inputClass}
            readOnly={Boolean(placementMemberId)}
            onChange={(value) => {
              setPlacementId(value);
              if (!placementSlot) setSelectedSlot(null);
              setError(null);
            }}
          />
        </div>

        {ready && validation.isFetching ? (
          <p className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
            <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
            {t("memberPanel.teamCloneChecking")}
          </p>
        ) : null}

        {accountsQuery.isError ? (
          <p role="alert" className="text-sm text-red-600 dark:text-red-300">
            {t("memberPanel.teamCloneFailed")}
          </p>
        ) : null}

        {validation.isError ? (
          <p role="alert" className="text-sm text-red-600 dark:text-red-300">
            {messageFor((validation.error as Error | null)?.message)}
          </p>
        ) : null}

        {validation.isSuccess && validationIssues.length > 0 ? (
          <p role="alert" className="text-sm text-red-600 dark:text-red-300">
            {messageFor(validationIssues[0])}
          </p>
        ) : null}

        {placementSlot && validation.isSuccess ? (
          <div className="space-y-2">
            <p className="text-sm font-semibold">{t("memberPanel.teamCloneSlot")}</p>
            <p className="text-sm text-muted-foreground">
              {legLabel(t, placementSlot)} · {t("memberPanel.teamSlot")} {placementSlot}
            </p>
            {!slotAvailable ? (
              <p role="alert" className="text-sm text-red-600 dark:text-red-300">
                {t("memberPanel.teamCloneSlotUnavailable")}
              </p>
            ) : null}
          </div>
        ) : validation.isSuccess ? (
          <div className="space-y-2">
            <p className="text-sm font-semibold">{t("memberPanel.teamCloneSlot")}</p>
            {availableSlots.length > 0 ? (
              <div className="grid gap-3 sm:grid-cols-3">
                {availableSlots.map((slot) => {
                  const chosen = selectedSlot === slot.slot;
                  return (
                    <button
                      key={slot.slot}
                      type="button"
                      aria-pressed={chosen}
                      onClick={() => setSelectedSlot(slot.slot)}
                      className={`rounded-2xl border p-4 text-left transition-colors ${
                        chosen
                          ? "border-emerald-500/60 bg-emerald-500/10 ring-2 ring-emerald-500/20"
                          : "border-border hover:bg-accent"
                      }`}
                    >
                      <span className="block text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">
                        {legLabel(t, slot.slot)}
                      </span>
                      <span className="mt-2 block font-display text-base font-bold">
                        {t("memberPanel.teamSlot")} {slot.slot}
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">{t("memberPanel.teamCloneNoSlots")}</p>
            )}
          </div>
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
          disabled={!canCreate}
          onClick={() => void createClone()}
        >
          {creating ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
          {creating ? t("memberPanel.teamCloneCreating") : t("memberPanel.teamCloneCreate")}
        </Button>
      </div>
    </TeamDialog>
  );
}

function legLabel(t: ReturnType<typeof useTranslations>, slot: number): string {
  if (slot === 1) return t("memberPanel.teamLegA");
  if (slot === 2) return t("memberPanel.teamLegB");
  return t("memberPanel.teamLegC");
}

function MemberIdField({
  id,
  label,
  value,
  verified,
  inputClass,
  readOnly = false,
  action,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  verified: VerifiedMember | undefined;
  inputClass: string;
  readOnly?: boolean;
  action?: ReactNode;
  onChange: (value: string) => void;
}) {
  const t = useTranslations();
  const active = verified?.status === "ACTIVE";

  return (
    <div className="space-y-2">
      <label htmlFor={id} className="block text-sm font-semibold">
        {label}
      </label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative min-w-0 flex-1">
          {verified ? (
            <UserAvatar
              name={verified.fullName}
              src={verified.profileImage}
              className={cn(
                "pointer-events-none absolute left-2 top-1/2 z-10 size-8 -translate-y-1/2 rounded-lg ring-2",
                active ? "ring-emerald-500/70" : "ring-red-500",
              )}
              textClassName="text-[10px]"
            />
          ) : null}
          <input
            id={id}
            required
            minLength={5}
            placeholder="SL000001"
            readOnly={readOnly}
            aria-describedby={verified ? `${id}-status` : undefined}
            className={cn(
              inputClass,
              "min-w-0",
              verified && "pl-12 pr-11",
              readOnly && "cursor-default font-mono text-muted-foreground",
              !readOnly && !verified && "uppercase",
            )}
            value={value}
            onChange={(event) => onChange(event.target.value.toUpperCase())}
          />
          {verified ? (
            <span
              role="img"
              aria-label={t("memberPanel.teamCloneVerified")}
              className="pointer-events-none absolute right-3 top-1/2 flex size-5 -translate-y-1/2 items-center justify-center rounded-full bg-emerald-500 text-white ring-2 ring-background"
            >
              <Check className="size-3.5" aria-hidden="true" />
            </span>
          ) : null}
        </div>
        {action}
      </div>
      {verified ? (
        <p
          id={`${id}-status`}
          className={cn(
            "truncate text-[11px] font-semibold",
            active ? "text-emerald-600 dark:text-emerald-300" : "text-red-600 dark:text-red-300",
          )}
        >
          {verified.fullName} ·{" "}
          {active ? t("memberPanel.teamStatusActive") : t("memberPanel.teamStatusInactive")}
        </p>
      ) : null}
    </div>
  );
}
