"use client";

import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import {
  ArrowRight,
  CheckCircle2,
  Loader2,
  Search,
  Send,
  ShieldCheck,
} from "lucide-react";
import { Link } from "@/i18n/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { formatSP } from "@/lib/money";
import { normalizeMemberId } from "@/lib/member-id";
import { statusLabelKey } from "@/components/member/status-labels";
import { AvailableBalanceCard } from "./available-balance-card";
import { memberFieldClass, memberInputClass, memberLabelClass } from "./form-styles";
import { TeamAvatar } from "./team-ui";
import { TPinConfirmDialog } from "./tpin-confirm-dialog";

type Recipient = {
  id: string;
  memberId: string;
  fullName: string;
  profileImage: string | null;
  status: "ACTIVE" | "INACTIVE" | "SUSPENDED";
};

type PendingTransfer = {
  recipientId: string;
  amount: string;
  note: string;
  idempotencyKey: string;
};

const inputModeClass = "[&::-webkit-inner-spin-button]:appearance-none";

export function SendMoneyForm({
  availablePaisa,
  currentMemberId,
}: {
  availablePaisa: bigint;
  currentMemberId: string;
}) {
  const tPanel = useTranslations("memberPanel");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const idempotencyKey = useRef<string | null>(null);

  const [recipient, setRecipient] = useState<Recipient | null>(null);
  const [lookingUp, setLookingUp] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{
    transferNumber: string;
    amount: bigint;
    availablePaisa: bigint;
  } | null>(null);
  const [pendingTransfer, setPendingTransfer] = useState<PendingTransfer | null>(null);

  function errorMessage(code: string | undefined) {
    switch (code) {
      case "MEMBER_ID_REQUIRED":
        return tPanel("recipientIdRequired");
      case "RECIPIENT_NOT_FOUND":
        return tPanel("recipientNotFound");
      case "RECIPIENT_UNAVAILABLE":
        return tPanel("recipientUnavailable");
      case "CANNOT_SEND_TO_SELF":
        return tPanel("cannotSendToSelf");
      case "TPIN_NOT_SET":
        return tPanel("tPinNotSet");
      case "INVALID_TPIN":
        return tPanel("invalidTPin");
      case "INSUFFICIENT_BALANCE":
        return tPanel("insufficientBalance");
      case "MEMBER_NOT_ACTIVE":
        return tPanel("memberNotActiveError");
      case "DUPLICATE_REQUEST":
        return tPanel("duplicateRequestError");
      default:
        return tCommon("error");
    }
  }

  async function handleLookup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setRecipient(null);
    const memberId = String(new FormData(event.currentTarget).get("memberId") ?? "").trim();
    if (!memberId) {
      setError(tPanel("recipientIdRequired"));
      return;
    }
    if (normalizeMemberId(memberId) === normalizeMemberId(currentMemberId)) {
      setError(tPanel("cannotSendToSelf"));
      return;
    }

    setLookingUp(true);
    try {
      const response = await fetch(
        `/api/member/money-transfers/recipient?memberId=${encodeURIComponent(memberId)}`,
        { cache: "no-store" },
      );
      const data = (await response.json()) as {
        error?: string;
        recipient?: Recipient & { status: "ACTIVE" | "INACTIVE" | "SUSPENDED" };
      };
      if (!response.ok || !data.recipient) {
        setError(errorMessage(data.error));
        return;
      }
      if (data.recipient.status === "SUSPENDED") {
        setError(tPanel("recipientUnavailable"));
        return;
      }
      setRecipient(data.recipient);
    } catch {
      setError(tCommon("error"));
    } finally {
      setLookingUp(false);
    }
  }

  function handleSend(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!recipient) return;
    if (normalizeMemberId(recipient.memberId) === normalizeMemberId(currentMemberId)) {
      setError(tPanel("cannotSendToSelf"));
      return;
    }

    setError(null);
    const form = new FormData(event.currentTarget);
    idempotencyKey.current ??= `${Date.now()}:${Math.random().toString(36).slice(2)}`;
    setPendingTransfer({
      recipientId: recipient.id,
      amount: String(form.get("amount") ?? "").trim(),
      note: String(form.get("note") ?? "").trim(),
      idempotencyKey: idempotencyKey.current,
    });
  }

  async function confirmSend(tPin: string) {
    if (!pendingTransfer) return;
    setPending(true);
    setError(null);

    try {
      const response = await fetch("/api/member/money-transfers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...pendingTransfer, tPin }),
      });
      const data = (await response.json()) as {
        error?: string;
        transfer?: { transferNumber: string; amountPaisa: string };
        availablePaisa?: string;
      };
      if (!response.ok || !data.transfer) {
        setError(errorMessage(data.error));
        if (data.error === "DUPLICATE_REQUEST") {
          idempotencyKey.current = null;
          setPendingTransfer(null);
        }
        return;
      }

      idempotencyKey.current = null;
      setPendingTransfer(null);
      setSuccess({
        transferNumber: data.transfer.transferNumber,
        amount: BigInt(data.transfer.amountPaisa),
        availablePaisa: BigInt(data.availablePaisa ?? "0"),
      });
      toast.success(tPanel("sendMoneySuccess"));
      router.refresh();
    } catch {
      setError(tCommon("error"));
    } finally {
      setPending(false);
    }
  }

  if (success) {
    return (
      <section className="glass rounded-3xl p-6 text-center sm:p-10" aria-live="polite">
        <span className="mx-auto flex size-16 items-center justify-center rounded-2xl bg-primary/15 text-primary">
          <CheckCircle2 className="size-8" aria-hidden="true" />
        </span>
        <h2 className="mt-5 font-display text-2xl font-bold">{tPanel("sendMoneySuccessTitle")}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{tPanel("sendMoneySuccessBody")}</p>
        <dl className="mx-auto mt-6 grid max-w-lg gap-3 text-left sm:grid-cols-3">
          <div className="glass rounded-2xl p-4">
            <dt className="text-xs text-muted-foreground">{tPanel("reference")}</dt>
            <dd className="mt-1 truncate font-mono text-xs font-bold" translate="no">
              {success.transferNumber}
            </dd>
          </div>
          <div className="glass rounded-2xl p-4">
            <dt className="text-xs text-muted-foreground">{tCommon("amount")}</dt>
            <dd className="mt-1 font-display font-bold tabular-nums">
              {formatSP(success.amount)}
            </dd>
          </div>
          <div className="glass rounded-2xl p-4">
            <dt className="text-xs text-muted-foreground">{tPanel("available")}</dt>
            <dd className="mt-1 font-display font-bold tabular-nums">
              {formatSP(success.availablePaisa)}
            </dd>
          </div>
        </dl>
        <div className="mt-7 flex flex-wrap justify-center gap-3">
          <Link href="/member/transactions" className="inline-flex h-11 items-center rounded-xl bg-primary px-5 text-sm font-bold text-primary-foreground">
            {tPanel("viewTransactions")}
          </Link>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setSuccess(null);
              setRecipient(null);
              idempotencyKey.current = null;
            }}
          >
            {tPanel("sendAnother")}
          </Button>
        </div>
      </section>
    );
  }

  return (
    <>
      <div className="space-y-6">
        <AvailableBalanceCard
          availablePaisa={availablePaisa}
          hint={tPanel("sendMoneyOnlyAvailable")}
        />

        <section className="glass rounded-3xl p-6 sm:p-8" aria-labelledby="send-money-heading">
        <div className="flex items-start gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
            <Search className="size-5" aria-hidden="true" />
          </span>
          <div>
            <h2 id="send-money-heading" className="font-display text-xl font-bold">
              {tPanel("sendMoneyStepOne")}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">{tPanel("sendMoneyStepOneHint")}</p>
          </div>
        </div>

        <form onSubmit={handleLookup} className="mt-6 flex flex-col gap-3 sm:flex-row">
          <div className={memberFieldClass + " flex-1"}>
            <label htmlFor="send-money-member-id" className={memberLabelClass}>
              {tPanel("recipientMemberId")}
            </label>
            <input
              id="send-money-member-id"
              name="memberId"
              required
              defaultValue={recipient?.memberId ?? ""}
              placeholder="SL000001"
              translate="no"
              className={`${memberInputClass} mt-2 font-mono uppercase`}
            />
          </div>
          <Button type="submit" size="lg" disabled={lookingUp} className="sm:mt-7">
            {lookingUp ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
            {lookingUp ? tPanel("verifying") : tPanel("verifyMember")}
          </Button>
        </form>

        {recipient ? (
          <div className="mt-6 rounded-2xl border border-primary/20 bg-primary/[0.04] p-5">
            <div className="flex items-center gap-4">
              <TeamAvatar
                name={recipient.fullName}
                image={recipient.profileImage}
                className="size-14"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate font-display text-lg font-bold">{recipient.fullName}</p>
                <p className="font-mono text-xs text-muted-foreground" translate="no">
                  {recipient.memberId}
                </p>
              </div>
              <span className="rounded-full bg-primary/10 px-3 py-1 text-[11px] font-bold text-primary">
                {tPanel(statusLabelKey(recipient.status))}
              </span>
            </div>
            <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
              {recipient.status === "INACTIVE"
                ? tPanel("recipientInactiveHint")
                : tPanel("recipientVerifiedHint")}
            </p>
          </div>
        ) : null}
      </section>

      {recipient ? (
        <form onSubmit={handleSend} className="glass rounded-3xl p-6 sm:p-8" aria-live="polite">
          <div className="flex items-start gap-3">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
              <Send className="size-5" aria-hidden="true" />
            </span>
            <div>
              <h2 className="font-display text-xl font-bold">{tPanel("sendMoneyStepTwo")}</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {tPanel("sendMoneyStepTwoHint")}
              </p>
            </div>
          </div>

          <div className="mt-6 grid gap-5 sm:grid-cols-2">
            <div className={memberFieldClass}>
              <label htmlFor="send-money-amount" className={memberLabelClass}>
                {tCommon("amount")}
              </label>
              <input
                id="send-money-amount"
                name="amount"
                required
                inputMode="decimal"
                pattern="^\d+(\.\d{1,2})?$"
                placeholder="0.00"
                className={`${memberInputClass} ${inputModeClass} mt-2 tabular-nums`}
              />
            </div>
            <div className={memberFieldClass}>
              <label htmlFor="send-money-note" className={memberLabelClass}>
                {tPanel("transactionNote")} <span className="text-muted-foreground">({tCommon("optional")})</span>
              </label>
              <input
                id="send-money-note"
                name="note"
                maxLength={300}
                className={`${memberInputClass} mt-2`}
              />
            </div>
          </div>

          <div className="mt-5 rounded-2xl border border-border bg-muted/30 p-4 text-sm">
            <p className="font-semibold">{tPanel("sendMoneyReviewTitle")}</p>
            <p className="mt-2 truncate text-muted-foreground">
              {recipient.fullName} · <span translate="no">{recipient.memberId}</span>
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {tPanel("sendMoneyOnlyAvailable")}
            </p>
          </div>

          {error ? (
            <p className="mt-5 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-300" role="alert">
              {error}
            </p>
          ) : null}

          <div className="mt-7 flex flex-col gap-3 border-t border-border pt-6 sm:flex-row sm:items-center sm:justify-between">
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <ShieldCheck className="size-4 shrink-0 text-primary" aria-hidden="true" />
              {tPanel("sendMoneySecureHint")}
            </p>
            <Button type="submit" size="lg" disabled={pending || pendingTransfer !== null}>
              {pending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
              {pending ? tPanel("sending") : tPanel("sendMoney")}
              {!pending ? <ArrowRight className="size-4" aria-hidden="true" /> : null}
            </Button>
          </div>
        </form>
      ) : null}

      {error && !recipient ? (
        <p className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-300" role="alert">
          {error}
        </p>
      ) : null}
      </div>

      {pendingTransfer ? (
        <TPinConfirmDialog
          open
          title={tPanel("tPinDialogTitle")}
          busy={pending}
          error={error}
          onClose={() => setPendingTransfer(null)}
          onConfirm={(pin) => void confirmSend(pin)}
        />
      ) : null}
    </>
  );
}
