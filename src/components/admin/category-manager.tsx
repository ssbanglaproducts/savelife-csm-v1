"use client";

import { useId, useRef, useState, type FormEvent } from "react";
import { useLocale, useTranslations } from "next-intl";
import Image from "next/image";
import { ImagePlus, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  StatusBadge,
  adminInputClass,
  adminLabelClass,
} from "@/components/admin/admin-ui";
import { Button } from "@/components/ui/button";
import { DialogShell } from "@/components/ui/dialog-shell";
import { UploadField } from "@/components/ui/upload-field";
import { useRouter } from "@/i18n/navigation";
import { slugifyCategoryName } from "@/lib/category-admin";
import { cn } from "@/lib/utils";

export type AdminCategoryView = {
  readonly id: string;
  readonly name: string;
  readonly nameBn: string | null;
  readonly slug: string;
  readonly description: string | null;
  readonly image: string | null;
  readonly sortOrder: number;
  readonly isActive: boolean;
  readonly productCount: number;
};

type Draft = {
  name: string;
  nameBn: string;
  slug: string;
  description: string;
  image: string;
  sortOrder: string;
  isActive: boolean;
};

function toDraft(category: AdminCategoryView | null): Draft {
  return {
    name: category?.name ?? "",
    nameBn: category?.nameBn ?? "",
    slug: category?.slug ?? "",
    description: category?.description ?? "",
    image: category?.image ?? "",
    sortOrder: String(category?.sortOrder ?? 0),
    isActive: category?.isActive ?? true,
  };
}

export function CategoryManager({ categories }: { categories: readonly AdminCategoryView[] }) {
  const t = useTranslations("adminPanel");
  const tc = useTranslations("common");
  const locale = useLocale();
  const router = useRouter();
  const [editing, setEditing] = useState<AdminCategoryView | "new" | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminCategoryView | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function confirmDelete(): Promise<void> {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      const response = await fetch(`/api/admin/categories/${deleteTarget.id}`, {
        method: "DELETE",
        credentials: "same-origin",
      });
      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as { error?: string };
        if (data.error === "CATEGORY_HAS_PRODUCTS") {
          throw new Error(t("categoryHasProducts"));
        }
        throw new Error(t("categoryDeleteFailed"));
      }
      toast.success(t("categoryDeleted"));
      setDeleteTarget(null);
      router.refresh();
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : t("categoryDeleteFailed"));
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button type="button" onClick={() => setEditing("new")}>
          <Plus className="size-4" aria-hidden="true" />
          {t("addCategory")}
        </Button>
      </div>

      {categories.length === 0 ? (
        <p className="glass rounded-2xl px-5 py-10 text-center text-sm text-muted-foreground">
          {tc("noResults")}
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {categories.map((category) => {
            const name = locale === "bn" && category.nameBn ? category.nameBn : category.name;
            const description = category.description;
            return (
              <article key={category.id} className="glass min-w-0 overflow-hidden rounded-2xl">
                <div className="relative aspect-[16/9] bg-muted/40">
                  {category.image ? (
                    <Image
                      src={category.image}
                      alt={name}
                      fill
                      unoptimized
                      sizes="(max-width: 640px) 100vw, 33vw"
                      className="object-cover"
                    />
                  ) : (
                    <div className="grid size-full place-items-center text-muted-foreground">
                      <ImagePlus className="size-8" aria-hidden="true" />
                    </div>
                  )}
                  <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/70 to-transparent" />
                  <div className="absolute bottom-2 left-2">
                    <StatusBadge
                      tone={category.isActive ? "success" : "danger"}
                      label={category.isActive ? t("categoryActive") : t("categoryInactive")}
                    />
                  </div>
                </div>
                <div className="space-y-3 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="min-w-0 truncate font-semibold">{name}</h3>
                    <span className="shrink-0 rounded-full bg-primary/10 px-2 py-1 text-[11px] font-bold tabular-nums text-primary">
                      {t("categoryProductCount", { count: category.productCount })}
                    </span>
                  </div>
                  <p className="truncate font-mono text-[11px] text-muted-foreground" translate="no">
                    {category.slug}
                  </p>
                  {description ? (
                    <p className="line-clamp-2 text-xs text-muted-foreground">{description}</p>
                  ) : null}
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setEditing(category)}
                    >
                      <Pencil className="size-3.5" aria-hidden="true" />
                      {t("editCategory")}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      className="text-red-600 hover:bg-red-500/10 hover:text-red-600 dark:text-red-400"
                      onClick={() => {
                        setDeleteError(null);
                        setDeleteTarget(category);
                      }}
                    >
                      <Trash2 className="size-3.5" aria-hidden="true" />
                      {tc("delete")}
                    </Button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {editing ? (
        <CategoryEditorDialog
          key={editing === "new" ? "new" : editing.id}
          category={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
        />
      ) : null}

      {deleteTarget ? (
        <DialogShell
          title={t("deleteCategoryTitle")}
          intro={t("deleteCategoryIntro")}
          titleId={`delete-category-${deleteTarget.id}`}
          onClose={() => setDeleteTarget(null)}
        >
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {t("categoryDeleteConfirm", { name: deleteTarget.name })}
            </p>
            {deleteError ? (
              <p role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-600 dark:text-red-300">
                {deleteError}
              </p>
            ) : null}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setDeleteTarget(null)}>
                {tc("cancel")}
              </Button>
              <Button type="button" variant="destructive" disabled={deleting} onClick={() => void confirmDelete()}>
                {deleting ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
                {tc("delete")}
              </Button>
            </div>
          </div>
        </DialogShell>
      ) : null}
    </div>
  );
}

function CategoryEditorDialog({
  category,
  onClose,
}: {
  category: AdminCategoryView | null;
  onClose: () => void;
}) {
  const t = useTranslations("adminPanel");
  const tc = useTranslations("common");
  const router = useRouter();
  const fieldId = useId();
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState<Draft>(() => toDraft(category));
  const [slugTouched, setSlugTouched] = useState(Boolean(category));
  const [pending, setPending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [imageFileName, setImageFileName] = useState<string | null>(
    category?.image?.split("/").pop() ?? null,
  );
  const [error, setError] = useState<string | null>(null);

  function update<K extends keyof Draft>(key: K, value: Draft[K]): void {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  async function uploadImage(files: FileList | null): Promise<void> {
    const file = files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch("/api/uploads", { method: "POST", body: formData });
      if (!response.ok) throw new Error("upload failed");
      const data = (await response.json()) as { url: string };
      update("image", data.url);
      setImageFileName(data.url.split("/").pop() ?? file.name);
      toast.success(t("categoryImageUploaded"));
    } catch {
      const message = t("categoryImageUploadFailed");
      setError(message);
      toast.error(message);
    } finally {
      setUploading(false);
      if (imageInputRef.current) imageInputRef.current.value = "";
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(null);

    const name = draft.name.trim();
    const slug = draft.slug.trim();
    if (!name || !slug) {
      setError(t("categoryBasicFieldsRequired"));
      return;
    }

    const sortOrder = Number(draft.sortOrder);
    if (!Number.isInteger(sortOrder) || sortOrder < 0 || sortOrder > 100_000) {
      setError(t("categorySortInvalid"));
      return;
    }

    const nullable = (value: string) => value.trim() || null;
    const payload = {
      name,
      nameBn: nullable(draft.nameBn),
      slug,
      description: nullable(draft.description),
      image: nullable(draft.image),
      sortOrder,
      isActive: draft.isActive,
    };

    setPending(true);
    try {
      const response = await fetch(
        category ? `/api/admin/categories/${category.id}` : "/api/admin/categories",
        {
          method: category ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify(payload),
        },
      );
      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as { error?: string };
        if (data.error === "SLUG_TAKEN") throw new Error(t("categorySlugTaken"));
        if (data.error === "INVALID_IMAGE") throw new Error(t("categoryImageInvalid"));
        throw new Error(category ? t("categoryUpdateFailed") : t("categoryCreateFailed"));
      }
      toast.success(category ? t("categoryUpdated") : t("categoryCreated"));
      router.refresh();
      onClose();
    } catch (saveError) {
      const message =
        saveError instanceof Error ? saveError.message : t("categoryCreateFailed");
      setError(message);
      toast.error(message);
    } finally {
      setPending(false);
    }
  }

  return (
    <DialogShell
      title={category ? t("editCategory") : t("addCategory")}
      intro={t("categoryEditorIntro")}
      titleId={`category-editor-${category?.id ?? "new"}`}
      onClose={onClose}
      panelClassName="sm:max-w-2xl"
    >
      <form onSubmit={(event) => void handleSubmit(event)} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-1.5">
            <span className={adminLabelClass}>{t("categoryNameEn")}</span>
            <input
              data-dialog-autofocus
              className={adminInputClass}
              value={draft.name}
              maxLength={200}
              onChange={(event) => {
                const name = event.target.value;
                update("name", name);
                if (!slugTouched) update("slug", slugifyCategoryName(name));
              }}
            />
          </label>
          <label className="space-y-1.5">
            <span className={adminLabelClass}>{t("categoryNameBn")}</span>
            <input
              className={adminInputClass}
              value={draft.nameBn}
              maxLength={200}
              onChange={(event) => update("nameBn", event.target.value)}
            />
          </label>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-1.5">
            <span className={adminLabelClass}>{t("categorySlug")}</span>
            <input
              className={cn(adminInputClass, "font-mono")}
              value={draft.slug}
              maxLength={240}
              onChange={(event) => {
                setSlugTouched(true);
                update("slug", event.target.value.toLowerCase());
              }}
            />
          </label>
          <label className="space-y-1.5">
            <span className={adminLabelClass}>{t("categorySortOrder")}</span>
            <input
              type="number"
              min={0}
              max={100000}
              className={adminInputClass}
              value={draft.sortOrder}
              onChange={(event) => update("sortOrder", event.target.value)}
            />
          </label>
        </div>

        <label className="block space-y-1.5">
          <span className={adminLabelClass}>{t("categoryDescriptionEn")}</span>
          <textarea
            className={cn(adminInputClass, "h-auto min-h-20 py-2")}
            value={draft.description}
            maxLength={4000}
            onChange={(event) => update("description", event.target.value)}
          />
        </label>

        <div className="space-y-2">
          <span className={adminLabelClass}>{t("categoryImage")}</span>
          <div className="flex items-center gap-3">
            <div className="relative size-16 shrink-0 overflow-hidden rounded-xl border border-border bg-muted/40">
              {draft.image ? (
                <Image src={draft.image} alt="" fill unoptimized sizes="64px" className="object-cover" />
              ) : (
                <span className="grid size-full place-items-center text-muted-foreground">
                  <ImagePlus className="size-5" aria-hidden="true" />
                </span>
              )}
            </div>
            <UploadField
              id={`${fieldId}-image`}
              accept="image/jpeg,image/png,image/webp,image/gif"
              inputRef={imageInputRef}
              uploading={uploading}
              disabled={uploading}
              selectedName={imageFileName}
              onSelect={(files) => void uploadImage(files)}
              onRemove={() => {
                update("image", "");
                setImageFileName(null);
              }}
              className="min-w-0 flex-1"
            />
          </div>
        </div>

        <label className="flex items-center gap-3 rounded-xl border border-border bg-background/40 px-3 py-2.5">
          <input
            type="checkbox"
            checked={draft.isActive}
            onChange={(event) => update("isActive", event.target.checked)}
            className="size-4 accent-primary"
          />
          <span className="text-sm font-semibold">{t("categoryActive")}</span>
        </label>

        {error ? (
          <p
            role="alert"
            className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-600 dark:text-red-300"
          >
            {error}
          </p>
        ) : null}

        <div className="flex justify-end gap-2 border-t border-border pt-4">
          <Button type="button" variant="outline" onClick={onClose}>
            {tc("cancel")}
          </Button>
          <Button type="submit" disabled={pending || uploading}>
            {pending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
            {category ? tc("save") : t("addCategory")}
          </Button>
        </div>
      </form>
    </DialogShell>
  );
}
