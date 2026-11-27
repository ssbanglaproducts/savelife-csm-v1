"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import {
  AdminSection,
  StatusBadge,
  adminInputClass,
  adminLabelClass,
} from "@/components/admin/admin-ui";
import { Button, buttonVariants } from "@/components/ui/button";
import { DialogShell } from "@/components/ui/dialog-shell";
import { RankBadge } from "@/components/ui/rank-badge";
import { Link } from "@/i18n/navigation";
import {
  salaryChangeRankLabel,
  salaryChangeSettingLabel,
  salaryChangeValue,
} from "@/lib/salary-plan-change-view";
import {
  buildSalaryPlanDiff,
  salaryPlanDate,
  validateSalaryPlanDraft,
  type SalaryPlanValidationIssue,
} from "@/lib/salary-plan-form";
import type { SalaryPlanDto, SalaryPlanRankDto } from "@/lib/services/salary-plan";
import { cn } from "@/lib/utils";
import { queueSalaryPlanSuccess } from "./salary-plan-success-notice";

const REVIEW_SECONDS = 10;

function todayInBdt(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Dhaka",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function makeCommitToken(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `00000000-0000-4000-8000-${Date.now().toString(16).padStart(12, "0")}`;
}

function Field({
  label,
  value,
  onChange,
  inputMode = "decimal",
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  inputMode?: "decimal" | "numeric";
  placeholder?: string;
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
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}

export function EditSalaryPlanForm({
  active,
  nextVersion,
}: {
  active: SalaryPlanDto;
  nextVersion: number;
}) {
  const ta = useTranslations("adminPanel");
  const tc = useTranslations("common");
  const locale = useLocale();
  const router = useRouter();
  const passwordId = useId();

  const [rows, setRows] = useState<SalaryPlanRankDto[]>(() =>
    active.ranks.map((row) => ({ ...row })),
  );
  const [effectiveFrom, setEffectiveFrom] = useState(
    () => salaryPlanDate(active.effectiveFrom) || todayInBdt(),
  );
  const [commitToken, setCommitToken] = useState(makeCommitToken);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [countdown, setCountdown] = useState(REVIEW_SECONDS);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const validation = useMemo(() => validateSalaryPlanDraft(rows, effectiveFrom), [rows, effectiveFrom]);
  const proposed = useMemo<SalaryPlanDto>(
    () => ({
      ...active,
      effectiveFrom: effectiveFrom ? `${effectiveFrom}T00:00:00+06:00` : null,
      ranks: rows.map((row) => ({
        ...row,
        enabled:
          row.isEnabled &&
          Number.parseFloat(row.allocationPercent || "0") > 0 &&
          Number.parseFloat(row.maxWeeklySalary || "0") > 0,
      })),
    }),
    [active, effectiveFrom, rows],
  );
  const changes = useMemo(() => buildSalaryPlanDiff(active, proposed), [active, proposed]);

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

  function update(index: number, patch: Partial<SalaryPlanRankDto>): void {
    setRows((current) =>
      current.map((row, rowIndex) => (rowIndex === index ? { ...row, ...patch } : row)),
    );
  }

  function openReview(): void {
    setError(null);
    if (!validation.valid) {
      setError(ta("salaryPlanFixValidation"));
      return;
    }
    if (changes.length === 0) {
      setError(ta("salaryPlanNoChanges"));
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
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/salary/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          effectiveFrom,
          adminPassword: password,
          commitToken,
          ranks: rows.map((row) => ({
            rankKey: row.rankKey,
            isEnabled: row.isEnabled,
            allocationPercent: row.allocationPercent.trim() || "0",
            maxWeeklySalary: row.maxWeeklySalary.trim() || "0",
            maxWeeks: row.maxWeeks,
          })),
        }),
      });
      const data = (await response.json().catch(() => ({}))) as {
        error?: string;
        version?: number;
        duplicate?: boolean;
      };
      if (!response.ok) {
        setError(mapCommitError(data.error, ta));
        return;
      }
      queueSalaryPlanSuccess(data.version ?? nextVersion);
      setAuthOpen(false);
      router.push("/admin/rank-salary/overview");
      router.refresh();
    } catch {
      setError(ta("salaryPlanFailed"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="glass rounded-2xl p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
          <span>
            {ta("salaryPlanCurrentVersion")}:{" "}
            <strong className="text-foreground">v{active.version ?? "—"}</strong>
          </span>
          <span>
            {ta("rankPlanNextVersion")}: <strong className="text-foreground">v{nextVersion}</strong>
          </span>
          <span>
            {ta("salaryPlanEffectiveDate")}:{" "}
            <input
              type="date"
              aria-label={ta("salaryPlanEffectiveDate")}
              className={cn(adminInputClass, "h-9 w-auto px-2 text-sm")}
              value={effectiveFrom}
              onChange={(event) => setEffectiveFrom(event.target.value)}
            />
          </span>
        </div>
      </section>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {rows.map((row, index) => {
          const name = locale === "bn" ? row.nameBn || row.name : row.name;
          const limited = row.maxWeeks !== null;
          return (
            <article key={row.rankKey} className="glass rounded-2xl p-4">
              <div className="flex items-center gap-2.5">
                <RankBadge src={row.badgeImageUrl} rankKey={row.rankKey} size={36} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{name}</p>
                  <p className="text-[11px] text-muted-foreground">{row.rankKey}</p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={row.isEnabled}
                  aria-label={`${name} ${ta("salaryPlanEnabled")}`}
                  onClick={() => update(index, { isEnabled: !row.isEnabled })}
                  className={cn(
                    "relative h-6 w-11 shrink-0 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    row.isEnabled ? "bg-emerald-500" : "bg-muted ring-1 ring-border",
                  )}
                >
                  <span
                    className={cn(
                      "absolute left-0 top-0.5 size-5 rounded-full bg-white shadow transition-transform",
                      row.isEnabled ? "translate-x-[22px]" : "translate-x-[2px]",
                    )}
                  />
                </button>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2">
                <Field
                  label={ta("salaryPlanAllocation")}
                  value={row.allocationPercent}
                  onChange={(value) => update(index, { allocationPercent: value })}
                />
                <Field
                  label={ta("salaryPlanWeeklyCapBdt")}
                  value={row.maxWeeklySalary}
                  onChange={(value) => update(index, { maxWeeklySalary: value })}
                />
              </div>

              <div className="mt-3">
                <p className={cn(adminLabelClass, "text-xs")}>{ta("salaryDuration")}</p>
                <div className="mt-1 flex rounded-xl border border-border bg-[var(--glass-strong)] p-0.5 text-xs font-semibold">
                  <button
                    type="button"
                    onClick={() =>
                      update(index, { maxWeeks: limited ? row.maxWeeks : "" })
                    }
                    className={cn(
                      "flex-1 rounded-lg px-2 py-1.5 transition-colors",
                      limited ? "bg-primary text-primary-foreground" : "text-muted-foreground",
                    )}
                  >
                    {ta("salaryDurationLimited")}
                  </button>
                  <button
                    type="button"
                    onClick={() => update(index, { maxWeeks: null })}
                    className={cn(
                      "flex-1 rounded-lg px-2 py-1.5 transition-colors",
                      !limited ? "bg-primary text-primary-foreground" : "text-muted-foreground",
                    )}
                  >
                    {ta("salaryDurationUnlimited")}
                  </button>
                </div>
                {limited ? (
                  <div className="mt-2 max-w-[9rem]">
                    <Field
                      label={ta("salaryPlanWeeks")}
                      value={row.maxWeeks ?? ""}
                      inputMode="numeric"
                      onChange={(value) => update(index, { maxWeeks: value })}
                    />
                  </div>
                ) : (
                  <p className="mt-2 text-[11px] text-muted-foreground">
                    {ta("salaryPlanNoExpiry")}
                  </p>
                )}
              </div>
            </article>
          );
        })}
      </div>

      <AdminSection id="salary-plan-validation" title={ta("salaryPlanValidationTitle")}>
        <div className="glass rounded-2xl p-4 sm:p-5">
          <div className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <ValidationFact
              label={ta("salaryPlanTotal")}
              value={`${(validation.totalBps / 100).toString()}%`}
            />
            <ValidationFact
              label={ta("salaryPlanRequired")}
              value="≤ 100%"
            />
            <ValidationFact
              label={ta("salaryPlanRemaining")}
              value={`${(validation.remainingBps / 100).toString()}%`}
            />
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">{ta("salaryPlanValidationStatus")}</span>
              <StatusBadge
                tone={validation.valid ? "success" : "danger"}
                label={
                  validation.valid ? ta("salaryPlanValid") : ta("salaryPlanInvalid")
                }
              />
            </div>
          </div>
          {validation.issues.length > 0 ? (
            <ul className="mt-4 space-y-1 text-xs text-red-600" role="alert">
              {validation.issues.map((issue) => (
                <li key={issue}>{issueLabel(issue, ta)}</li>
              ))}
            </ul>
          ) : null}
        </div>
      </AdminSection>

      {error && !reviewOpen && !authOpen ? (
        <p role="alert" className="text-sm font-semibold text-red-600">
          {error}
        </p>
      ) : null}

      <Button
        type="button"
        size="lg"
        className="w-full"
        disabled={!validation.valid || saving || reviewOpen || authOpen}
        onClick={openReview}
      >
        {ta("salaryPlanCommit")}
      </Button>

      <Link
        href="/admin/rank-salary/overview"
        className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "w-fit")}
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        {ta("salaryPlanBackToOverview")}
      </Link>

      {reviewOpen ? (
        <DialogShell
          title={ta("salaryPlanReviewTitle")}
          intro={ta("salaryPlanReviewIntro")}
          titleId="salary-plan-review-title"
          onClose={() => setReviewOpen(false)}
          fullViewMobile
        >
          <div className="space-y-4">
            <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted-foreground">
              <span>
                {ta("salaryPlanCurrentVersion")}:{" "}
                <strong className="text-foreground">v{active.version ?? "—"}</strong>
              </span>
              <span>
                {ta("salaryPlanProposedVersion")}:{" "}
                <strong className="text-foreground">v{nextVersion}</strong>
              </span>
            </div>

            {changes.length === 0 ? (
              <p className="text-sm text-muted-foreground">{ta("salaryPlanNoChanges")}</p>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-border">
                <table className="w-full min-w-[520px] border-collapse text-left text-sm">
                  <caption className="sr-only">{ta("salaryPlanReviewTitle")}</caption>
                  <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th scope="col" className="px-3 py-2">
                        {ta("salaryPlanRank")}
                      </th>
                      <th scope="col" className="px-3 py-2">
                        {ta("salaryPlanSetting")}
                      </th>
                      <th scope="col" className="px-3 py-2">
                        {ta("salaryPlanPrevious")}
                      </th>
                      <th scope="col" className="px-3 py-2">
                        {ta("salaryPlanNew")}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {changes.map((change) => (
                      <tr key={change.id}>
                        <td className="px-3 py-2 font-semibold">
                          {salaryChangeRankLabel(change, ta)}
                        </td>
                        <td className="px-3 py-2">{salaryChangeSettingLabel(change, ta)}</td>
                        <td className="px-3 py-2 tabular-nums">
                          {salaryChangeValue(change.previous, change.settingKey, locale, ta)}
                        </td>
                        <td className="px-3 py-2 font-semibold tabular-nums">
                          {salaryChangeValue(change.next, change.settingKey, locale, ta)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <p
              className={cn(
                "rounded-xl px-3 py-2 text-sm font-semibold",
                countdown > 0 ? "bg-amber-500/15 text-amber-700" : "bg-emerald-500/15 text-emerald-700",
              )}
              aria-live="polite"
            >
              {countdown > 0
                ? ta("salaryPlanReviewCountdown", { seconds: countdown })
                : ta("salaryPlanReviewReady")}
            </p>
            {error ? (
              <p role="alert" className="text-sm font-semibold text-red-600">
                {error}
              </p>
            ) : null}
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setReviewOpen(false)}
              >
                {tc("cancel")}
              </Button>
              <Button type="button" disabled={countdown > 0} onClick={confirmReview}>
                {ta("salaryPlanConfirmChanges")}
              </Button>
            </div>
          </div>
        </DialogShell>
      ) : null}

      {authOpen ? (
        <DialogShell
          title={ta("salaryPlanFinalTitle")}
          intro={ta("salaryPlanFinalIntro")}
          titleId="salary-plan-final-title"
          onClose={() => setAuthOpen(false)}
          fullViewMobile
        >
          <div className="space-y-4">
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3">
              <div className="flex items-center gap-2 text-sm font-bold text-red-700">
                <ShieldCheck className="size-4" aria-hidden="true" />
                {ta("salaryPlanFinalWarningTitle")}
              </div>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-xs leading-relaxed text-red-700">
                <li>{ta("salaryPlanFinalWarning1")}</li>
                <li>{ta("salaryPlanFinalWarning2")}</li>
                <li>{ta("salaryPlanFinalWarning3")}</li>
                <li>{ta("salaryPlanFinalWarning4")}</li>
              </ul>
            </div>

            <div className="space-y-1.5">
              <label htmlFor={passwordId} className={adminLabelClass}>
                {ta("salaryPlanAdminPassword")}
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
                {ta("salaryPlanGoBack")}
              </Button>
              <Button
                type="button"
                variant="destructive"
                disabled={saving || !password}
                onClick={() => void commit()}
              >
                {saving ? tc("saving") : ta("salaryPlanConfirmCommit")}
              </Button>
            </div>
          </div>
        </DialogShell>
      ) : null}
    </div>
  );
}

type Translator = (key: string, values?: Record<string, string | number>) => string;

function issueLabel(issue: SalaryPlanValidationIssue, ta: Translator): string {
  switch (issue) {
    case "allocationFormat":
      return ta("salaryPlanIssueAllocationFormat");
    case "allocationExceeded":
      return ta("salaryPlanCannotExceed");
    case "enabledNeedsAllocation":
      return ta("salaryPlanIssueNeedsAllocation");
    case "enabledNeedsCap":
      return ta("salaryPlanIssueNeedsCap");
    case "capFormat":
      return ta("salaryPlanIssueCapFormat");
    case "weeksFormat":
      return ta("salaryPlanIssueWeeksFormat");
    case "effectiveDate":
      return ta("salaryPlanIssueEffectiveDate");
  }
}

function mapCommitError(error: string | undefined, ta: Translator): string {
  switch (error) {
    case "INVALID_ADMIN_PASSWORD":
      return ta("salaryPlanInvalidPassword");
    case "Invalid salary values":
    case "Please check the salary values":
    case "Invalid effective date":
      return ta("salaryPlanInvalidValues");
    case "SALARY_PLAN_FAILED":
    default:
      return ta("salaryPlanFailed");
  }
}

function ValidationFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 justify-between gap-3">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <strong className="min-w-0 truncate tabular-nums">{value}</strong>
    </div>
  );
}
