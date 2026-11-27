"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { ChevronDown, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { adminInputClass, adminLabelClass } from "@/components/admin/admin-ui";
import { Button } from "@/components/ui/button";
import { DialogShell } from "@/components/ui/dialog-shell";
import { useRouter } from "@/i18n/navigation";
import { formatSP, spToPaisa } from "@/lib/money";
import { rankBadgeSrc, resolveRankBadgeImageUrl } from "@/lib/rank-art";
import {
  buildRankPlanDiff,
  type RankPlanDiffEntry,
  type RankPlanDiffSetting,
} from "@/lib/rank-plan-diff";
import type { RankPlanDefinitionDto, RankPlanFormData } from "@/lib/rank-plan-dto";
import { uploadImage } from "@/lib/upload-client";
import { cn } from "@/lib/utils";

const REVIEW_SECONDS = 10;
const AMOUNT_PATTERN = /^\d+(\.\d{1,2})?$/;
const TARGET_FIELDS = ["directTarget", "team1Target", "team2Target", "team3Target"] as const;

type ImageField = "badgeImageUrl" | "rewardImageUrl";
type Translator = (key: string, values?: Record<string, string | number>) => string;

function makeCommitToken(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `00000000-0000-4000-8000-${Date.now().toString(16).padStart(12, "0")}`;
}

function imageKey(rankKey: string, field: ImageField): string {
  return `${rankKey}:${field}`;
}

function Field({
  label,
  value,
  onChange,
  inputMode = "decimal",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  inputMode?: "decimal" | "text";
}) {
  const id = useId();
  return (
    <div className="min-w-0 space-y-1">
      <label htmlFor={id} className={cn(adminLabelClass, "text-xs")}>
        {label}
      </label>
      <input
        id={id}
        className={cn(adminInputClass, "h-9 px-2.5 text-sm")}
        inputMode={inputMode}
        autoComplete="off"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}

function settingLabel(settingKey: RankPlanDiffSetting, ta: Translator): string {
  switch (settingKey) {
    case "badgeImageUrl":
      return ta("rankConfigSettingBadgeImageUrl");
    case "name":
      return ta("rankConfigSettingName");
    case "nameBn":
      return ta("rankConfigSettingNameBn");
    case "directTarget":
      return ta("rankConfigSettingDirectTarget");
    case "team1Target":
      return ta("rankConfigSettingTeam1Target");
    case "team2Target":
      return ta("rankConfigSettingTeam2Target");
    case "team3Target":
      return ta("rankConfigSettingTeam3Target");
    case "rewardType":
      return ta("rankConfigSettingRewardType");
    case "rewardSp":
      return ta("rankConfigSettingRewardSp");
    case "rewardLabel":
      return ta("rankConfigSettingRewardLabel");
    case "rewardLabelBn":
      return ta("rankConfigSettingRewardLabelBn");
    case "rewardDescription":
      return ta("rankConfigSettingRewardDescription");
    case "rewardDescriptionBn":
      return ta("rankConfigSettingRewardDescriptionBn");
    case "rewardImageUrl":
      return ta("rankConfigSettingRewardImageUrl");
  }
}

function ChangeValue({
  change,
  value,
  isNext,
  ta,
  previewSrc,
}: {
  change: RankPlanDiffEntry;
  value: string | null;
  isNext: boolean;
  ta: Translator;
  previewSrc?: string;
}) {
  if (!value) {
    return <span className="text-muted-foreground">—</span>;
  }

  if (change.settingKey === "badgeImageUrl" || change.settingKey === "rewardImageUrl") {
    const src = isNext && previewSrc ? previewSrc : value;
    return (
      <Image
        src={src}
        alt=""
        width={32}
        height={32}
        unoptimized={src.startsWith("blob:")}
        className="size-8 rounded object-contain"
      />
    );
  }

  if (change.settingKey === "rewardType") {
    return <>{value === "SP" ? ta("rankConfigSpReward") : ta("rankConfigPhysicalReward")}</>;
  }

  if (TARGET_FIELDS.includes(change.settingKey as (typeof TARGET_FIELDS)[number]) || change.settingKey === "rewardSp") {
    return <>{formatSP(spToPaisa(value))}</>;
  }

  return <>{value}</>;
}

export function RankConfigurationEditor({
  active,
  nextVersion,
}: {
  active: RankPlanFormData;
  nextVersion: number;
}) {
  const ta = useTranslations("adminPanel");
  const tc = useTranslations("common");
  const locale = useLocale();
  const router = useRouter();
  const passwordId = useId();

  const [rows, setRows] = useState<RankPlanDefinitionDto[]>(() =>
    active.ranks.map((row) => ({ ...row })),
  );
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const [previewOverrides, setPreviewOverrides] = useState<Record<string, string>>({});
  const [uploading, setUploading] = useState<Record<string, boolean>>({});
  const [commitToken, setCommitToken] = useState(makeCommitToken);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [countdown, setCountdown] = useState(REVIEW_SECONDS);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const badgeInputs = useRef<Record<string, HTMLInputElement | null>>({});
  const rewardInputs = useRef<Record<string, HTMLInputElement | null>>({});
  const objectUrls = useRef<string[]>([]);
  const commitInFlight = useRef(false);

  const changes = useMemo(() => buildRankPlanDiff(active.ranks, rows), [active.ranks, rows]);

  useEffect(() => {
    const urls = objectUrls.current;
    return () => {
      urls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);

  useEffect(() => {
    if (!reviewOpen) return;
    const startedAt = Date.now();
    const timer = window.setInterval(() => {
      const remaining = Math.max(
        0,
        REVIEW_SECONDS - Math.floor((Date.now() - startedAt) / 1000),
      );
      setCountdown(remaining);
      if (remaining === 0) window.clearInterval(timer);
    }, 100);
    return () => window.clearInterval(timer);
  }, [reviewOpen]);

  function localized(row: RankPlanDefinitionDto, en: string, bn: string | null): string {
    return locale === "bn" && bn ? bn : en;
  }

  function rankName(row: RankPlanDefinitionDto): string {
    return localized(row, row.name, row.nameBn);
  }

  function update(rankKey: string, patch: Partial<RankPlanDefinitionDto>): void {
    setRows((current) =>
      current.map((row) => (row.rankKey === rankKey ? { ...row, ...patch } : row)),
    );
  }

  function toggleRank(rankKey: string): void {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(rankKey)) next.delete(rankKey);
      else next.add(rankKey);
      return next;
    });
  }

  async function handleImageUpload(
    row: RankPlanDefinitionDto,
    field: ImageField,
    file: File | undefined,
  ): Promise<void> {
    if (!file) return;
    const key = imageKey(row.rankKey, field);
    if (file.type !== "image/png") {
      toast.error(ta("rankConfigPngOnly"));
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    objectUrls.current.push(objectUrl);
    setPreviewOverrides((current) => ({ ...current, [key]: objectUrl }));
    setUploading((current) => ({ ...current, [key]: true }));

    try {
      const url = await uploadImage(file);
      update(
        row.rankKey,
        field === "badgeImageUrl" ? { badgeImageUrl: url } : { rewardImageUrl: url },
      );
      setPreviewOverrides((current) => {
        const next = { ...current };
        delete next[key];
        return next;
      });
    } catch {
      setPreviewOverrides((current) => {
        const next = { ...current };
        delete next[key];
        return next;
      });
      toast.error(
        field === "badgeImageUrl" ? ta("rankPlanBadgeImageFailed") : ta("rankPlanImageFailed"),
      );
    } finally {
      setUploading((current) => ({ ...current, [key]: false }));
    }
  }

  function emblemSrc(row: RankPlanDefinitionDto): string {
    const key = imageKey(row.rankKey, "badgeImageUrl");
    return (
      previewOverrides[key] ??
      resolveRankBadgeImageUrl(row.badgeImageUrl, row.rankKey) ??
      rankBadgeSrc(row.rankKey)
    );
  }

  function rewardImageSrc(row: RankPlanDefinitionDto): string | null {
    const key = imageKey(row.rankKey, "rewardImageUrl");
    return previewOverrides[key] ?? row.rewardImageUrl;
  }

  function validRows(): boolean {
    return rows.every(
      (row) =>
        Boolean(row.name.trim()) &&
        TARGET_FIELDS.every((field) => AMOUNT_PATTERN.test(row[field].trim())) &&
        (row.rewardType === "SP"
          ? AMOUNT_PATTERN.test((row.rewardSp || "").trim())
          : Boolean(row.rewardLabel?.trim())),
    );
  }

  function payloadRows() {
    return rows.map((row) => ({
      rankKey: row.rankKey,
      sortOrder: row.sortOrder,
      name: row.name.trim(),
      nameBn: row.nameBn?.trim() || null,
      directTarget: row.directTarget.trim() || "0",
      team1Target: row.team1Target.trim() || "0",
      team2Target: row.team2Target.trim() || "0",
      team3Target: row.team3Target.trim() || "0",
      rewardType: row.rewardType,
      rewardSp: row.rewardType === "SP" ? (row.rewardSp || "").trim() || "0" : null,
      rewardLabel: row.rewardType === "PHYSICAL" ? row.rewardLabel?.trim() || null : null,
      rewardLabelBn:
        row.rewardType === "PHYSICAL" ? row.rewardLabelBn?.trim() || null : null,
      rewardDescription:
        row.rewardType === "PHYSICAL" ? row.rewardDescription?.trim() || null : null,
      rewardDescriptionBn:
        row.rewardType === "PHYSICAL" ? row.rewardDescriptionBn?.trim() || null : null,
      badgeImageUrl: row.badgeImageUrl,
      rewardImageUrl: row.rewardType === "PHYSICAL" ? row.rewardImageUrl : null,
    }));
  }

  function openReview(): void {
    setError(null);
    if (!validRows()) {
      setError(ta("rankConfigInvalidFormat"));
      return;
    }
    if (changes.length === 0) {
      setError(ta("rankConfigNoChanges"));
      return;
    }
    if (!commitToken) setCommitToken(makeCommitToken());
    setCountdown(REVIEW_SECONDS);
    setReviewOpen(true);
  }

  function confirmReview(): void {
    if (countdown > 0) return;
    setReviewOpen(false);
    setPassword("");
    setError(null);
    setAuthOpen(true);
  }

  function goBack(): void {
    setAuthOpen(false);
    setError(null);
    setCountdown(REVIEW_SECONDS);
    setReviewOpen(true);
  }

  async function commit(): Promise<void> {
    if (commitInFlight.current) return;
    commitInFlight.current = true;
    setSaving(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/rank-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          adminPassword: password,
          commitToken,
          ranks: payloadRows(),
        }),
      });
      const data = (await response.json().catch(() => ({}))) as {
        error?: string;
        version?: number;
        duplicate?: boolean;
        active?: RankPlanDefinitionDto[];
      };
      if (!response.ok) {
        setError(mapCommitError(data.error, ta));
        return;
      }

      const version = data.version ?? nextVersion;
      toast.success(ta("rankConfigCommitted", { version }));
      setAuthOpen(false);
      setPassword("");
      setCommitToken(makeCommitToken());
      if (data.active?.length) setRows(data.active.map((row) => ({ ...row })));
      router.refresh();
    } catch {
      setError(ta("rankConfigFailed"));
    } finally {
      commitInFlight.current = false;
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="grid items-start gap-3 lg:grid-cols-2">
        {rows.map((row) => {
          const open = expanded.has(row.rankKey);
          const name = rankName(row);
          const badgeSrc = emblemSrc(row);
          const badgeKey = imageKey(row.rankKey, "badgeImageUrl");
          const rewardKey = imageKey(row.rankKey, "rewardImageUrl");
          const rewardSrc = rewardImageSrc(row);
  
          return (
            <article key={row.rankKey} className="glass overflow-hidden rounded-2xl">
              <div className="flex items-center gap-3 px-3 py-2.5 sm:px-4">
                <button
                  type="button"
                  aria-label={ta("rankConfigEmblem", { rank: name })}
                  onClick={() => badgeInputs.current[row.rankKey]?.click()}
                  className={cn(
                    "relative grid size-10 shrink-0 place-items-center rounded-lg border border-border/70 bg-[var(--glass-strong)] p-1 transition-colors hover:border-primary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    open && "size-12",
                    uploading[badgeKey] && "opacity-70",
                  )}
                >
                  <Image
                    src={badgeSrc}
                    alt=""
                    width={40}
                    height={40}
                    unoptimized={badgeSrc.startsWith("blob:")}
                    className={cn("size-full object-contain", open ? "scale-105" : "")}
                  />
                </button>
                <input
                  ref={(node) => {
                    badgeInputs.current[row.rankKey] = node;
                  }}
                  type="file"
                  accept="image/png"
                  className="sr-only"
                  tabIndex={-1}
                  onChange={(event) => {
                    void handleImageUpload(row, "badgeImageUrl", event.target.files?.[0]);
                    event.target.value = "";
                  }}
                />
  
                <button
                  type="button"
                  aria-expanded={open}
                  aria-controls={`rank-card-${row.rankKey}`}
                  aria-label={ta(open ? "rankConfigCollapse" : "rankConfigExpand", { rank: name })}
                  onClick={() => toggleRank(row.rankKey)}
                  className="flex min-w-0 flex-1 items-center justify-between gap-3 rounded-lg px-1 py-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold">{name}</span>
                    <span className="block text-[11px] font-semibold tracking-wide text-muted-foreground">
                      {row.rankKey}
                    </span>
                  </span>
                  <ChevronDown
                    aria-hidden="true"
                    className={cn("size-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")}
                  />
                </button>
              </div>
  
              {open ? (
                <div
                  id={`rank-card-${row.rankKey}`}
                  className="space-y-4 border-t border-border px-3 py-4 sm:px-4"
                >
                  <Field
                    label={ta("rankPlanRankName")}
                    value={localized(row, row.name, row.nameBn)}
                    inputMode="text"
                    onChange={(value) => {
                      if (locale === "bn") {
                        update(row.rankKey, {
                          nameBn: value,
                          name: row.name.trim() || value,
                        });
                      } else {
                        update(row.rankKey, { name: value });
                      }
                    }}
                  />
  
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-muted-foreground">
                      {ta("rankConfigQualificationTargets")}
                    </p>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Field
                        label={ta("rankConfigDirectSales")}
                        value={row.directTarget}
                        onChange={(value) => update(row.rankKey, { directTarget: value })}
                      />
                      <Field
                        label={ta("rankConfigTeam1")}
                        value={row.team1Target}
                        onChange={(value) => update(row.rankKey, { team1Target: value })}
                      />
                      <Field
                        label={ta("rankConfigTeam2")}
                        value={row.team2Target}
                        onChange={(value) => update(row.rankKey, { team2Target: value })}
                      />
                      <Field
                        label={ta("rankConfigTeam3")}
                        value={row.team3Target}
                        onChange={(value) => update(row.rankKey, { team3Target: value })}
                      />
                    </div>
                  </div>
  
                  <div className="space-y-3">
                    <p className="text-xs font-semibold text-muted-foreground">
                      {ta("rankConfigAchievementReward")}
                    </p>
                    <div
                      role="group"
                      aria-label={ta("rankConfigAchievementReward")}
                      className="inline-flex w-full max-w-sm rounded-xl border border-border bg-muted/40 p-1"
                    >
                      <button
                        type="button"
                        aria-pressed={row.rewardType === "SP"}
                        onClick={() => update(row.rankKey, { rewardType: "SP" })}
                        className={cn(
                          "flex-1 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                          row.rewardType === "SP"
                            ? "bg-[var(--card-solid)] text-foreground shadow-sm"
                            : "text-muted-foreground hover:text-foreground",
                        )}
                      >
                        {ta("rankConfigSpReward")}
                      </button>
                      <button
                        type="button"
                        aria-pressed={row.rewardType === "PHYSICAL"}
                        onClick={() => update(row.rankKey, { rewardType: "PHYSICAL" })}
                        className={cn(
                          "flex-1 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                          row.rewardType === "PHYSICAL"
                            ? "bg-[var(--card-solid)] text-foreground shadow-sm"
                            : "text-muted-foreground hover:text-foreground",
                        )}
                      >
                        {ta("rankConfigPhysicalReward")}
                      </button>
                    </div>
  
                    {row.rewardType === "SP" ? (
                      <Field
                        label={ta("rankConfigSpAmount")}
                        value={row.rewardSp}
                        onChange={(value) => update(row.rankKey, { rewardSp: value })}
                      />
                    ) : (
                      <div className="space-y-3">
                        <div className="grid gap-3 sm:grid-cols-2">
                          <Field
                            label={ta("rankConfigRewardName")}
                            value={localized(row, row.rewardLabel ?? "", row.rewardLabelBn)}
                            inputMode="text"
                            onChange={(value) => {
                              if (locale === "bn") {
                                update(row.rankKey, {
                                  rewardLabelBn: value,
                                  rewardLabel: row.rewardLabel?.trim() || value,
                                });
                              } else {
                                update(row.rankKey, { rewardLabel: value });
                              }
                            }}
                          />
                          <Field
                            label={ta("rankConfigRewardDescription")}
                            value={localized(row, row.rewardDescription ?? "", row.rewardDescriptionBn)}
                            inputMode="text"
                            onChange={(value) => {
                              if (locale === "bn") {
                                update(row.rankKey, {
                                  rewardDescriptionBn: value,
                                  rewardDescription: row.rewardDescription?.trim() || value,
                                });
                              } else {
                                update(row.rankKey, { rewardDescription: value });
                              }
                            }}
                          />
                        </div>
  
                        <button
                          type="button"
                          aria-label={ta("rankConfigRewardImage", { rank: name })}
                          onClick={() => rewardInputs.current[row.rankKey]?.click()}
                          className={cn(
                            "flex w-full items-center gap-3 rounded-xl border border-dashed border-border bg-[var(--glass-strong)] p-2.5 text-left transition-colors hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                            uploading[rewardKey] && "opacity-70",
                          )}
                        >
                          <span className="relative grid size-10 shrink-0 place-items-center rounded-lg bg-muted/40 p-1">
                            {rewardSrc ? (
                              <Image
                                src={rewardSrc}
                                alt=""
                                width={40}
                                height={40}
                                unoptimized={rewardSrc.startsWith("blob:")}
                                className="size-full object-contain"
                              />
                            ) : (
                              <span className="text-[10px] text-muted-foreground">—</span>
                            )}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-xs font-semibold">
                              {ta("rankConfigImagePreview")}
                            </span>
                            <span className="block truncate text-[11px] text-muted-foreground">
                              {uploading[rewardKey] ? ta("rankPlanUploading") : ta("rankPlanRewardImage")}
                            </span>
                          </span>
                        </button>
                        <input
                          ref={(node) => {
                            rewardInputs.current[row.rankKey] = node;
                          }}
                          type="file"
                          accept="image/png"
                          className="sr-only"
                          tabIndex={-1}
                          onChange={(event) => {
                            void handleImageUpload(row, "rewardImageUrl", event.target.files?.[0]);
                            event.target.value = "";
                          }}
                        />
                      </div>
                    )}
                  </div>
                </div>
              ) : null}
            </article>
          );
        })}
      </div>

      {error && !reviewOpen && !authOpen ? (
        <p role="alert" className="text-sm font-semibold text-red-600">
          {error}
        </p>
      ) : null}

      <Button
        type="button"
        size="lg"
        className="w-full"
        disabled={saving || reviewOpen || authOpen}
        onClick={openReview}
      >
        {ta("rankConfigCommit")}
      </Button>

      {reviewOpen ? (
        <DialogShell
          title={ta("rankConfigReviewTitle")}
          intro={ta("rankConfigReviewIntro")}
          titleId="rank-config-review-title"
          onClose={() => setReviewOpen(false)}
          fullViewMobile
        >
          <div className="space-y-4">
            <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted-foreground">
              <span>
                {ta("salaryPlanCurrentVersion")}:{" "}
                <strong className="text-foreground">v{active.version}</strong>
              </span>
              <span>
                {ta("rankConfigNewVersion")}:{" "}
                <strong className="text-foreground">v{nextVersion}</strong>
              </span>
            </div>

            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full min-w-[520px] border-collapse text-left text-sm">
                <caption className="sr-only">{ta("rankConfigReviewTitle")}</caption>
                <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th scope="col" className="px-3 py-2">
                      {ta("salaryPlanRank")}
                    </th>
                    <th scope="col" className="px-3 py-2">
                      {ta("rankConfigSetting")}
                    </th>
                    <th scope="col" className="px-3 py-2">
                      {ta("rankConfigPrevious")}
                    </th>
                    <th scope="col" className="px-3 py-2">
                      {ta("rankConfigNewValue")}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {changes.map((change) => (
                    <tr key={change.id}>
                      <td className="px-3 py-2 font-semibold">
                        {localized(
                          { name: change.rankLabel, nameBn: change.rankLabelBn } as RankPlanDefinitionDto,
                          change.rankLabel,
                          change.rankLabelBn,
                        )}{" "}
                        <span className="text-xs text-muted-foreground">({change.rankKey})</span>
                      </td>
                      <td className="px-3 py-2">{settingLabel(change.settingKey, ta)}</td>
                      <td className="px-3 py-2">
                        <ChangeValue
                          change={change}
                          value={change.previous}
                          isNext={false}
                          ta={ta}
                        />
                      </td>
                      <td className="px-3 py-2 font-semibold">
                        <ChangeValue
                          change={change}
                          value={change.next}
                          isNext
                          ta={ta}
                          previewSrc={
                            change.settingKey === "badgeImageUrl"
                              ? previewOverrides[imageKey(change.rankKey, "badgeImageUrl")]
                              : change.settingKey === "rewardImageUrl"
                                ? previewOverrides[imageKey(change.rankKey, "rewardImageUrl")]
                                : undefined
                          }
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p
              className={cn(
                "rounded-xl px-3 py-2 text-sm font-semibold",
                countdown > 0
                  ? "bg-amber-500/15 text-amber-700"
                  : "bg-emerald-500/15 text-emerald-700",
              )}
              aria-live="polite"
            >
              {countdown > 0
                ? ta("rankConfigReviewCountdown", { seconds: countdown })
                : ta("rankConfigReviewReady")}
            </p>
            {error ? (
              <p role="alert" className="text-sm font-semibold text-red-600">
                {error}
              </p>
            ) : null}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setReviewOpen(false)}>
                {tc("cancel")}
              </Button>
              <Button type="button" disabled={countdown > 0} onClick={confirmReview}>
                {ta("rankConfigConfirmChanges")}
              </Button>
            </div>
          </div>
        </DialogShell>
      ) : null}

      {authOpen ? (
        <DialogShell
          title={ta("rankConfigFinalTitle")}
          intro={ta("rankConfigFinalIntro")}
          titleId="rank-config-final-title"
          onClose={() => setAuthOpen(false)}
          fullViewMobile
        >
          <div className="space-y-4">
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3">
              <div className="flex items-center gap-2 text-sm font-bold text-red-700">
                <ShieldCheck className="size-4" aria-hidden="true" />
                {ta("rankConfigFinalWarningTitle")}
              </div>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-xs leading-relaxed text-red-700">
                <li>{ta("rankConfigFinalWarning1")}</li>
                <li>{ta("rankConfigFinalWarning2")}</li>
                <li>{ta("rankConfigFinalWarning3")}</li>
              </ul>
            </div>

            <div className="space-y-1.5">
              <label htmlFor={passwordId} className={adminLabelClass}>
                {ta("rankConfigAdminPassword")}
              </label>
              <input
                id={passwordId}
                type="password"
                autoComplete="current-password"
                data-dialog-autofocus
                className={adminInputClass}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </div>
            {error ? (
              <p role="alert" className="text-sm font-semibold text-red-600">
                {error}
              </p>
            ) : null}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={goBack} disabled={saving}>
                {ta("rankConfigGoBack")}
              </Button>
              <Button
                type="button"
                variant="destructive"
                disabled={saving || !password}
                onClick={() => void commit()}
              >
                {saving ? tc("saving") : ta("rankConfigConfirmCommit")}
              </Button>
            </div>
          </div>
        </DialogShell>
      ) : null}
    </div>
  );
}

function mapCommitError(error: string | undefined, ta: Translator): string {
  switch (error) {
    case "INVALID_ADMIN_PASSWORD":
      return ta("rankConfigInvalidPassword");
    case "Invalid rank keys":
    case "Invalid rank artwork":
    case "Please check the rank values":
    case "Invalid request":
      return ta("rankConfigInvalidValues");
    case "RANK_PLAN_FAILED":
    default:
      return ta("rankConfigFailed");
  }
}
