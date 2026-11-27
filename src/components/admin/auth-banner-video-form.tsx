"use client";

import { useRef, useState } from "react";
import NextImage from "next/image";
import { useTranslations } from "next-intl";
import { Image as ImageIcon, Upload, Video } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { UploadField } from "@/components/ui/upload-field";
import { useRouter } from "@/i18n/navigation";
import {
  toAuthBannerMedia,
  type AuthBannerSetting,
} from "@/lib/auth-banner-video";
import {
  AdminConfigCommitDialog,
  type AdminConfigChange,
} from "./admin-config-commit-dialog";

const inputClass =
  "h-12 w-full rounded-xl border border-border bg-[var(--glass-strong)] px-4 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground/60 focus-visible:ring-2 focus-visible:ring-ring";

type MediaType = "image" | "video";

function initialMediaType(setting: AuthBannerSetting | null): MediaType {
  return setting?.kind === "imageUpload" || setting?.kind === "imageDirect" ? "image" : "video";
}

/** Admin control for the image or looping video on the shared auth banner. */
export function AuthBannerVideoForm({
  initialSetting,
}: {
  initialSetting: AuthBannerSetting | null;
}) {
  const t = useTranslations("adminPanel");
  const tc = useTranslations("common");
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [setting, setSetting] = useState<AuthBannerSetting | null>(initialSetting);
  const [mediaType, setMediaType] = useState<MediaType>(initialMediaType(initialSetting));
  const [url, setUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [pendingChanges, setPendingChanges] = useState<AdminConfigChange[]>([]);
  const [pendingAction, setPendingAction] = useState<"save" | "remove">("save");

  const media = setting ? toAuthBannerMedia(setting) : null;
  const urlLabel =
    mediaType === "image" ? t("authBannerMediaImageUrlLabel") : t("authBannerVideoUrlLabel");
  const fileLabel =
    mediaType === "image" ? t("authBannerMediaImageFileLabel") : t("authBannerVideoFileLabel");
  const urlPlaceholder = mediaType === "image" ? "https://…/banner.jpg" : "https://…/banner.mp4";
  const emptyIcon = mediaType === "image" ? <ImageIcon /> : <Video />;

  function changeMediaType(next: MediaType) {
    if (next === mediaType) return;
    setMediaType(next);
    setUrl("");
    setFile(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  function openReview() {
    setError(null);
    setPendingAction("save");
    setPendingChanges([
      {
        label: file ? fileLabel : urlLabel,
        value: file?.name || url || t("authBannerVideoNone"),
      },
    ]);
    setReviewOpen(true);
  }

  function openRemoveReview() {
    setError(null);
    setPendingAction("remove");
    setPendingChanges([
      {
        label: t("authBannerVideoTitle"),
        value: t("authBannerVideoRemove"),
      },
    ]);
    setReviewOpen(true);
  }

  async function save(password: string): Promise<boolean> {
    setError(null);
    setPending(true);
    let saved = false;
    try {
      const response = file
        ? await fetch("/api/admin/auth-banner-video", {
            method: "POST",
            body: (() => {
              const data = new FormData();
              data.append("file", file);
              data.append("mediaType", mediaType);
              data.append("adminPassword", password);
              return data;
            })(),
          })
        : await fetch("/api/admin/auth-banner-video", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ url, mediaType, adminPassword: password }),
          });
      const data = (await response.json().catch(() => ({}))) as {
        video?: AuthBannerSetting | null;
        error?: string;
      };

      if (!response.ok) {
        const message =
          data.error === "INVALID_ADMIN_PASSWORD"
            ? t("configInvalidPassword")
            : t("authBannerVideoInvalid");
        setError(message);
        toast.error(message);
        return false;
      }

      setSetting(data.video ?? null);
      setUrl("");
      setFile(null);
      if (fileRef.current) fileRef.current.value = "";
      router.refresh();
      toast.success(tc("success"));
      saved = true;
      return true;
    } catch {
      setError(t("authBannerVideoInvalid"));
      toast.error(tc("error"));
      return false;
    } finally {
      setPending(false);
      if (saved) setReviewOpen(false);
    }
  }

  async function remove(password: string): Promise<boolean> {
    setError(null);
    setPending(true);
    let removed = false;
    try {
      const response = await fetch("/api/admin/auth-banner-video", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adminPassword: password }),
      });
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        const message =
          data.error === "INVALID_ADMIN_PASSWORD"
            ? t("configInvalidPassword")
            : t("authBannerVideoInvalid");
        setError(message);
        toast.error(message);
        return false;
      }
      setSetting(null);
      setUrl("");
      setFile(null);
      if (fileRef.current) fileRef.current.value = "";
      router.refresh();
      toast.success(tc("success"));
      removed = true;
      return true;
    } catch {
      toast.error(tc("error"));
      return false;
    } finally {
      setPending(false);
      if (removed) setReviewOpen(false);
    }
  }

  return (
    <div className="glass rounded-2xl p-5 sm:p-6">
      <div
        className="relative mt-5 flex aspect-video flex-col items-center justify-center gap-2 overflow-hidden rounded-2xl border border-border bg-[var(--glass-strong)] p-3 text-muted-foreground"
        aria-label={t("authBannerVideoPreview")}
      >
        {media?.kind === "image" ? (
          <NextImage
            src={media.src}
            alt=""
            fill
            unoptimized
            sizes="(max-width: 767px) 100vw, 52vw"
            className="pointer-events-none object-cover"
          />
        ) : media?.kind === "video" ? (
          <video
            src={media.src}
            muted
            autoPlay
            loop
            playsInline
            className="absolute inset-0 size-full rounded-xl object-cover"
          />
        ) : media?.kind === "iframe" ? (
          <iframe
            src={media.src}
            title={t("authBannerVideoPreview")}
            allow="autoplay; encrypted-media; picture-in-picture"
            sandbox="allow-scripts allow-same-origin allow-autoplay allow-presentation"
            referrerPolicy="strict-origin-when-cross-origin"
            className="absolute inset-0 size-full rounded-xl border-0"
          />
        ) : (
          <>
            {emptyIcon}
            <span className="text-sm">{t("authBannerVideoNone")}</span>
          </>
        )}
      </div>

      <div className="mt-5 border-t border-border pt-5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="mr-1 text-sm font-semibold">{t("authBannerMediaTypeLabel")}</span>
          <Button
            type="button"
            size="sm"
            variant={mediaType === "image" ? "default" : "outline"}
            aria-pressed={mediaType === "image"}
            onClick={() => changeMediaType("image")}
          >
            <ImageIcon className="size-4" aria-hidden="true" />
            {t("authBannerMediaTypeImage")}
          </Button>
          <Button
            type="button"
            size="sm"
            variant={mediaType === "video" ? "default" : "outline"}
            aria-pressed={mediaType === "video"}
            onClick={() => changeMediaType("video")}
          >
            <Video className="size-4" aria-hidden="true" />
            {t("authBannerMediaTypeVideo")}
          </Button>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <div className="space-y-2">
            <label htmlFor="auth-video-url" className="block text-sm font-semibold">
              {urlLabel}
            </label>
            <input
              id="auth-video-url"
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              placeholder={urlPlaceholder}
              className={inputClass}
            />
          </div>
          <div className="space-y-2">
            <p className="block text-sm font-semibold">{fileLabel}</p>
            <UploadField
              id="auth-video-file"
              inputRef={fileRef}
              kind={mediaType}
              accept={
                mediaType === "image"
                  ? "image/jpeg,image/png,image/webp"
                  : "video/mp4,video/webm"
              }
              selectedName={file?.name ?? null}
              onSelect={(files) => setFile(files?.[0] ?? null)}
              onRemove={
                file
                  ? () => {
                      setFile(null);
                      if (fileRef.current) fileRef.current.value = "";
                    }
                  : undefined
              }
            />
          </div>
        </div>

        <p className="mt-3 text-xs text-muted-foreground">
          {mediaType === "image" ? t("authBannerMediaImageNote") : t("authBannerVideoNote")}
        </p>

        {error ? (
          <p role="alert" className="mt-3 text-sm text-red-600 dark:text-red-300">
            {error}
          </p>
        ) : null}

        <div className="mt-5 flex flex-wrap gap-2">
          <Button type="button" onClick={openReview} disabled={pending}>
            <Upload className="size-4" aria-hidden="true" />
            {t("authBannerVideoSave")}
          </Button>
          {setting ? (
            <Button type="button" variant="outline" onClick={openRemoveReview} disabled={pending}>
              {t("authBannerVideoRemove")}
            </Button>
          ) : null}
        </div>

        {reviewOpen ? (
          <AdminConfigCommitDialog
            onClose={() => setReviewOpen(false)}
            changes={pendingChanges}
            pending={pending}
            error={error}
            onClearError={() => setError(null)}
            onCommit={(password) =>
              pendingAction === "remove" ? remove(password) : save(password)
            }
          />
        ) : null}
      </div>
    </div>
  );
}
