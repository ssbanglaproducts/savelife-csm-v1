"use client";

import { useId, useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { Loader2, Pencil, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useRouter } from "@/i18n/navigation";
import type { StoreSpecification, StoreVariantGroups } from "@/lib/store-filters";
import { adminInputClass, adminLabelClass } from "./admin-ui";

const variantKeys = ["size", "color", "model"] as const;
type VariantKey = (typeof variantKeys)[number];

type VariantDraft = Record<VariantKey, string>;

type SpecificationDraft = {
  label: string;
  labelBn: string;
  value: string;
  valueBn: string;
};

type ProductMetadataEditorProps = {
  productId: string;
  productName: string;
  brand: string | null;
  subcategory: string | null;
  variants: unknown;
  specifications: unknown;
};

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function readVariants(value: unknown): VariantDraft {
  const draft: VariantDraft = { size: "", color: "", model: "" };
  if (typeof value !== "object" || value === null || Array.isArray(value)) return draft;
  const source = value as Record<string, unknown>;
  for (const key of variantKeys) {
    const list = source[key];
    if (Array.isArray(list)) {
      draft[key] = list.filter((item): item is string => typeof item === "string").join(", ");
    }
  }
  return draft;
}

function readSpecifications(value: unknown): SpecificationDraft[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
    .map((item) => ({
      label: asString(item.label),
      labelBn: asString(item.labelBn),
      value: asString(item.value),
      valueBn: asString(item.valueBn),
    }));
}

function emptySpecification(): SpecificationDraft {
  return { label: "", labelBn: "", value: "", valueBn: "" };
}

function buildVariants(draft: VariantDraft): StoreVariantGroups {
  const result: StoreVariantGroups = {};
  for (const key of variantKeys) {
    const values = [...new Set(draft[key].split(",").map((item) => item.trim()).filter(Boolean))].slice(0, 50);
    if (values.length > 0) result[key] = values;
  }
  return result;
}

export function ProductMetadataEditor({
  productId,
  productName,
  brand,
  subcategory,
  variants,
  specifications,
}: ProductMetadataEditorProps) {
  const t = useTranslations("adminPanel");
  const tc = useTranslations("common");
  const router = useRouter();
  const fieldId = useId();

  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [brandValue, setBrandValue] = useState(brand ?? "");
  const [subcategoryValue, setSubcategoryValue] = useState(subcategory ?? "");
  const [variantDraft, setVariantDraft] = useState<VariantDraft>(() => readVariants(variants));
  const [specDraft, setSpecDraft] = useState<SpecificationDraft[]>(() => readSpecifications(specifications));

  function openEditor() {
    setBrandValue(brand ?? "");
    setSubcategoryValue(subcategory ?? "");
    setVariantDraft(readVariants(variants));
    setSpecDraft(readSpecifications(specifications));
    setError(null);
    setOpen(true);
  }

  function updateSpec(index: number, field: keyof SpecificationDraft, value: string) {
    setSpecDraft((current) =>
      current.map((row, rowIndex) => (rowIndex === index ? { ...row, [field]: value } : row)),
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const rows = specDraft.filter((row) =>
      [row.label, row.labelBn, row.value, row.valueBn].some((value) => value.trim().length > 0),
    );
    if (rows.some((row) => !row.label.trim() || !row.value.trim())) {
      const message = t("metadataFailed");
      setError(message);
      toast.error(message);
      return;
    }

    const payload: StoreSpecification[] = rows.map((row) => ({
      label: row.label.trim(),
      labelBn: row.labelBn.trim() || null,
      value: row.value.trim(),
      valueBn: row.valueBn.trim() || null,
    }));

    setPending(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/products/${productId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          brand: brandValue.trim() || null,
          subcategory: subcategoryValue.trim() || null,
          variants: buildVariants(variantDraft),
          specifications: payload,
        }),
      });
      if (!response.ok) throw new Error(`Metadata update failed: ${response.status}`);
      toast.success(t("metadataSaved"));
      setOpen(false);
      router.refresh();
    } catch {
      const message = t("metadataFailed");
      setError(message);
      toast.error(message);
    } finally {
      setPending(false);
    }
  }

  const summary = [brand, subcategory].filter(Boolean).join(" · ");

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={openEditor}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <Pencil className="size-3.5" aria-hidden="true" />
        {t("editMetadata")}
      </Button>
      {summary ? (
        <p className="mt-2 max-w-[200px] truncate text-[11px] text-muted-foreground" translate="no">
          {summary}
        </p>
      ) : null}

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            className="absolute inset-0 cursor-default"
            aria-label={tc("cancel")}
            onClick={() => setOpen(false)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={`${fieldId}-title`}
            className="relative flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-border bg-[var(--card-solid)] shadow-2xl"
          >
            <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4 sm:px-6">
              <div className="min-w-0">
                <h2 id={`${fieldId}-title`} className="font-display text-lg font-bold">
                  {t("productMetadata")}
                </h2>
                <p className="mt-1 truncate text-xs text-muted-foreground">{productName}</p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  {t("productMetadataHint")}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label={tc("cancel")}
                className="shrink-0 rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                <X className="size-4" aria-hidden="true" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
              <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-5 sm:px-6">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label htmlFor={`${fieldId}-brand`} className={adminLabelClass}>
                      {t("brand")}
                    </label>
                    <input
                      id={`${fieldId}-brand`}
                      value={brandValue}
                      onChange={(event) => setBrandValue(event.target.value)}
                      maxLength={120}
                      autoFocus
                      className={`${adminInputClass} mt-2`}
                    />
                  </div>
                  <div>
                    <label htmlFor={`${fieldId}-subcategory`} className={adminLabelClass}>
                      {t("subcategory")}
                    </label>
                    <input
                      id={`${fieldId}-subcategory`}
                      value={subcategoryValue}
                      onChange={(event) => setSubcategoryValue(event.target.value)}
                      maxLength={120}
                      className={`${adminInputClass} mt-2`}
                    />
                  </div>
                </div>

                <fieldset className="space-y-3 rounded-2xl border border-border p-4">
                  <legend className="px-1 text-sm font-bold">{t("variants")}</legend>
                  <p className="text-xs leading-relaxed text-muted-foreground">{t("variantsHint")}</p>
                  <div className="grid gap-3 sm:grid-cols-3">
                    {variantKeys.map((key) => (
                      <div key={key}>
                        <label htmlFor={`${fieldId}-${key}`} className={adminLabelClass}>
                          {t(key)}
                        </label>
                        <input
                          id={`${fieldId}-${key}`}
                          value={variantDraft[key]}
                          onChange={(event) =>
                            setVariantDraft((current) => ({ ...current, [key]: event.target.value }))
                          }
                          maxLength={500}
                          className={`${adminInputClass} mt-2`}
                        />
                      </div>
                    ))}
                  </div>
                </fieldset>

                <fieldset className="space-y-3 rounded-2xl border border-border p-4">
                  <legend className="px-1 text-sm font-bold">{t("specifications")}</legend>
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    {t("specificationsHint")}
                  </p>
                  {specDraft.length === 0 ? (
                    <p className="text-xs text-muted-foreground">{tc("noResults")}</p>
                  ) : null}
                  <div className="space-y-3">
                    {specDraft.map((row, index) => (
                      <div
                        key={index}
                        className="grid gap-3 rounded-xl bg-[var(--glass)] p-3 sm:grid-cols-2"
                      >
                        <div>
                          <label htmlFor={`${fieldId}-spec-${index}-label`} className={adminLabelClass}>
                            {t("specLabel")}
                          </label>
                          <input
                            id={`${fieldId}-spec-${index}-label`}
                            value={row.label}
                            onChange={(event) => updateSpec(index, "label", event.target.value)}
                            maxLength={120}
                            className={`${adminInputClass} mt-1`}
                          />
                        </div>
                        <div>
                          <label htmlFor={`${fieldId}-spec-${index}-value`} className={adminLabelClass}>
                            {t("specValue")}
                          </label>
                          <input
                            id={`${fieldId}-spec-${index}-value`}
                            value={row.value}
                            onChange={(event) => updateSpec(index, "value", event.target.value)}
                            maxLength={300}
                            className={`${adminInputClass} mt-1`}
                          />
                        </div>
                        <div>
                          <label htmlFor={`${fieldId}-spec-${index}-label-bn`} className={adminLabelClass}>
                            {t("specLabelBn")}
                          </label>
                          <input
                            id={`${fieldId}-spec-${index}-label-bn`}
                            value={row.labelBn}
                            onChange={(event) => updateSpec(index, "labelBn", event.target.value)}
                            maxLength={120}
                            className={`${adminInputClass} mt-1`}
                          />
                        </div>
                        <div>
                          <label htmlFor={`${fieldId}-spec-${index}-value-bn`} className={adminLabelClass}>
                            {t("specValueBn")}
                          </label>
                          <input
                            id={`${fieldId}-spec-${index}-value-bn`}
                            value={row.valueBn}
                            onChange={(event) => updateSpec(index, "valueBn", event.target.value)}
                            maxLength={300}
                            className={`${adminInputClass} mt-1`}
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            setSpecDraft((current) => current.filter((_, rowIndex) => rowIndex !== index))
                          }
                          aria-label={t("removeSpecification")}
                          className="inline-flex w-fit items-center gap-1.5 text-xs font-semibold text-destructive transition-opacity hover:opacity-70 sm:col-span-2"
                        >
                          <X className="size-3.5" aria-hidden="true" />
                          {t("removeSpecification")}
                        </button>
                      </div>
                    ))}
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setSpecDraft((current) => [...current, emptySpecification()])}
                  >
                    <Plus className="size-3.5" aria-hidden="true" />
                    {t("addSpecification")}
                  </Button>
                </fieldset>

                {error ? <p className="text-xs text-destructive">{error}</p> : null}
              </div>
              <div className="flex justify-end gap-2 border-t border-border px-5 py-4 sm:px-6">
                <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={pending}>
                  {tc("cancel")}
                </Button>
                <Button type="submit" disabled={pending}>
                  {pending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
                  {t("saveMetadata")}
                </Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
