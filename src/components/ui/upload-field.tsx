"use client";

import { useId, useState, type DragEvent, type RefObject } from "react";
import { useTranslations } from "next-intl";
import { Check, Loader2, UploadCloud, Video, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type UploadKind = "image" | "images" | "video";

/** Shared drop zone for every image/video upload in the platform. */
export function UploadField({
  id,
  accept,
  kind = "image",
  disabled = false,
  uploading = false,
  actionLabel,
  hint,
  selectedName,
  onSelect,
  onRemove,
  inputRef,
  ariaLabel,
  ariaLabelledBy,
  className,
}: {
  id?: string;
  accept: string;
  kind?: UploadKind;
  disabled?: boolean;
  uploading?: boolean;
  actionLabel?: string;
  hint?: string;
  selectedName?: string | null;
  onSelect: (files: FileList | null) => void;
  onRemove?: () => void;
  inputRef?: RefObject<HTMLInputElement | null>;
  ariaLabel?: string;
  ariaLabelledBy?: string;
  className?: string;
}) {
  const tc = useTranslations("common");
  const generatedId = useId();
  const inputId = id ?? `${generatedId}-upload`;
  const [dragging, setDragging] = useState(false);

  const defaultAction =
    kind === "video"
      ? tc("uploadChooseVideo")
      : kind === "images"
        ? tc("uploadChooseFiles")
        : tc("uploadChooseImage");
  const defaultHint =
    kind === "video"
      ? tc("uploadVideoHint")
      : kind === "images"
        ? tc("uploadMultipleHint")
        : tc("uploadImageHint");

  function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    onSelect(files);
  }

  function handleDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setDragging(false);
    if (disabled) return;
    handleFiles(event.dataTransfer.files);
  }

  return (
    <div className={cn("space-y-2", className)}>
      <label
        htmlFor={inputId}
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledBy}
        onDragEnter={(event) => {
          event.preventDefault();
          if (!disabled) setDragging(true);
        }}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        className={cn(
          "group flex cursor-pointer items-center gap-3 rounded-2xl border border-dashed px-3.5 py-3 transition-colors",
          dragging
            ? "border-primary bg-primary/[0.07]"
            : "border-border/70 bg-background/40 hover:border-primary/40 hover:bg-primary/[0.035]",
          disabled && "pointer-events-none opacity-60",
        )}
      >
        <input
          ref={inputRef}
          id={inputId}
          type="file"
          accept={accept}
          multiple={kind === "images"}
          disabled={disabled}
          className="sr-only"
          onChange={(event) => handleFiles(event.target.files)}
        />
        <span
          className={cn(
            "flex size-10 shrink-0 items-center justify-center rounded-xl border border-primary/15 bg-primary/10 text-primary ring-1 ring-inset ring-primary/10",
          )}
        >
          {uploading ? (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          ) : kind === "video" ? (
            <Video className="size-4" aria-hidden="true" />
          ) : (
            <UploadCloud className="size-4" aria-hidden="true" />
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-bold text-foreground">
            {uploading ? tc("uploadUploading") : actionLabel ?? defaultAction}
          </span>
          <span className="mt-0.5 block text-xs text-muted-foreground">
            {hint ?? `${defaultHint} · ${tc("uploadDropHint")}`}
          </span>
          {selectedName ? (
            <span className="mt-1.5 flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-300">
              <Check className="size-3.5 shrink-0" aria-hidden="true" />
              <span className="shrink-0">{tc("uploadSelected")}</span>
              <span className="truncate font-mono">{selectedName}</span>
            </span>
          ) : null}
        </span>
      </label>
      {onRemove && selectedName ? (
        <button
          type="button"
          disabled={disabled}
          onClick={onRemove}
          className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
        >
          <X className="size-3.5" aria-hidden="true" />
          {tc("remove")}
        </button>
      ) : null}
    </div>
  );
}
