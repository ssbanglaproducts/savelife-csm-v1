"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Loader2, Upload, Video } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { UploadField } from "@/components/ui/upload-field";
import { useRouter } from "@/i18n/navigation";
import { toAuthBannerMedia, type AuthBannerVideo } from "@/lib/auth-banner-video";
import { AdminFormDialog } from "./admin-form-dialog";

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
  const [showForm, setShowForm] = useState(false);

  const media = video ? toAuthBannerMedia(video) : null;

  async function save() {
    setError(null);
    setPending(true);
    try {
      const response = file
        ? await fetch("/api/admin/auth-banner-video", {
            method: "POST",
            body: (() => {
              const data = new FormData();
              data.append("file", file);
              return data;
            })(),
          })
        : await fetch("/api/admin/auth-banner-video", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ url }),
          });
      const data = (await response.json().catch(() => ({}))) as {
        video?: AuthBannerVideo | null;
        error?: string;
      };

      if (!response.ok) {
        setError(t("authBannerVideoInvalid"));
        toast.error(t("authBannerVideoInvalid"));
        return;
      }

      setVideo(data.video ?? null);
      setUrl("");
      setFile(null);
      if (fileRef.current) fileRef.current.value = "";
      setShowForm(false);
      router.refresh();
      toast.success(tc("success"));
    } catch {
      setError(t("authBannerVideoInvalid"));
      toast.error(tc("error"));
    } finally {
      setPending(false);
    }
  }

  async function remove() {
    setError(null);
    setPending(true);
    try {
      const response = await fetch("/api/admin/auth-banner-video", { method: "DELETE" });
      if (!response.ok) {
        setError(t("authBannerVideoInvalid"));
        toast.error(tc("error"));
        return;
      }
      setVideo(null);
      setUrl("");
      setFile(null);
      if (fileRef.current) fileRef.current.value = "";
      setShowForm(false);
      router.refresh();
      toast.success(tc("success"));
    } catch {
      toast.error(tc("error"));
    } finally {
      setPending(false);
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

      {showForm ? (
        <AdminFormDialog
          title={t("authBannerVideoTitle")}
          intro={t("authBannerVideoIntro")}
          onClose={() => setShowForm(false)}
        >
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
        <Button type="button" onClick={() => void save()} disabled={pending}>
          {pending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Upload className="size-4" aria-hidden="true" />}
          {t("authBannerVideoSave")}
        </Button>
        {video ? (
          <Button type="button" variant="outline" onClick={() => void remove()} disabled={pending}>
            {t("authBannerVideoRemove")}
          </Button>
        ) : null}
      </div>
        </AdminFormDialog>
      ) : (
        <div className="mt-5 flex justify-end">
          <Button type="button" onClick={() => setShowForm(true)}>
            {t("authBannerVideoEdit")}
          </Button>
        </div>
      )}
    </div>
  );
}
