"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatMemberDate } from "@/components/member/format-date";
import { statusLabelKey } from "@/components/member/status-labels";
import { formatSP } from "@/lib/money";
import { adminInputClass } from "@/components/admin/admin-ui";
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
  const { pending, run } = useAdminAction();
  const [notes, setNotes] = useState<Record<string, string>>({});

  async function review(request: AdminTopUpRequest, action: "APPROVE" | "REJECT") {
    const ok = await run("/api/admin/wallet-topups", "PATCH", {
      requestId: request.id,
      action,
      note: notes[request.id] ?? "",
    });
    if (ok) {
      setNotes((current) => ({ ...current, [request.id]: "" }));
    }
  }

  if (initialRequests.length === 0) {
    return <p className="text-sm text-muted-foreground">{tc("noResults")}</p>;
  }

  return (
    <ul className="space-y-4">
      {initialRequests.map((request) => (
        <li key={request.id} className="rounded-2xl border border-border bg-[var(--glass-strong)] p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="truncate font-mono text-xs font-bold" translate="no">
                {request.requestNumber}
              </p>
              <p className="mt-1 text-sm font-semibold">
                {request.member.fullName}{" "}
                <span className="font-mono text-xs text-muted-foreground" translate="no">
                  {request.member.memberId}
                </span>
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {request.method} · {formatMemberDate(new Date(request.createdAt), locale, true)}
              </p>
            </div>
            <span className="rounded-full bg-primary/10 px-3 py-1 text-[11px] font-bold text-primary">
              {tm(statusLabelKey(request.status))}
            </span>
          </div>

          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-xs text-muted-foreground">{tc("amount")}</dt>
              <dd className="font-display font-bold tabular-nums">
                {formatSP(BigInt(request.amountPaisa))}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">{tm("topUpTransactionRef")}</dt>
              <dd className="break-all font-mono text-xs" translate="no">
                {request.transactionRef}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">{tc("status")}</dt>
              <dd className="text-xs text-muted-foreground">
                {request.reviewedAt
                  ? formatMemberDate(new Date(request.reviewedAt), locale, true)
                  : tm("pending")}
              </dd>
            </div>
          </dl>

          {request.note ? (
            <p className="mt-3 text-xs text-muted-foreground">{request.note}</p>
          ) : null}
          {request.proofImageUrl ? (
            <a
              href={request.proofImageUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-3 inline-block text-xs font-bold text-primary hover:underline"
            >
              {tm("topUpProof")}
            </a>
          ) : null}

          {request.status === "PENDING" ? (
            <div className="mt-5 border-t border-border pt-4">
              <input
                value={notes[request.id] ?? ""}
                onChange={(event) =>
                  setNotes((current) => ({ ...current, [request.id]: event.target.value }))
                }
                maxLength={300}
                placeholder={t("reviewNotePlaceholder")}
                aria-label={t("reviewNotePlaceholder")}
                className={adminInputClass}
              />
              <div className="mt-3 flex flex-wrap justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={pending}
                  onClick={() => void review(request, "REJECT")}
                >
                  {t("rejectRequest")}
                </Button>
                <Button
                  type="button"
                  disabled={pending}
                  onClick={() => void review(request, "APPROVE")}
                >
                  {pending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
                  {t("approveRequest")}
                </Button>
              </div>
            </div>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
