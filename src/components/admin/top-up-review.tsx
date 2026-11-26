"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Loader2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatMemberDate } from "@/components/member/format-date";
import { statusLabelKey } from "@/components/member/status-labels";
import { formatSP } from "@/lib/money";
import {
  StatusBadge,
  adminInputClass,
  statusTone,
} from "@/components/admin/admin-ui";
import {
  AdminActionDialogButton,
  useCloseAdminActionDialog,
} from "@/components/admin/admin-action-dialog-button";
import { useAdminAction } from "./use-admin-action";

export type AdminTopUpRequest = {
  id: string;
  requestNumber: string;
  amountPaisa: string;
  method: string;
  transactionRef: string;
  proofImageUrl: string | null;
  note: string | null;
  status: "PENDING" | "APPROVED" | "REJECTED";
  createdAt: string;
  reviewedAt: string | null;
  member: { memberId: string; fullName: string };
};

function TopUpReviewForm({ request }: { request: AdminTopUpRequest }) {
  const t = useTranslations("adminPanel");
  const [note, setNote] = useState("");
  const { pending, run } = useAdminAction();
  const closeDialog = useCloseAdminActionDialog();

  async function review(action: "APPROVE" | "REJECT") {
    const ok = await run("/api/admin/wallet-topups", "PATCH", {
      requestId: request.id,
      action,
      note,
    });
    if (ok) closeDialog();
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs font-bold text-muted-foreground">{t("member")}</p>
        <p className="mt-1 text-sm font-semibold">
          {request.member.fullName}{" "}
          <span className="font-mono text-xs text-muted-foreground" translate="no">
            {request.member.memberId}
          </span>
        </p>
      </div>
      <div>
        <label htmlFor={`topup-note-${request.id}`} className="text-xs font-bold">
          {t("note")}
        </label>
        <input
          id={`topup-note-${request.id}`}
          value={note}
          onChange={(event) => setNote(event.target.value)}
          maxLength={300}
          placeholder={t("reviewNotePlaceholder")}
          className={`${adminInputClass} mt-2`}
        />
      </div>
      <div className="flex flex-wrap justify-end gap-2 border-t border-border pt-4">
        <Button
          type="button"
          variant="outline"
          disabled={pending}
          onClick={() => void review("REJECT")}
          className="min-h-10"
        >
          {t("rejectRequest")}
        </Button>
        <Button
          type="button"
          disabled={pending}
          onClick={() => void review("APPROVE")}
          className="min-h-10"
        >
          {pending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
          {t("approveRequest")}
        </Button>
      </div>
    </div>
  );
}

export function TopUpReview({
  initialRequests,
  locale,
}: {
  initialRequests: AdminTopUpRequest[];
  locale: string;
}) {
  const t = useTranslations("adminPanel");
  const tc = useTranslations("common");
  const tm = useTranslations("memberPanel");
  const [filter, setFilter] = useState<"pending" | "all">("pending");
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return initialRequests.filter((request) => {
      if (filter === "pending" && request.status !== "PENDING") return false;
      if (!needle) return true;
      return [
        request.requestNumber,
        request.member.memberId,
        request.member.fullName,
        request.transactionRef,
        request.method,
      ].some((value) => value.toLowerCase().includes(needle));
    });
  }, [filter, initialRequests, query]);

  if (initialRequests.length === 0) {
    return <p className="text-sm text-muted-foreground">{tc("noResults")}</p>;
  }

  return (
    <div className="space-y-4">
      <div className="glass rounded-2xl p-4">
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-2">
          <button
            type="button"
            onClick={() => setFilter("pending")}
            className={`min-h-9 shrink-0 rounded-xl border px-3 text-xs font-semibold transition-colors ${
              filter === "pending"
                ? "border-primary bg-primary/15 text-primary"
                : "border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            {t("pending")}
          </button>
          <button
            type="button"
            onClick={() => setFilter("all")}
            className={`min-h-9 shrink-0 rounded-xl border px-3 text-xs font-semibold transition-colors ${
              filter === "all"
                ? "border-primary bg-primary/15 text-primary"
                : "border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            {t("showAllRecords")}
          </button>
        </div>
        <label className="relative mt-2 block">
          <span className="sr-only">{tc("search")}</span>
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={tc("search")}
            className={`${adminInputClass} h-11 pl-10`}
          />
        </label>
      </div>

      {filtered.length === 0 ? (
        <p className="glass rounded-2xl px-5 py-10 text-center text-sm text-muted-foreground">
          {tc("noResults")}
        </p>
      ) : (
        <ul className="grid gap-3">
          {filtered.map((request) => (
            <li
              key={request.id}
              className="glass min-w-0 rounded-2xl p-4 sm:p-5"
            >
              <div className="flex min-w-0 items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-mono text-xs font-bold" translate="no">
                    {request.requestNumber}
                  </p>
                  <p className="mt-1 truncate text-sm font-semibold">
                    {request.member.fullName}{" "}
                    <span className="font-mono text-xs text-muted-foreground" translate="no">
                      {request.member.memberId}
                    </span>
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {request.method} · {formatMemberDate(new Date(request.createdAt), locale, true)}
                  </p>
                </div>
                <StatusBadge
                  tone={statusTone(request.status)}
                  label={tm(statusLabelKey(request.status))}
                />
              </div>

              <dl className="mt-4 grid grid-cols-2 gap-3 text-xs sm:grid-cols-3">
                <div>
                  <dt className="text-muted-foreground">{tc("amount")}</dt>
                  <dd className="mt-0.5 font-display font-bold tabular-nums">
                    {formatSP(BigInt(request.amountPaisa))}
                  </dd>
                </div>
                <div className="col-span-2 min-w-0 sm:col-span-1">
                  <dt className="text-muted-foreground">{tm("topUpTransactionRef")}</dt>
                  <dd className="mt-0.5 break-all font-mono" translate="no">
                    {request.transactionRef}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">{tc("status")}</dt>
                  <dd className="mt-0.5 text-muted-foreground">
                    {request.reviewedAt
                      ? formatMemberDate(new Date(request.reviewedAt), locale, true)
                      : tm("pending")}
                  </dd>
                </div>
              </dl>

              {request.note ? (
                <p className="mt-3 break-words text-xs text-muted-foreground">{request.note}</p>
              ) : null}
              <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-border pt-3">
                {request.proofImageUrl ? (
                  <a
                    href={request.proofImageUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs font-bold text-primary hover:underline"
                  >
                    {tm("topUpProof")}
                  </a>
                ) : null}
                {request.status === "PENDING" ? (
                  <AdminActionDialogButton
                    label={t("review")}
                    title={`${t("topUpRequestsTitle")} · ${request.requestNumber}`}
                    intro={t("reviewNotePlaceholder")}
                    className="ml-auto"
                  >
                    <TopUpReviewForm request={request} />
                  </AdminActionDialogButton>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
