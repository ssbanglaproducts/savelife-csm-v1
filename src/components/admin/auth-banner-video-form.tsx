"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Upload, Video } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { UploadField } from "@/components/ui/upload-field";
import { useRouter } from "@/i18n/navigation";
import { toAuthBannerMedia, type AuthBannerVideo } from "@/lib/auth-banner-video";
import {
  AdminConfigCommitDialog,
  type AdminConfigChange,
} from "./admin-config-commit-dialog";

const inputClass =
  "h-12 w-full rounded-xl border border-border bg-[var(--glass-strong)] px-4 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground/60 focus-visible:ring-2 focus-visible:ring-ring";

/** Admin control for the looping background video on the shared auth banner. */
export function AuthBannerVideoForm({
  initialVideo,
}: {
  initialVideo: AuthBannerVideo | null;
}) {
  const t = useTranslations("adminPanel");
  const tc = useTranslations("common");
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [video, setVideo] = useState<AuthBannerVideo | null>(initialVideo);
  const [url, setUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [pendingChanges, setPendingChanges] = useState<AdminConfigChange[]>([]);
  const [pendingAction, setPendingAction] = useState<"save" | "remove">("save");

  const media = video ? toAuthBannerMedia(video) : null;

  function openReview() {
    setError(null);
    setPendingAction("save");
    setPendingChanges([
      {
        label: file ? t("authBannerVideoFileLabel") : t("authBannerVideoUrlLabel"),
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
              data.append("adminPassword", password);
              return data;
            })(),
          })
        : await fetch("/api/admin/auth-banner-video", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ url, adminPassword: password }),
          });
      const data = (await response.json().catch(() => ({}))) as {
        video?: AuthBannerVideo | null;
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

      setVideo(data.video ?? null);
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
      setVideo(null);
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
      <h3 className="font-display text-lg font-bold">{t("authBannerVideoTitle")}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{t("authBannerVideoIntro")}</p>

      <div className="mt-5 rounded-2xl border border-border bg-[var(--glass-strong)] p-3">
        {media?.kind === "video" ? (
          <video
            src={media.src}
            muted
            autoPlay
            loop
            playsInline
            className="aspect-video w-full rounded-xl object-cover"
          />
        ) : media?.kind === "iframe" ? (
          <iframe
            src={media.src}
            title={t("authBannerVideoPreview")}
            allow="autoplay; encrypted-media; picture-in-picture"
            className="aspect-video w-full rounded-xl border-0"
          />
        ) : (
          <div className="flex aspect-video flex-col items-center justify-center gap-2 rounded-xl bg-black/40 text-muted-foreground">
            <Video className="size-7" aria-hidden="true" />
            <span className="text-sm">{t("authBannerVideoNone")}</span>
          </div>
        )}
      </div>

      <div className="mt-5 border-t border-border pt-5">
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-2">
            <label htmlFor="auth-video-url" className="block text-sm font-semibold">
              {t("authBannerVideoUrlLabel")}
            </label>
            <input
              id="auth-video-url"
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              placeholder="https://…/banner.mp4"
              className={inputClass}
            />
          </div>
          <div className="space-y-2">
            <p className="block text-sm font-semibold">{t("authBannerVideoFileLabel")}</p>
            <UploadField
              id="auth-video-file"
              inputRef={fileRef}
              kind="video"
              accept="video/mp4,video/webm"
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

        <p className="mt-3 text-xs text-muted-foreground">{t("authBannerVideoNote")}</p>

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
          {video ? (
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
