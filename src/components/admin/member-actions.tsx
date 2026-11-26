"use client";

import { useId, useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { Ban, CheckCircle2, KeyRound, RotateCcw, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  StatusBadge,
  adminInputClass,
  memberStatusKey,
  statusTone,
} from "./admin-ui";
import { AdminFormDialog } from "./admin-form-dialog";
import { useAdminAction } from "./use-admin-action";

export type MemberActionMember = {
  id: string;
  memberId: string;
  name: string;
  status: string;
  profileImage: string | null;
  rank: string;
};

export type MemberActionKind = "deactivate" | "reactivate" | "activate" | "topup" | "resetTpin";

export type MemberActionState = {
  kind: MemberActionKind;
  member: MemberActionMember;
};

export function MemberAvatar({
  name,
  src,
  size = "md",
}: {
  name: string;
  src: string | null;
  size?: "sm" | "md" | "lg";
}) {
  const [failed, setFailed] = useState(false);
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
  const imageSize = size === "sm" ? "size-8" : size === "lg" ? "size-20" : "size-10";
  const fallbackSize =
    size === "sm" ? "size-8 text-[10px]" : size === "lg" ? "size-20 text-lg" : "size-10 text-xs";

  if (src && !failed) {
    return (
      // Profile images are admin-uploaded files or external URLs of unknown size.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={name}
        onError={() => setFailed(true)}
        className={`${imageSize} shrink-0 rounded-full border border-border object-cover`}
      />
    );
  }

  return (
    <span
      className={`${fallbackSize} flex shrink-0 items-center justify-center rounded-full border border-border bg-primary/10 font-bold text-primary`}
    >
      {initials || "?"}
    </span>
  );
}

export function MemberDetailActions({ member }: { member: MemberActionMember }) {
  const t = useTranslations("adminPanel");
  const [dialog, setDialog] = useState<MemberActionState | null>(null);

  return (
    <>
      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={() => setDialog({ kind: "topup", member })}>
          <Wallet className="size-4" aria-hidden="true" />
          {t("topUp")}
        </Button>
        <Button type="button" variant="outline" onClick={() => setDialog({ kind: "resetTpin", member })}>
          <KeyRound className="size-4" aria-hidden="true" />
          {t("resetTpin")}
        </Button>
        {member.status === "SUSPENDED" ? (
          <Button
            type="button"
            variant="outline"
            onClick={() => setDialog({ kind: "reactivate", member })}
          >
            <RotateCcw className="size-4" aria-hidden="true" />
            {t("reactivate")}
          </Button>
        ) : member.status === "INACTIVE" ? (
          <Button
            type="button"
            variant="outline"
            onClick={() => setDialog({ kind: "activate", member })}
          >
            <CheckCircle2 className="size-4" aria-hidden="true" />
            {t("activate")}
          </Button>
        ) : (
          <Button
            type="button"
            variant="destructive"
            onClick={() => setDialog({ kind: "deactivate", member })}
          >
            <Ban className="size-4" aria-hidden="true" />
            {t("deactivate")}
          </Button>
        )}
      </div>

      {dialog ? (
        <MemberActionDialog
          key={`${dialog.member.id}-${dialog.kind}`}
          state={dialog}
          onClose={() => setDialog(null)}
        />
      ) : null}
    </>
  );
}

export function MemberActionDialog({
  state,
  onClose,
}: {
  state: MemberActionState;
  onClose: () => void;
}) {
  const t = useTranslations("adminPanel");
  const tc = useTranslations("common");
  const tm = useTranslations("memberPanel");
  const fieldId = useId();
  const { pending, run } = useAdminAction();
  const [error, setError] = useState<string | null>(null);
  const isDeactivate = state.kind === "deactivate";
  const isResetTPin = state.kind === "resetTpin";

  const titles = {
    deactivate: t("deactivateTitle"),
    reactivate: t("reactivateTitle"),
    activate: t("activateTitle"),
    topup: t("topUpTitle"),
    resetTpin: t("resetTpinTitle"),
  };
  const intros = {
    deactivate: t("deactivateIntro"),
    reactivate: t("reactivateIntro"),
    activate: t("activateIntro"),
    topup: t("topUpIntro"),
    resetTpin: t("resetTpinIntro"),
  };

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const note = String(data.get("note") ?? "").trim();

    if ((isDeactivate || isResetTPin) && !note) {
      setError(t("noteRequired"));
      return;
    }

    if (isResetTPin) {
      const newTPin = String(data.get("newTPin") ?? "").trim();
      const confirmTPin = String(data.get("confirmTPin") ?? "").trim();
      if (!/^\d{6}$/.test(newTPin) || newTPin !== confirmTPin) {
        setError(t("resetTpinMismatch"));
        return;
      }
    }

    const statusAction =
      state.kind === "deactivate" ? "DEACTIVATE" : state.kind === "activate" ? "ACTIVATE" : "REACTIVATE";
    const newTPin = String(data.get("newTPin") ?? "").trim();
    const confirmTPin = String(data.get("confirmTPin") ?? "").trim();
    const payload = isResetTPin
      ? { newTPin, confirmTPin, note }
      : state.kind === "topup"
        ? { amount: String(data.get("amount") ?? "").trim(), note }
        : { action: statusAction, note };
    const url = isResetTPin
      ? `/api/admin/members/${state.member.id}/tpin`
      : state.kind === "topup"
        ? `/api/admin/members/${state.member.id}/top-up`
        : `/api/admin/members/${state.member.id}/status`;

    const ok = await run(
      url,
      "POST",
      payload,
      {
        NOTE_REQUIRED: t("noteRequired"),
        TOP_UP_FAILED: tc("error"),
        FORBIDDEN: tc("error"),
        INVALID_REQUEST: tc("error"),
        MEMBER_NOT_FOUND: tc("error"),
        TPIN_MISMATCH: t("resetTpinMismatch"),
        INVALID_TPIN: t("resetTpinMismatch"),
        TPIN_UNCHANGED: t("resetTpinUnchanged"),
        "Please check the amount": t("amountRequired"),
      },
      setError,
    );
    if (ok) onClose();
  }

  return (
    <AdminFormDialog
      title={titles[state.kind]}
      intro={intros[state.kind]}
      onClose={onClose}
    >
      <div className="flex min-w-0 items-center gap-3 rounded-xl bg-[var(--glass)] p-3">
        <MemberAvatar name={state.member.name} src={state.member.profileImage} size="sm" />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{state.member.name}</p>
          <p className="truncate font-mono text-xs text-muted-foreground" translate="no">
            {state.member.memberId}
          </p>
        </div>
        <div className="ml-auto flex shrink-0 flex-col items-end gap-1">
          <StatusBadge
            tone={statusTone(state.member.status)}
            label={tm(memberStatusKey(state.member.status))}
          />
          <span className="text-[11px] text-muted-foreground">
            {tm("rank")}: {state.member.rank}
          </span>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          {state.kind === "topup" ? (
            <div>
              <label htmlFor={`${fieldId}-amount`} className="block text-sm font-semibold">
                {t("amountSP")}
              </label>
              <input
                id={`${fieldId}-amount`}
                name="amount"
                type="number"
                min="0.01"
                step="0.01"
                required
                className={`${adminInputClass} mt-2`}
                placeholder="500"
              />
            </div>
          ) : null}

          {isResetTPin ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor={`${fieldId}-new-tpin`} className="block text-sm font-semibold">
                  {t("newTPin")}
                </label>
                <input
                  id={`${fieldId}-new-tpin`}
                  name="newTPin"
                  type="password"
                  inputMode="numeric"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  required
                  autoComplete="off"
                  className={`${adminInputClass} mt-2 text-center font-mono tracking-[0.3em]`}
                />
              </div>
              <div>
                <label htmlFor={`${fieldId}-confirm-tpin`} className="block text-sm font-semibold">
                  {t("confirmTPin")}
                </label>
                <input
                  id={`${fieldId}-confirm-tpin`}
                  name="confirmTPin"
                  type="password"
                  inputMode="numeric"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  required
                  autoComplete="off"
                  className={`${adminInputClass} mt-2 text-center font-mono tracking-[0.3em]`}
                />
              </div>
              <p className="text-xs text-muted-foreground sm:col-span-2">{t("resetTpinHint")}</p>
            </div>
          ) : null}

          {state.kind !== "reactivate" && state.kind !== "activate" ? (
            <div>
              <label htmlFor={`${fieldId}-note`} className="block text-sm font-semibold">
                {t("note")}
                {isDeactivate || isResetTPin ? " *" : ` (${tc("optional")})`}
              </label>
              <textarea
                id={`${fieldId}-note`}
                name="note"
                rows={3}
                maxLength={500}
                minLength={isResetTPin ? 3 : undefined}
                required={isDeactivate || isResetTPin}
                className={`${adminInputClass} mt-2 h-auto min-h-24 resize-y py-2`}
              />
            </div>
          ) : null}

          {error ? <p className="text-sm text-red-500">{error}</p> : null}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={onClose} disabled={pending}>
              {tc("cancel")}
            </Button>
            <Button
              type="submit"
              variant={state.kind === "deactivate" ? "destructive" : "default"}
              disabled={pending}
            >
              {pending ? tc("saving") : tc("confirm")}
            </Button>
          </div>
      </form>
    </AdminFormDialog>
  );
}
