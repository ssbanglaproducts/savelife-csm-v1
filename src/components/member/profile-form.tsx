"use client";

import { useId, useState, type FormEvent } from "react";
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { Loader2, LockKeyhole } from "lucide-react";
import { Button } from "@/components/ui/button";
import { UploadField } from "@/components/ui/upload-field";
import { uploadImage } from "@/lib/upload-client";
import { memberFieldClass } from "./form-styles";

export type ProfileInitialValues = {
  fullName: string;
  email: string;
  phone: string;
  address: {
    street: string;
    thana: string;
    district: string;
    postalCode: string;
    isMain: boolean;
  } | null;
  profileImage: string | null;
};

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <div className={memberFieldClass}>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-1 break-words font-display font-bold" translate="no">{value || "—"}</dd>
    </div>
  );
}

export function ProfileForm({ initial }: { initial: ProfileInitialValues }) {
  const tAuth = useTranslations("auth");
  const tCommon = useTranslations("common");
  const tPanel = useTranslations("memberPanel");
  const router = useRouter();
  const fieldId = useId();
  const [pending, setPending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [profileImage, setProfileImage] = useState(initial.profileImage);
  const [profileName, setProfileName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const addressLines = initial.address
    ? [
        initial.address.street,
        [initial.address.thana, initial.address.district].filter(Boolean).join(", "),
        initial.address.postalCode,
      ].filter(Boolean)
    : [];

  async function handleFile(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    setSaved(false);
    try {
      const url = await uploadImage(file);
      setProfileImage(url);
      setProfileName(file.name);
    } catch {
      setProfileImage(null);
      setProfileName(null);
      setError(tCommon("error"));
    } finally {
      setUploading(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    setSaved(false);

    try {
      const response = await fetch("/api/member/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profileImage }),
      });
      if (response.status === 401) {
        router.push("/login");
        return;
      }
      if (!response.ok) {
        setError(response.status === 403 ? tPanel("lockedFieldsHint") : tCommon("error"));
        return;
      }

      setSaved(true);
      router.refresh();
    } catch {
      setError(tCommon("error"));
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="glass min-w-0 rounded-3xl p-6 shadow-xl sm:p-8">
      <fieldset className="min-w-0 space-y-4">
        <legend className="font-display text-lg font-bold">{tPanel("profilePhoto")}</legend>
        <div className="flex flex-wrap items-center gap-4">
          <div
            role="img"
            aria-label={tPanel("profilePhoto")}
            className="flex size-16 shrink-0 items-center justify-center rounded-2xl border border-border bg-primary/10 font-display text-lg font-bold text-primary"
            style={
              profileImage
                ? {
                    backgroundImage: `url("${profileImage}")`,
                    backgroundPosition: "center",
                    backgroundSize: "cover",
                  }
                : undefined
            }
          >
            {profileImage
              ? null
              : initial.fullName
                  .split(/\s+/)
                  .filter(Boolean)
                  .slice(0, 2)
                  .map((part) => part[0]?.toUpperCase() ?? "")
                  .join("") || "?"}
          </div>
          <div className="min-w-0 flex-1">
            <UploadField
              id={`${fieldId}-photo`}
              accept="image/jpeg,image/png,image/webp"
              actionLabel={tPanel("profilePhoto")}
              hint={tPanel("profilePhotoHint")}
              uploading={uploading}
              selectedName={profileName}
              onSelect={(files) => void handleFile(files)}
              onRemove={() => {
                setProfileImage(null);
                setProfileName(null);
                setSaved(false);
              }}
            />
          </div>
        </div>
      </fieldset>

      <fieldset className="mt-8 min-w-0 space-y-4">
        <legend className="font-display text-lg font-bold">{tPanel("personalTitle")}</legend>
        <dl className="grid gap-4 sm:grid-cols-2">
          <ReadOnlyField label={tAuth("fullName")} value={initial.fullName} />
          <ReadOnlyField label={tAuth("email")} value={initial.email} />
          <ReadOnlyField label={tAuth("phone")} value={initial.phone} />
        </dl>
      </fieldset>

      <fieldset className="mt-8 min-w-0 space-y-4">
        <legend className="font-display text-lg font-bold">{tPanel("addressTitle")}</legend>
        <dl className="grid gap-4 sm:grid-cols-2">
          <ReadOnlyField
            label={initial.address?.isMain ? tPanel("mainAddressBadge") : tPanel("savedAddress")}
            value={addressLines.join(" · ") || "—"}
          />
        </dl>
      </fieldset>

      <p className="mt-6 flex items-start gap-2 rounded-xl border border-border bg-background/40 p-4 text-xs leading-relaxed text-muted-foreground">
        <LockKeyhole className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
        {tPanel("lockedFieldsHint")}
      </p>

      {error ? (
        <p role="alert" className="mt-6 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-500">
          {error}
        </p>
      ) : null}
      {saved ? (
        <p role="status" className="mt-6 rounded-xl border border-primary/30 bg-primary/10 px-4 py-3 text-sm text-primary">
          {tCommon("saved")}
        </p>
      ) : null}

      <div className="mt-8 flex flex-col gap-3 border-t border-border pt-6 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-muted-foreground">{tPanel("profileIntro")}</p>
        <Button type="submit" size="lg" disabled={pending || uploading}>
          {pending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
          {pending ? tCommon("saving") : tCommon("save")}
        </Button>
      </div>
    </form>
  );
}
