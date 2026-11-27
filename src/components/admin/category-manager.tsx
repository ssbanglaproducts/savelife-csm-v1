"use client";

import { useId, useRef, useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import Image from "next/image";
import { ImagePlus, LayoutGrid, List, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
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
  readonly image: string | null;
  readonly sortOrder: number;
  readonly isActive: boolean;
  readonly parentId: string | null;
  readonly parentName: string | null;
  readonly parentNameBn: string | null;
  readonly productCount: number;
  readonly childCount: number;
};

type CategoryTab = "MAIN" | "SUB";
type EditState = {
  category: AdminCategoryView | null;
  mode: CategoryTab;
};
type Draft = {
  name: string;
  nameBn: string;
  slug: string;
  image: string;
  sortOrder: string;
  isActive: boolean;
  parentId: string;
};

function toDraft(category: AdminCategoryView | null): Draft {
  return {
    name: category?.name ?? "",
    nameBn: category?.nameBn ?? "",
    slug: category?.slug ?? "",
    image: category?.image ?? "",
    sortOrder: String(category?.sortOrder ?? 0),
    isActive: category?.isActive ?? true,
    parentId: category?.parentId ?? "",
  };
}

export function CategoryManager({
  categories,
  locale,
}: {
  categories: readonly AdminCategoryView[];
  locale: string;
}) {
  const t = useTranslations("adminPanel");
  const tc = useTranslations("common");
  const router = useRouter();
  const [tab, setTab] = useState<CategoryTab>("MAIN");
  const [editing, setEditing] = useState<EditState | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminCategoryView | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const mainCategories = categories.filter((category) => !category.parentId);
  const subcategories = categories.filter((category) => category.parentId);
  const visible = tab === "MAIN" ? mainCategories : subcategories;
  const tabLabels: Record<CategoryTab, string> = {
    MAIN: t("categoryTabMain"),
    SUB: t("categoryTabSub"),
  };
  const tabIntros: Record<CategoryTab, string> = {
    MAIN: t("categoryTabMainIntro"),
    SUB: t("categoryTabSubIntro"),
  };

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
        if (data.error === "CATEGORY_HAS_PRODUCTS") throw new Error(t("categoryHasProducts"));
        if (data.error === "CATEGORY_HAS_CHILDREN") throw new Error(t("categoryHasChildren"));
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
    <div className="grid gap-4 lg:grid-cols-[minmax(10rem,13rem)_minmax(0,1fr)]">
      <nav
        role="tablist"
        aria-label={t("categoryTabsLabel")}
        aria-orientation="vertical"
        className="glass flex gap-1 overflow-x-auto p-1 lg:sticky lg:top-24 lg:h-fit lg:flex-col"
      >
        {(["MAIN", "SUB"] as const).map((value) => (
          <button
            key={value}
            type="button"
            role="tab"
            id={`category-tab-${value}`}
            aria-selected={tab === value}
            aria-controls={`category-panel-${value}`}
            onClick={() => setTab(value)}
            className={cn(
              "inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              tab === value
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-accent hover:text-foreground",
            )}
          >
            {value === "MAIN" ? (
              <LayoutGrid className="size-4" aria-hidden="true" />
            ) : (
              <List className="size-4" aria-hidden="true" />
            )}
            <span className="truncate">{tabLabels[value]}</span>
            <span className="ml-auto rounded-full bg-background/20 px-1.5 text-[11px] font-bold tabular-nums">
              {value === "MAIN" ? mainCategories.length : subcategories.length}
            </span>
          </button>
        ))}
      </nav>

      <div
        role="tabpanel"
        id={`category-panel-${tab}`}
        aria-labelledby={`category-tab-${tab}`}
        className="min-w-0 space-y-4"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="font-display text-lg font-bold">{tabLabels[tab]}</h3>
            <p className="text-sm text-muted-foreground">{tabIntros[tab]}</p>
          </div>
          <Button
            type="button"
            className="shrink-0"
            onClick={() => setEditing({ category: null, mode: tab })}
          >
            <Plus className="size-4" aria-hidden="true" />
            {tab === "MAIN" ? t("addCategory") : t("addSubcategory")}
          </Button>
        </div>

        {visible.length === 0 ? (
          <p className="glass rounded-2xl px-5 py-10 text-center text-sm text-muted-foreground">
            {tc("noResults")}
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {visible.map((category) => {
              const name = locale === "bn" && category.nameBn ? category.nameBn : category.name;
              const parentName =
                locale === "bn" && category.parentNameBn
                  ? category.parentNameBn
                  : category.parentName;
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
                    {parentName ? (
                      <p className="text-[11px] font-semibold text-muted-foreground">
                        {t("categoryParentLabel")}: <span translate="no">{parentName}</span>
                      </p>
                    ) : category.childCount > 0 ? (
                      <p className="text-[11px] font-semibold text-muted-foreground">
                        {t("categorySubcategoryCount", { count: category.childCount })}
                      </p>
                    ) : null}
                    <p className="truncate font-mono text-[11px] text-muted-foreground" translate="no">
                      {category.slug}
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() =>
                          setEditing({
                            category,
                            mode: category.parentId ? "SUB" : "MAIN",
                          })
                        }
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
      </div>

      {editing ? (
        <CategoryEditorDialog
          key={editing.category?.id ?? `new-${editing.mode}`}
          category={editing.category}
          mode={editing.mode}
          mainCategories={mainCategories}
          onClose={() => setEditing(null)}
        />
      ) : null}

      {deleteTarget ? (
        <DialogShell
          title={t("deleteCategoryTitle")}
          intro={t("deleteCategoryIntro")}
          titleId={`delete-category-${deleteTarget.id}`}
          onClose={() => setDeleteTarget(null)}
          fullViewMobile
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
  mode: initialMode,
  mainCategories,
  onClose,
}: {
  category: AdminCategoryView | null;
  mode: CategoryTab;
  mainCategories: readonly AdminCategoryView[];
  onClose: () => void;
}) {
  const t = useTranslations("adminPanel");
  const tc = useTranslations("common");
  const router = useRouter();
  const fieldId = useId();
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<CategoryTab>(initialMode);
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

  function changeMode(next: CategoryTab) {
    if (next === mode) return;
    setMode(next);
    update("parentId", next === "MAIN" ? "" : (draft.parentId ?? ""));
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
    if (mode === "SUB" && !draft.parentId) {
      setError(t("categoryParentRequired"));
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
      image: nullable(draft.image),
      sortOrder,
      isActive: draft.isActive,
      parentId: mode === "SUB" ? draft.parentId : null,
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
        if (data.error === "INVALID_PARENT") throw new Error(t("categoryParentInvalid"));
        if (data.error === "CATEGORY_HAS_CHILDREN") throw new Error(t("categoryHasChildren"));
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
      title={category ? t("editCategory") : mode === "SUB" ? t("addSubcategory") : t("addCategory")}
      intro={t("categoryEditorIntro")}
      titleId={`category-editor-${category?.id ?? "new"}`}
      onClose={onClose}
      fullViewMobile
      panelClassName="sm:max-w-2xl"
    >
      <form onSubmit={(event) => void handleSubmit(event)} className="space-y-4">
        <div
          role="group"
          aria-label={t("categoryTabsLabel")}
          className="flex flex-wrap gap-1 rounded-xl border border-border bg-[var(--glass)] p-1"
        >
          {(["MAIN", "SUB"] as const).map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={mode === value}
              onClick={() => changeMode(value)}
              className={cn(
                "rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                mode === value
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground",
              )}
            >
              {value === "MAIN" ? t("categoryTabMain") : t("categoryTabSub")}
            </button>
          ))}
        </div>

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

        {mode === "SUB" ? (
          <label className="block space-y-1.5">
            <span className={adminLabelClass}>{t("categoryParentLabel")}</span>
            <select
              className={adminInputClass}
              value={draft.parentId}
              onChange={(event) => update("parentId", event.target.value)}
            >
              <option value="">{t("categorySelectParent")}</option>
              {mainCategories.map((parent) => (
                <option key={parent.id} value={parent.id}>
                  {parent.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}

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
            {category ? tc("save") : mode === "SUB" ? t("addSubcategory") : t("addCategory")}
          </Button>
        </div>
      </form>
    </DialogShell>
  );
}
