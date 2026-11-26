"use client";

import { useId, useRef, useState, type FormEvent, type ReactNode } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import {
  ArrowDown,
  ArrowUp,
  Eye,
  EyeOff,
  ImagePlus,
  Pencil,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { UploadField } from "@/components/ui/upload-field";
import { AdminFormDialog } from "./admin-form-dialog";
import type { GalleryImageDTO, GalleryPostDTO } from "@/lib/gallery";
import { uploadImage } from "@/lib/upload-client";
import {
  adminInputClass,
  adminLabelClass,
  AdminSection,
  AdminTable,
  EmptyState,
  StatusBadge,
} from "./admin-ui";

type Kind = "EVENT" | "PROGRAM";

type DraftImage = {
  key: string;
  id?: string;
  url: string;
  captionEn: string;
  captionBn: string;
};

type Draft = {
  editingId: string | null;
  kind: Kind;
  titleEn: string;
  titleBn: string;
  captionEn: string;
  captionBn: string;
  eventDate: string;
  location: string;
  published: boolean;
  sortOrder: string;
  images: DraftImage[];
};

const emptyDraft: Draft = {
  editingId: null,
  kind: "EVENT",
  titleEn: "",
  titleBn: "",
  captionEn: "",
  captionBn: "",
  eventDate: "",
  location: "",
  published: true,
  sortOrder: "0",
  images: [],
};

function draftFromPost(post: GalleryPostDTO, keyFor: () => string): Draft {
  return {
    editingId: post.id,
    kind: post.kind,
    titleEn: post.titleEn,
    titleBn: post.titleBn,
    captionEn: post.captionEn,
    captionBn: post.captionBn,
    eventDate: post.eventDate ?? "",
    location: post.location ?? "",
    published: post.published,
    sortOrder: String(post.sortOrder),
    images: post.images.map((image) => draftFromImage(image, keyFor)),
  };
}

function draftFromImage(image: GalleryImageDTO, keyFor: () => string): DraftImage {
  return {
    key: keyFor(),
    id: image.id,
    url: image.url,
    captionEn: image.captionEn,
    captionBn: image.captionBn,
  };
}

export function GalleryManager({ posts }: { posts: GalleryPostDTO[] }) {
  const ta = useTranslations("adminPanel");
  const router = useRouter();
  const formId = useId();
  const fileRef = useRef<HTMLInputElement>(null);
  const keyCounter = useRef(0);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);

  function keyFor(): string {
    keyCounter.current += 1;
    return `gallery-image-${keyCounter.current}`;
  }

  function update<K extends keyof Draft>(field: K, value: Draft[K]) {
    setDraft((current) => ({ ...current, [field]: value }));
  }

  function reset() {
    setDraft({ ...emptyDraft, images: [] });
    setShowForm(false);
  }

  async function uploadFiles(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const url = await uploadImage(file);
        setDraft((current) => ({
          ...current,
          images: [...current.images, { key: keyFor(), url, captionEn: "", captionBn: "" }],
        }));
      }
    } catch {
      toast.error(ta("galleryUploadFailed"));
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function updateImage(key: string, patch: Partial<DraftImage>) {
    setDraft((current) => ({
      ...current,
      images: current.images.map((image) =>
        image.key === key ? { ...image, ...patch } : image,
      ),
    }));
  }

  function removeImage(key: string) {
    setDraft((current) => ({
      ...current,
      images: current.images.filter((image) => image.key !== key),
    }));
  }

  function moveImage(index: number, delta: number) {
    setDraft((current) => {
      const target = index + delta;
      if (target < 0 || target >= current.images.length) return current;
      const images = [...current.images];
      const [moved] = images.splice(index, 1);
      images.splice(target, 0, moved);
      return { ...current, images };
    });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (draft.images.length === 0) {
      toast.error(ta("galleryNoImages"));
      return;
    }

    setSaving(true);
    const payload = {
      kind: draft.kind,
      title: { en: draft.titleEn.trim(), bn: draft.titleBn.trim() },
      caption: { en: draft.captionEn.trim(), bn: draft.captionBn.trim() },
      eventDate: draft.eventDate.trim() || null,
      location: draft.location.trim() || null,
      published: draft.published,
      sortOrder: Number.parseInt(draft.sortOrder, 10) || 0,
      images: draft.images.map((image, index) => ({
        ...(image.id ? { id: image.id } : {}),
        url: image.url,
        caption: {
          en: image.captionEn.trim(),
          bn: image.captionBn.trim(),
        },
        sortOrder: index,
      })),
    };

    try {
      const response = await fetch(
        draft.editingId ? `/api/admin/gallery/${draft.editingId}` : "/api/admin/gallery",
        {
          method: draft.editingId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        toast.error(data.error || ta("galleryFailed"));
        return;
      }
      toast.success(ta("gallerySaved"));
      reset();
      router.refresh();
    } catch {
      toast.error(ta("galleryFailed"));
    } finally {
      setSaving(false);
    }
  }

  function startEdit(post: GalleryPostDTO) {
    setDraft(draftFromPost(post, keyFor));
    setShowForm(true);
  }

  function openCreateForm() {
    reset();
    setShowForm(true);
  }

  function closeForm() {
    reset();
    setShowForm(false);
  }

  async function togglePublished(post: GalleryPostDTO) {
    setSaving(true);
    try {
      const response = await fetch(`/api/admin/gallery/${post.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ published: !post.published }),
      });
      if (!response.ok) {
        toast.error(ta("galleryFailed"));
        return;
      }
      toast.success(ta("galleryVisibilityUpdated"));
      router.refresh();
    } catch {
      toast.error(ta("galleryFailed"));
    } finally {
      setSaving(false);
    }
  }

  async function removePost(post: GalleryPostDTO) {
    if (!window.confirm(ta("galleryDeleteConfirm"))) return;
    setSaving(true);
    try {
      const response = await fetch(`/api/admin/gallery/${post.id}`, { method: "DELETE" });
      if (!response.ok) {
        toast.error(ta("galleryFailed"));
        return;
      }
      if (draft.editingId === post.id) reset();
      toast.success(ta("galleryDeleted"));
      router.refresh();
    } catch {
      toast.error(ta("galleryFailed"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex justify-end">
        {!showForm && !draft.editingId ? (
          <Button type="button" onClick={openCreateForm}>
            {ta("galleryCreate")}
          </Button>
        ) : null}
      </div>
      {showForm || draft.editingId ? (
        <AdminFormDialog
          title={draft.editingId ? ta("galleryEdit") : ta("galleryCreate")}
          intro={ta("galleryIntro")}
          onClose={closeForm}
        >
          <form onSubmit={(event) => void handleSubmit(event)} className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1.5">
              <label className={adminLabelClass} htmlFor={`${formId}-kind`}>
                {ta("galleryKind")}
              </label>
              <select
                id={`${formId}-kind`}
                className={adminInputClass}
                value={draft.kind}
                onChange={(event) => update("kind", event.target.value as Kind)}
              >
                <option value="EVENT">{ta("galleryKinds.EVENT")}</option>
                <option value="PROGRAM">{ta("galleryKinds.PROGRAM")}</option>
              </select>
            </div>
            <Field
              id={`${formId}-sort`}
              label={ta("gallerySortOrder")}
              value={draft.sortOrder}
              onChange={(value) => update("sortOrder", value)}
              type="number"
            />
            <Field
              id={`${formId}-date`}
              label={ta("galleryEventDate")}
              value={draft.eventDate}
              onChange={(value) => update("eventDate", value)}
              type="date"
            />
            <Field
              id={`${formId}-location`}
              label={ta("galleryLocation")}
              value={draft.location}
              onChange={(value) => update("location", value)}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              id={`${formId}-title-en`}
              label={ta("galleryTitleEn")}
              value={draft.titleEn}
              onChange={(value) => update("titleEn", value)}
              required
              maxLength={180}
            />
            <Field
              id={`${formId}-title-bn`}
              label={ta("galleryTitleBn")}
              value={draft.titleBn}
              onChange={(value) => update("titleBn", value)}
              required
              maxLength={180}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <TextareaField
              id={`${formId}-caption-en`}
              label={ta("galleryCaptionEn")}
              value={draft.captionEn}
              onChange={(value) => update("captionEn", value)}
              maxLength={500}
            />
            <TextareaField
              id={`${formId}-caption-bn`}
              label={ta("galleryCaptionBn")}
              value={draft.captionBn}
              onChange={(value) => update("captionBn", value)}
              maxLength={500}
            />
          </div>

          <label className="flex items-center gap-2 text-sm font-semibold">
            <input
              type="checkbox"
              checked={draft.published}
              onChange={(event) => update("published", event.target.checked)}
              className="size-4 rounded border-border accent-primary"
            />
            {ta("galleryPublishedLabel")}
          </label>

          <div className="space-y-3">
            <div className="space-y-2">
              <span className={adminLabelClass}>{ta("galleryImages")}</span>
              <UploadField
                inputRef={fileRef}
                kind="images"
                accept="image/jpeg,image/png,image/webp"
                ariaLabel={ta("galleryUploadImage")}
                actionLabel={ta("galleryUploadImage")}
                disabled={uploading}
                uploading={uploading}
                onSelect={(files) => void uploadFiles(files)}
              />
            </div>

            {draft.images.length ? (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {draft.images.map((image, index) => (
                  <div key={image.key} className="rounded-2xl border border-border bg-background/40 p-3">
                    <div className="relative mb-3 aspect-[4/3] overflow-hidden rounded-xl border border-border/70">
                      <Image
                        src={image.url}
                        alt=""
                        fill
                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                        className="object-cover"
                      />
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="mr-auto text-xs font-bold text-muted-foreground">#{index + 1}</span>
                      <IconButton
                        label={ta("galleryMoveUp")}
                        disabled={index === 0}
                        onClick={() => moveImage(index, -1)}
                      >
                        <ArrowUp className="size-4" aria-hidden="true" />
                      </IconButton>
                      <IconButton
                        label={ta("galleryMoveDown")}
                        disabled={index === draft.images.length - 1}
                        onClick={() => moveImage(index, 1)}
                      >
                        <ArrowDown className="size-4" aria-hidden="true" />
                      </IconButton>
                      <IconButton label={ta("galleryRemoveImage")} onClick={() => removeImage(image.key)}>
                        <X className="size-4" aria-hidden="true" />
                      </IconButton>
                    </div>
                    <div className="mt-3 space-y-2">
                      <input
                        aria-label={`${ta("galleryImageCaptionEn")} ${index + 1}`}
                        className={adminInputClass}
                        value={image.captionEn}
                        maxLength={500}
                        onChange={(event) => updateImage(image.key, { captionEn: event.target.value })}
                        placeholder={ta("galleryImageCaptionEn")}
                      />
                      <input
                        aria-label={`${ta("galleryImageCaptionBn")} ${index + 1}`}
                        className={adminInputClass}
                        value={image.captionBn}
                        maxLength={500}
                        onChange={(event) => updateImage(image.key, { captionBn: event.target.value })}
                        placeholder={ta("galleryImageCaptionBn")}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex items-center gap-2 rounded-xl border border-dashed border-border px-4 py-6 text-sm text-muted-foreground">
                <ImagePlus className="size-4" aria-hidden="true" />
                {ta("galleryImages")}
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={saving || uploading}>
              {saving ? ta("gallerySaving") : draft.editingId ? ta("galleryUpdate") : ta("galleryPublish")}
            </Button>
            <Button type="button" variant="ghost" onClick={closeForm}>
              {ta("galleryCancelEdit")}
            </Button>
          </div>
          </form>
        </AdminFormDialog>
      ) : null}

      <AdminSection id="gallery-posts" title={ta("galleryPosts")}>
        {posts.length === 0 ? (
          <EmptyState message={ta("galleryNoPosts")} />
        ) : (
          <AdminTable
            caption={ta("galleryPosts")}
            headers={[
              "",
              ta("galleryTitleEn"),
              ta("galleryKind"),
              ta("galleryImages"),
              ta("galleryStatus"),
              ta("gallerySortOrder"),
              "",
            ]}
          >
            {posts.map((post) => (
              <tr key={post.id}>
                <td className="px-4 py-3">
                  {post.images[0] ? (
                    <div className="relative size-12 overflow-hidden rounded-lg border border-border/70">
                      <Image
                        src={post.images[0].url}
                        alt=""
                        fill
                        sizes="48px"
                        className="object-cover"
                      />
                    </div>
                  ) : (
                    <span className="block size-12 rounded-lg bg-muted" />
                  )}
                </td>
                <td className="px-4 py-3 font-semibold">{post.titleEn}</td>
                <td className="px-4 py-3 text-muted-foreground">
                  {post.kind === "EVENT"
                    ? ta("galleryKinds.EVENT")
                    : ta("galleryKinds.PROGRAM")}
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {ta("galleryPhotoCount", { count: post.images.length })}
                </td>
                <td className="px-4 py-3">
                  <StatusBadge
                    tone={post.published ? "success" : "neutral"}
                    label={post.published ? ta("galleryVisible") : ta("galleryHidden")}
                  />
                </td>
                <td className="px-4 py-3 text-muted-foreground">{post.sortOrder}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1">
                    <IconButton label={ta("galleryEditAction")} onClick={() => startEdit(post)}>
                      <Pencil className="size-4" aria-hidden="true" />
                    </IconButton>
                    <IconButton
                      label={post.published ? ta("galleryHideAction") : ta("galleryShowAction")}
                      disabled={saving}
                      onClick={() => void togglePublished(post)}
                    >
                      {post.published ? (
                        <EyeOff className="size-4" aria-hidden="true" />
                      ) : (
                        <Eye className="size-4" aria-hidden="true" />
                      )}
                    </IconButton>
                    <IconButton
                      label={ta("galleryDeleteAction")}
                      disabled={saving}
                      onClick={() => void removePost(post)}
                    >
                      <Trash2 className="size-4" aria-hidden="true" />
                    </IconButton>
                  </div>
                </td>
              </tr>
            ))}
          </AdminTable>
        )}
      </AdminSection>
    </div>
  );
}

function Field({
  id,
  label,
  value,
  onChange,
  type = "text",
  required = false,
  maxLength,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
  maxLength?: number;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className={adminLabelClass}>
        {label}
        {required ? <span aria-hidden="true"> *</span> : null}
      </label>
      <input
        id={id}
        className={adminInputClass}
        type={type}
        value={value}
        required={required}
        maxLength={maxLength}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}

function TextareaField({
  id,
  label,
  value,
  onChange,
  maxLength,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  maxLength?: number;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className={adminLabelClass}>
        {label}
      </label>
      <textarea
        id={id}
        className="min-h-20 w-full rounded-xl border border-border bg-[var(--glass-strong)] px-3 py-2 text-sm outline-none transition-colors placeholder:text-muted-foreground/60 focus-visible:ring-2 focus-visible:ring-ring"
        value={value}
        maxLength={maxLength}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}

function IconButton({
  label,
  onClick,
  disabled = false,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="inline-flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40"
    >
      {children}
    </button>
  );
}
