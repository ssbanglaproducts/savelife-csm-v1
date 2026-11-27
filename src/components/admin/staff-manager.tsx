"use client";

import { useMemo, useState, type FormEvent } from "react";
import { Info, KeyRound, Pencil, Plus, Search, ShieldCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import { AdminFormDialog } from "@/components/admin/admin-form-dialog";
import {
  AdminConfigCommitDialog,
  type AdminConfigChange,
} from "@/components/admin/admin-config-commit-dialog";
import {
  AdminRecordCard,
  AdminRecordField,
  AdminTable,
  EmptyState,
  StatusBadge,
  adminInputClass,
  adminLabelClass,
} from "@/components/admin/admin-ui";
import { useAdminAction } from "@/components/admin/use-admin-action";
import { Button } from "@/components/ui/button";
import {
  BASELINE_PERMISSIONS,
  PERMISSION_GROUPS,
  type AdminPermission,
} from "@/lib/admin-permissions";
import type { StaffAccountView } from "@/lib/staff";

type Draft = {
  name: string;
  email: string;
  phone: string;
  password: string;
  permissions: AdminPermission[];
};

type StaffPayload = {
  action: "CREATE" | "UPDATE" | "SET_STATUS";
  targetId?: string;
  name?: string;
  email?: string;
  phone?: string;
  password?: string;
  permissions?: AdminPermission[];
  status?: "ACTIVE" | "SUSPENDED";
};

type ReviewState = {
  key: string;
  payload: StaffPayload;
  changes: AdminConfigChange[];
};

let fallbackKeyCounter = 0;

function newIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  fallbackKeyCounter += 1;
  return `staff-${Date.now()}-${fallbackKeyCounter}`;
}

const permissionLabels = new Map(
  PERMISSION_GROUPS.flatMap((group) => group.permissions).map((entry) => [
    entry.value,
    entry.labelKey,
  ]),
);

export function StaffManager({
  staff,
  canManage,
  currentUserId,
  grantablePermissions,
}: {
  staff: readonly StaffAccountView[];
  canManage: boolean;
  currentUserId: string;
  grantablePermissions: readonly AdminPermission[];
}) {
  const t = useTranslations("adminPanel");
  const tc = useTranslations("common");
  const { pending, run } = useAdminAction();
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [review, setReview] = useState<ReviewState | null>(null);
  const [error, setError] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return staff;
    return staff.filter((account) =>
      [account.fullName, account.email, account.phone].some((value) =>
        value.toLowerCase().includes(needle),
      ),
    );
  }, [query, staff]);

  const visibleGroups = useMemo(() => {
    const grantable = new Set(grantablePermissions);
    return PERMISSION_GROUPS.map((group) => ({
      ...group,
      permissions: group.permissions.filter(
        (entry) => entry.alwaysOn || grantable.has(entry.value),
      ),
    })).filter((group) => group.permissions.length > 0);
  }, [grantablePermissions]);

  const permissionLabel = (value: AdminPermission) =>
    t(permissionLabels.get(value) ?? value);

  function resetDraft() {
    setDraft({
      name: "",
      email: "",
      phone: "",
      password: "",
      permissions: [...BASELINE_PERMISSIONS],
    });
    setEditingId(null);
  }

  function openCreate() {
    resetDraft();
    setError(null);
  }

  function openEdit(account: StaffAccountView) {
    const grantable = new Set(grantablePermissions);
    setDraft({
      name: account.fullName,
      email: account.email,
      phone: account.phone,
      password: "",
      permissions: account.permissions.filter(
        (permission) => grantable.has(permission),
      ),
    });
    setEditingId(account.id);
    setError(null);
  }

  function togglePermission(permission: AdminPermission, checked: boolean) {
    setDraft((current) => {
      if (!current) return current;
      const next = new Set(current.permissions);
      if (checked) next.add(permission);
      else next.delete(permission);
      return { ...current, permissions: [...next].sort() };
    });
  }

  function beginReview(payload: StaffPayload, changes: AdminConfigChange[]) {
    setReview({ key: newIdempotencyKey(), payload, changes });
    setError(null);
  }

  function handleDraftSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft) return;
    const payload: StaffPayload =
      editingId
        ? {
            action: "UPDATE",
            targetId: editingId,
            name: draft.name.trim(),
            email: draft.email.trim(),
            phone: draft.phone.trim(),
            ...(draft.password ? { password: draft.password } : {}),
            permissions: draft.permissions,
          }
        : {
            action: "CREATE",
            name: draft.name.trim(),
            email: draft.email.trim(),
            phone: draft.phone.trim(),
            password: draft.password,
            permissions: draft.permissions,
          };

    beginReview(payload, [
      { label: t("staffName"), value: draft.name.trim() },
      { label: t("staffEmail"), value: draft.email.trim() },
      { label: t("staffPhone"), value: draft.phone.trim() },
      ...(draft.password
        ? [
            {
              label: editingId ? t("staffNewPassword") : t("staffPassword"),
              value: "••••••••",
            },
          ]
        : []),
      {
        label: t("staffPermissions"),
        value: draft.permissions.map(permissionLabel).join(", ") || t("staffBaselineOnly"),
      },
    ]);
  }

  function requestStatusChange(account: StaffAccountView) {
    const status = account.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE";
    beginReview(
      { action: "SET_STATUS", targetId: account.id, status },
      [
        {
          label: t("staffStatus"),
          previous: account.status === "ACTIVE" ? t("staffActive") : t("staffSuspended"),
          value: status === "ACTIVE" ? t("staffActive") : t("staffSuspended"),
        },
      ],
    );
  }

  async function commit(password: string) {
    if (!review) return false;
    const ok = await run(
      "/api/admin/staff",
      "POST",
      { ...review.payload, idempotencyKey: review.key, adminPassword: password },
      {
        INVALID_ADMIN_PASSWORD: t("configInvalidPassword"),
        DUPLICATE: t("adminErrorDuplicate"),
        DUPLICATE_REQUEST: t("adminErrorDuplicate"),
        DUPLICATE_EMAIL: t("staffDuplicateEmail"),
        SELF_LOCKOUT: t("staffSelfLockout"),
        LAST_SUPER_ADMIN: t("staffLastAdmin"),
        ADMIN_PROTECTED: t("staffAdminProtected"),
        PERMISSION_ESCALATION: t("staffPermissionEscalation"),
        STAFF_MUTATION_FAILED: t("staffMutationFailed"),
      },
      setError,
    );
    if (ok) {
      setReview(null);
      setDraft(null);
      setEditingId(null);
      setError(null);
    }
    return ok;
  }

  const mobileCards = (
    <div className="space-y-3">
      {filtered.length === 0 ? <EmptyState message={t("staffNoAccounts")} /> : null}
      {filtered.map((account) => (
        <AdminRecordCard
          key={account.id}
          title={account.fullName}
          subtitle={account.email}
          status={
            <StatusBadge
              tone={
                account.status === "ACTIVE"
                  ? "success"
                  : account.status === "SUSPENDED"
                    ? "danger"
                    : "neutral"
              }
              label={
                account.status === "ACTIVE"
                  ? t("staffActive")
                  : account.status === "SUSPENDED"
                    ? t("staffSuspended")
                    : t("staffInactive")
                  }
            />
          }
          footer={
            canManage && account.id !== currentUserId ? (
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => openEdit(account)}>
                  <Pencil className="size-4" aria-hidden="true" />
                  {t("staffEdit")}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => requestStatusChange(account)}
                >
                  {account.status === "ACTIVE" ? t("staffSuspend") : t("staffActivate")}
                </Button>
              </div>
            ) : null
          }
        >
          <AdminRecordField
            label={t("staffPermissions")}
            value={String(account.permissions.length)}
          />
        </AdminRecordCard>
      ))}
    </div>
  );

  return (
    <div className="space-y-5">
      <div className="glass flex flex-wrap items-center gap-3 rounded-2xl p-3 sm:p-4">
        <label className="relative min-w-48 flex-1">
          <span className="sr-only">{t("staffSearchPlaceholder")}</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("staffSearchPlaceholder")}
            className={`${adminInputClass} pl-9`}
          />
        </label>
        {canManage ? (
          <Button type="button" onClick={openCreate}>
            <Plus className="size-4" aria-hidden="true" />
            {t("staffNew")}
          </Button>
        ) : null}
      </div>

      <AdminTable
        caption={t("staffTitle")}
        headers={[
          t("staffName"),
          t("staffEmail"),
          t("staffPermissions"),
          t("staffStatus"),
          t("staffActions"),
        ]}
        mobile={mobileCards}
      >
        {filtered.length === 0 ? (
          <tr>
            <td colSpan={5} className="px-4 py-10 text-center text-sm text-muted-foreground">
              {t("staffNoAccounts")}
            </td>
          </tr>
        ) : null}
        {filtered.map((account) => (
          <tr key={account.id} className="min-w-[720px]">
            <td className="px-4 py-3">
              <div className="font-semibold">{account.fullName}</div>
              {account.id === currentUserId ? (
                <div className="text-xs text-muted-foreground">{t("staffCurrentAccount")}</div>
              ) : null}
            </td>
            <td className="px-4 py-3 text-muted-foreground">{account.email}</td>
            <td className="px-4 py-3 tabular-nums">{account.permissions.length}</td>
            <td className="px-4 py-3">
              <StatusBadge
                tone={
                  account.status === "ACTIVE"
                    ? "success"
                    : account.status === "SUSPENDED"
                      ? "danger"
                      : "neutral"
                }
                label={
                  account.status === "ACTIVE"
                    ? t("staffActive")
                    : account.status === "SUSPENDED"
                      ? t("staffSuspended")
                      : t("staffInactive")
                }
              />
            </td>
            <td className="px-4 py-3">
              {canManage && account.id !== currentUserId ? (
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => openEdit(account)}>
                    <Pencil className="size-4" aria-hidden="true" />
                    {t("staffEdit")}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => requestStatusChange(account)}
                  >
                    {account.status === "ACTIVE" ? t("staffSuspend") : t("staffActivate")}
                  </Button>
                </div>
              ) : (
                <span className="text-xs text-muted-foreground">—</span>
              )}
            </td>
          </tr>
        ))}
      </AdminTable>

      {draft && !review ? (
        <AdminFormDialog
          title={editingId ? t("staffEditTitle") : t("staffCreateTitle")}
          intro={editingId ? t("staffEditIntro") : t("staffCreateIntro")}
          onClose={() => {
            setDraft(null);
            setEditingId(null);
            setError(null);
          }}
          wide
        >
          <form onSubmit={handleDraftSubmit} className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label htmlFor="staff-name" className={adminLabelClass}>
                  {t("staffName")}
                </label>
                <input
                  id="staff-name"
                  required
                  minLength={2}
                  maxLength={80}
                  value={draft.name}
                  onChange={(event) => setDraft({ ...draft, name: event.target.value })}
                  className={adminInputClass}
                  data-dialog-autofocus
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="staff-email" className={adminLabelClass}>
                  {t("staffEmail")}
                </label>
                <input
                  id="staff-email"
                  type="email"
                  required
                  maxLength={254}
                  value={draft.email}
                  onChange={(event) => setDraft({ ...draft, email: event.target.value })}
                  className={adminInputClass}
                  autoComplete="off"
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="staff-phone" className={adminLabelClass}>
                  {t("staffPhone")}
                </label>
                <input
                  id="staff-phone"
                  type="tel"
                  required
                  minLength={8}
                  maxLength={30}
                  value={draft.phone}
                  onChange={(event) => setDraft({ ...draft, phone: event.target.value })}
                  className={adminInputClass}
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="staff-password" className={adminLabelClass}>
                  {editingId ? t("staffNewPassword") : t("staffPassword")}
                </label>
                <input
                  id="staff-password"
                  type="password"
                  required={!editingId}
                  minLength={8}
                  maxLength={128}
                  value={draft.password}
                  onChange={(event) => setDraft({ ...draft, password: event.target.value })}
                  className={adminInputClass}
                  autoComplete="new-password"
                />
                {editingId ? (
                  <p className="text-xs text-muted-foreground">{t("staffPasswordHint")}</p>
                ) : null}
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-bold">
                <ShieldCheck className="size-4 text-primary" aria-hidden="true" />
                {t("staffPermissions")}
              </div>
              {visibleGroups.map((group) => (
                <fieldset key={group.id} className="rounded-xl border border-border p-3">
                  <legend className="px-1 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    {t(group.labelKey)}
                  </legend>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {group.permissions.map((entry) => {
                      const checked =
                        entry.alwaysOn || draft.permissions.includes(entry.value);
                      const help = t(`${entry.labelKey}Help`);
                      return (
                        <label
                          key={entry.value}
                          className="flex min-w-0 items-center gap-2 rounded-lg px-2 py-1.5 text-sm"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={entry.alwaysOn}
                            onChange={(event) => togglePermission(entry.value, event.target.checked)}
                            className="size-4 shrink-0 accent-primary"
                          />
                          <span className="inline-flex min-w-0 items-center gap-1.5">
                            <span className="min-w-0 break-words">{t(entry.labelKey)}</span>
                            <span
                              role="img"
                              aria-label={help}
                              title={help}
                              className="inline-flex shrink-0 cursor-help text-muted-foreground"
                            >
                              <Info className="size-3.5" aria-hidden="true" />
                            </span>
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </fieldset>
              ))}
            </div>

            <div className="flex flex-wrap justify-end gap-2 border-t border-border pt-4">
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setDraft(null);
                  setEditingId(null);
                  setError(null);
                }}
              >
                {tc("cancel")}
              </Button>
              <Button type="submit">
                {editingId ? t("staffReviewUpdate") : t("staffReviewCreate")}
              </Button>
            </div>
          </form>
        </AdminFormDialog>
      ) : null}

      {review ? (
        <AdminConfigCommitDialog
          copy="staff"
          onClose={() => {
            setReview(null);
            setError(null);
          }}
          changes={review.changes}
          pending={pending}
          error={error}
          onClearError={() => setError(null)}
          onCommit={commit}
        />
      ) : null}

      {!canManage ? (
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <KeyRound className="size-4" aria-hidden="true" />
          {t("staffReadOnly")}
        </p>
      ) : null}
    </div>
  );
}
