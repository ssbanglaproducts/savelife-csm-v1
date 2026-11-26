"use client";

import { useCallback, useEffect, useId, useRef, useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { signIn } from "next-auth/react";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import {
  Check,
  CheckCircle2,
  Eye,
  EyeOff,
  ImagePlus,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { UploadField } from "@/components/ui/upload-field";
import { Link, useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import type { PlacementSlotInfo } from "@/lib/services/placement";

const inputClass =
  "h-12 w-full rounded-xl border border-border bg-[var(--glass-strong)] px-4 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground/60 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";
const labelClass = "block text-sm font-semibold";

const STRENGTH_LABELS = ["strengthWeak", "strengthFair", "strengthGood", "strengthStrong"] as const;
const STRENGTH_BAR = [
  "bg-red-500",
  "bg-amber-500",
  "bg-emerald-500",
  "bg-emerald-600 dark:bg-emerald-400",
] as const;
const STRENGTH_TEXT = [
  "text-red-500",
  "text-amber-600 dark:text-amber-300",
  "text-emerald-600 dark:text-emerald-300",
  "text-emerald-600 dark:text-emerald-300",
] as const;

type ApiError = { error?: string; slots?: PlacementSlotInfo[] | null };
type RegistrationResponse = { member?: { memberId?: string } };
type MemberPreview = {
  memberId: string;
  fullName: string;
  status: string;
  profileImage: string | null;
};

function getPasswordStrength(value: string): number {
  if (!value) return 0;
  let score = 0;
  if (value.length >= 8) score += 1;
  if (value.length >= 12) score += 1;
  if (/[a-z]/.test(value) && /[A-Z]/.test(value)) score += 1;
  if (/\d/.test(value)) score += 1;
  if (/[^A-Za-z0-9]/.test(value)) score += 1;
  return Math.min(4, Math.max(1, score));
}

export function RegisterForm() {
  const t = useTranslations("auth");
  const tc = useTranslations("common");
  const router = useRouter();
  const queryClient = useQueryClient();
  const fieldId = useId();
  const searchParams = useSearchParams();
  const initialSponsor = searchParams.get("sponsor")?.trim().toUpperCase() ?? "";
  const initialPlacement = searchParams.get("placement")?.trim().toUpperCase() ?? "";
  const initialSlotValue = Number(searchParams.get("slot"));
  const initialSlot = initialSlotValue === 1 || initialSlotValue === 2 || initialSlotValue === 3
    ? initialSlotValue
    : null;
  const initialInvite = searchParams.get("invite")?.trim() || null;
  const initializedInvite = useRef(false);

  const [pending, setPending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [checking, setChecking] = useState<"sponsor" | "placement" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [profileName, setProfileName] = useState<string | null>(null);

  const [sponsorId, setSponsorId] = useState(initialSponsor);
  const [placementId, setPlacementId] = useState(initialPlacement);
  const [invite, setInvite] = useState<string | null>(initialInvite);
  const [sponsorName, setSponsorName] = useState<string | null>(null);
  const [placementName, setPlacementName] = useState<string | null>(null);
  const [slots, setSlots] = useState<PlacementSlotInfo[] | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<number | null>(initialSlot);

  const busy = pending || uploading || checking !== null;
  const strength = getPasswordStrength(password);

  const messageFor = useCallback(
    (code?: string): string => {
      const map: Record<string, string> = {
        INVALID_REQUEST: t("formInvalid"),
        INVALID_ACCOUNT: t("formInvalid"),
        INVALID_IMAGE: t("invalidImage"),
        ACCOUNT_EXISTS: t("accountExists"),
        SPONSOR_NOT_FOUND: t("sponsorInvalid"),
        SPONSOR_INACTIVE: t("sponsorInactive"),
        PLACEMENT_NOT_FOUND: t("placementInvalid"),
        PLACEMENT_INACTIVE: t("placementInactive"),
        PLACEMENT_OUTSIDE_SPONSOR_NETWORK: t("placementOutsideNetwork"),
        PLACEMENT_SLOT_INVALID: t("placementSlotInvalid"),
        PLACEMENT_SLOT_UNAVAILABLE: t("placementSlotTaken"),
        PLACEMENT_SLOT_TAKEN: t("placementSlotTaken"),
        PLACEMENT_CYCLE: t("placementOutsideNetwork"),
        INVITE_INVALID: t("inviteInvalid"),
        INVITE_MISMATCH: t("inviteMismatch"),
        REGISTRATION_FAILED: t("registrationFailed"),
      };
      return code ? (map[code] ?? t("registrationFailed")) : t("registrationFailed");
    },
    [t],
  );

  function clearInvite() {
    if (invite) setInvite(null);
  }

  const refreshPlacement = useCallback(
    async (
      silent = false,
      ids?: { sponsor: string; placement: string; slot?: number | null },
    ): Promise<boolean> => {
      const sponsor = (ids?.sponsor ?? sponsorId).trim().toUpperCase();
      const placement = (ids?.placement ?? placementId).trim().toUpperCase();
      const slot = ids && "slot" in ids ? ids.slot : selectedSlot;
      if (sponsor.length < 5 || placement.length < 5) return false;
      if (!silent) setChecking("placement");
      try {
        const response = await fetch("/api/registration/validate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mode: "placement",
            sponsorMemberId: sponsor,
            memberId: placement,
          }),
        });
        const data = (await response.json()) as ApiError & { member?: MemberPreview };
        if (!response.ok || !data.member) {
          if (!silent) {
            setError(messageFor(data.error));
            setNotice(t("slotRecovery"));
            setPlacementName(null);
            setSlots(null);
            setSelectedSlot(null);
          }
          return false;
        }
        setPlacementName(data.member.fullName);
        setSlots(data.slots ?? null);
        const occupied = data.slots?.find((row) => row.slot === slot)?.occupied;
        if (occupied) {
          setSelectedSlot(null);
          setNotice(t("slotRecovery"));
          return false;
        }
        return true;
      } catch {
        if (!silent) setError(t("registrationFailed"));
        return false;
      } finally {
        if (!silent) setChecking(null);
      }
    },
    [messageFor, placementId, selectedSlot, sponsorId, t],
  );

  async function verifySponsor(id?: string): Promise<boolean> {
    const memberId = (id ?? sponsorId).trim().toUpperCase();
    setError(null);
    setNotice(null);
    setChecking("sponsor");
    try {
      const response = await fetch("/api/registration/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "sponsor", memberId }),
      });
      const data = (await response.json()) as ApiError & { member?: MemberPreview };
      if (!response.ok || !data.member) {
        setError(messageFor(data.error));
        setNotice(t("slotRecovery"));
        setSponsorName(null);
        setPlacementName(null);
        setSlots(null);
        setSelectedSlot(null);
        return false;
      }
      setSponsorName(data.member.fullName);
      setPlacementName(null);
      setSlots(null);
      return true;
    } catch {
      setError(t("registrationFailed"));
      return false;
    } finally {
      setChecking(null);
    }
  }

  useEffect(() => {
    if (initializedInvite.current || !initialInvite || !initialSponsor || !initialPlacement) return;
    initializedInvite.current = true;
    void (async () => {
      const sponsorOk = await verifySponsor(initialSponsor);
      if (!sponsorOk) return;
      const placementOk = await refreshPlacement(true, {
        sponsor: initialSponsor,
        placement: initialPlacement,
        slot: initialSlot,
      });
      if (placementOk) setSelectedSlot(initialSlot);
    })();
    // The link is a one-time initializer; the guard prevents repeated checks.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
        setError(messageFor(data.error));
        return;
      }
      setProfileImage(data.url);
      setProfileName(file.name);
    } catch {
      setError(t("registrationFailed"));
    } finally {
      setUploading(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setNotice(null);

    if (!sponsorName) {
      setError(t("sponsorInvalid"));
      return;
    }
    if (!placementName) {
      setError(t("placementInvalid"));
      return;
    }
    if (selectedSlot === null) {
      setError(t("placementSelectSlot"));
      return;
    }

    setPending(true);
    try {
      const response = await fetch("/api/registration", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: fullName.trim(),
          phone: phone.trim(),
          email: email.trim(),
          password,
          profileImage,
          sponsorMemberId: sponsorId.trim().toUpperCase(),
          placementMemberId: placementId.trim().toUpperCase(),
          placementSlot: selectedSlot,
          invite,
        }),
      });
      const data = (await response.json()) as ApiError & RegistrationResponse;
      if (!response.ok) {
        const placementCodes = [
          "PLACEMENT_NOT_FOUND",
          "PLACEMENT_INACTIVE",
          "PLACEMENT_OUTSIDE_SPONSOR_NETWORK",
          "PLACEMENT_SLOT_INVALID",
          "PLACEMENT_SLOT_UNAVAILABLE",
          "PLACEMENT_SLOT_TAKEN",
          "PLACEMENT_CYCLE",
        ];
        if (placementCodes.includes(data.error ?? "")) {
          setInvite(null);
          setNotice(t("slotRecovery"));
          if (data.slots) {
            setSlots(data.slots);
            setSelectedSlot(null);
          } else if (
            data.error === "PLACEMENT_SLOT_UNAVAILABLE" ||
            data.error === "PLACEMENT_SLOT_TAKEN"
          ) {
            void refreshPlacement(true);
          }
        }
        setError(messageFor(data.error));
        return;
      }

      const memberId = data.member?.memberId;
      if (!memberId) {
        setError(t("invalidCredentials"));
        return;
      }

      const signedIn = await signIn("credentials", {
        memberId,
        password,
        redirect: false,
      });
      if (signedIn?.error) {
        setError(t("invalidCredentials"));
        return;
      }

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["viewer"] }),
        queryClient.invalidateQueries({ queryKey: ["cart-count"] }),
        queryClient.invalidateQueries({ queryKey: ["notifications"] }),
      ]);
      toast.success(t("registrationComplete"));
      router.replace("/member/dashboard");
    } catch {
      setError(t("registrationFailed"));
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5" noValidate={false}>
      <div className="rounded-2xl border border-border/70 bg-[var(--glass-strong)] p-4">
        <span className={labelClass}>
          {t("profilePicture")}{" "}
          <span className="font-normal text-muted-foreground">({tc("optional")})</span>
        </span>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          {profileImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={profileImage} alt="" className="size-14 rounded-full border border-border object-cover" />
          ) : (
            <span className="flex size-14 items-center justify-center rounded-full border border-dashed border-border bg-background/40 text-muted-foreground">
              <ImagePlus className="size-5" aria-hidden="true" />
            </span>
          )}
          <UploadField
            accept="image/jpeg,image/png,image/webp"
            actionLabel={t("choosePicture")}
            disabled={busy}
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

      <div className="space-y-2">
        <label htmlFor={`${fieldId}-name`} className={labelClass}>
          {t("fullName")}
        </label>
        <input
          id={`${fieldId}-name`}
          required
          minLength={2}
          autoComplete="name"
          className={inputClass}
          value={fullName}
          onChange={(event) => setFullName(event.target.value)}
        />
      </div>

      <div className="space-y-2">
        <label htmlFor={`${fieldId}-phone`} className={labelClass}>
          {t("phone")}
        </label>
        <input
          id={`${fieldId}-phone`}
          required
          minLength={8}
          inputMode="tel"
          autoComplete="tel"
          className={inputClass}
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
        />
      </div>

      <div className="space-y-2">
        <label htmlFor={`${fieldId}-email`} className={labelClass}>
          {t("email")}
        </label>
        <input
          id={`${fieldId}-email`}
          type="email"
          required
          autoComplete="email"
          className={inputClass}
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
        <p className="text-xs text-muted-foreground">{t("emailSignupNote")}</p>
      </div>

      <div className="space-y-2">
        <label htmlFor={`${fieldId}-password`} className={labelClass}>
          {t("password")}
        </label>
        <div className="relative">
          <input
            id={`${fieldId}-password`}
            type={showPassword ? "text" : "password"}
            required
            minLength={8}
            autoComplete="new-password"
            className={`${inputClass} pr-12`}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            aria-describedby={`${fieldId}-password-help`}
          />
          <button
            type="button"
            onClick={() => setShowPassword((current) => !current)}
            aria-label={showPassword ? t("hidePassword") : t("showPassword")}
            className="absolute right-1.5 top-1.5 flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {showPassword ? (
              <EyeOff className="size-4" aria-hidden="true" />
            ) : (
              <Eye className="size-4" aria-hidden="true" />
            )}
          </button>
        </div>
        <div className="flex items-center gap-3" aria-live="polite">
          <div className="flex flex-1 gap-1">
            {[1, 2, 3, 4].map((level) => (
              <span
                key={level}
                className={cn(
                  "h-1.5 flex-1 rounded-full transition-colors",
                  level <= strength ? STRENGTH_BAR[strength - 1] : "bg-border/70",
                )}
              />
            ))}
          </div>
          <span
            className={cn(
              "min-w-16 text-right text-[11px] font-semibold",
              password ? STRENGTH_TEXT[strength - 1] : "text-muted-foreground",
            )}
          >
            {password ? t(STRENGTH_LABELS[strength - 1]) : t("passwordStrength")}
          </span>
        </div>
        <p id={`${fieldId}-password-help`} className="text-xs text-muted-foreground">
          {t("minimumPassword")}
        </p>
      </div>

      <hr className="border-border/70" />

      {invite ? (
        <div className="rounded-xl border border-primary/25 bg-primary/5 px-4 py-3 text-xs font-semibold text-primary">
          {t("inviteApplied")}
        </div>
      ) : null}

      <div className="rounded-2xl border border-border/70 bg-[var(--glass-strong)] p-4">
        <label htmlFor={`${fieldId}-sponsor`} className={labelClass}>
          {t("sponsorId")}
        </label>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row">
          <input
            id={`${fieldId}-sponsor`}
            required
            minLength={5}
            placeholder="SL000001"
            className={`${inputClass} uppercase`}
            value={sponsorId}
            onChange={(event) => {
              setSponsorId(event.target.value.toUpperCase());
              setSponsorName(null);
              setPlacementName(null);
              setSlots(null);
              setSelectedSlot(null);
              clearInvite();
            }}
          />
          <Button
            type="button"
            variant="outline"
            className="h-12 shrink-0"
            disabled={busy || sponsorId.trim().length < 5}
            onClick={() => void verifySponsor()}
          >
            {checking === "sponsor" ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <Check className="size-4" aria-hidden="true" />
            )}
            {t("verify")}
          </Button>
        </div>
        <p className="mt-1.5 text-xs text-muted-foreground">{t("sponsorHelp")}</p>
        {sponsorName ? (
          <VerifiedMember name={sponsorName} id={sponsorId.trim().toUpperCase()} label={t("sponsorFound")} />
        ) : null}
      </div>

      <div className="rounded-2xl border border-border/70 bg-[var(--glass-strong)] p-4">
        <label htmlFor={`${fieldId}-placement`} className={labelClass}>
          {t("placementId")}
        </label>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row">
          <input
            id={`${fieldId}-placement`}
            required
            minLength={5}
            placeholder="SL000001"
            className={`${inputClass} uppercase`}
            value={placementId}
            onChange={(event) => {
              setPlacementId(event.target.value.toUpperCase());
              setPlacementName(null);
              setSlots(null);
              setSelectedSlot(null);
              clearInvite();
            }}
            disabled={!sponsorName}
          />
          <Button
            type="button"
            variant="outline"
            className="h-12 shrink-0"
            disabled={busy || !sponsorName || placementId.trim().length < 5}
            onClick={() => void refreshPlacement(false)}
          >
            {checking === "placement" ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <RefreshCw className="size-4" aria-hidden="true" />
            )}
            {t("verify")}
          </Button>
        </div>
        <p className="mt-1.5 text-xs text-muted-foreground">{t("placementHelp")}</p>
        {placementName ? (
          <VerifiedMember
            name={placementName}
            id={placementId.trim().toUpperCase()}
            label={t("placementFound")}
          />
        ) : null}
      </div>

      {slots && slots.length > 0 ? (
        <fieldset>
          <legend className="text-sm font-semibold">{t("placementSelectSlot")}</legend>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            {slots.map((slot) => {
              const taken = slot.occupied;
              const chosen = selectedSlot === slot.slot;
              return (
                <button
                  key={slot.slot}
                  type="button"
                  disabled={taken || busy}
                  aria-pressed={chosen}
                  onClick={() => {
                    if (selectedSlot !== slot.slot) clearInvite();
                    setSelectedSlot(slot.slot);
                    setNotice(null);
                    setError(null);
                  }}
                  className={cn(
                    "rounded-2xl border p-4 text-left transition-colors",
                    taken
                      ? "cursor-not-allowed border-red-500/30 bg-red-500/5 text-red-600 dark:text-red-300"
                      : chosen
                        ? "border-emerald-500/60 bg-emerald-500/10 ring-2 ring-emerald-500/20"
                        : "border-emerald-500/25 bg-emerald-500/5 hover:border-emerald-500/60",
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-bold">
                      {t("placementSlotLabel")} {slot.slot}
                    </span>
                    {chosen ? <CheckCircle2 className="size-4 text-emerald-500" aria-hidden="true" /> : null}
                  </div>
                  <p
                    className={cn(
                      "mt-3 text-xs font-semibold",
                      taken ? "" : "text-emerald-600 dark:text-emerald-300",
                    )}
                  >
                    {taken ? t("placementFilled") : t("placementAvailable")}
                  </p>
                  {slot.member ? (
                    <p className="mt-2 truncate text-[11px] text-muted-foreground">{slot.member.fullName}</p>
                  ) : null}
                </button>
              );
            })}
          </div>
        </fieldset>
      ) : null}

      {notice ? (
        <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-600 dark:text-amber-300">
          {notice}
        </p>
      ) : null}

      {error ? (
        <p
          role="alert"
          aria-live="polite"
          className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-300"
        >
          {error}
        </p>
      ) : null}

      <Button type="submit" size="lg" className="w-full" disabled={busy}>
        {pending ? (
          <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
        ) : null}
        {pending ? t("creating") : t("createAccount")}
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        {t("alreadyMember")}{" "}
        <Link href="/login" className="font-semibold text-primary hover:underline">
          {t("logInLink")}
        </Link>
      </p>
    </form>
  );
}

function VerifiedMember({ name, id, label }: { name: string; id: string; label: string }) {
  return (
    <div className="mt-3 flex items-center gap-3 rounded-xl border border-primary/25 bg-primary/5 p-3">
      <CheckCircle2 className="size-5 shrink-0 text-primary" aria-hidden="true" />
      <div className="min-w-0">
        <p className="text-xs font-semibold text-primary">{label}</p>
        <p className="mt-0.5 truncate text-sm font-semibold">{name}</p>
        <p className="font-mono text-[11px] text-muted-foreground" translate="no">
          {id}
        </p>
      </div>
    </div>
  );
}
