"use client";

import { useTranslations } from "next-intl";
import {
  AdminRecordCard,
  AdminRecordField,
  StatusBadge,
  adminStatusKey,
  formatDate,
  prettyJson,
  statusTone,
} from "@/components/admin/admin-ui";
import { AdminActionDialogButton } from "@/components/admin/admin-action-dialog-button";
import { WithdrawalReviewForm } from "@/components/admin/action-forms";
import { formatSP } from "@/lib/money";

export type WithdrawalRecord = {
  id: string;
  requestNumber: string;
  memberName: string;
  memberEmail: string;
  type: string;
  investmentNumber: string;
  amountPaisa: string;
  feePaisa: string;
  netPaisa: string;
  method: string;
  status: string;
  noticeAt: string | null;
  payableAt: string | null;
  requestedAt: string;
  accountDetails: unknown;
  note: string | null;
  actions: Array<"APPROVE" | "REJECT" | "PAID">;
};

export function WithdrawalRecords({
  rows,
  locale,
}: {
  rows: WithdrawalRecord[];
  locale: string;
}) {
  const t = useTranslations("adminPanel");
  const tc = useTranslations("common");

  return (
    <div className="grid gap-3">
      {rows.map((withdrawal) => {
        const noticeAt = withdrawal.noticeAt ? new Date(withdrawal.noticeAt) : null;
        const payableAt = withdrawal.payableAt ? new Date(withdrawal.payableAt) : null;
        const requestedAt = new Date(withdrawal.requestedAt);

        return (
          <AdminRecordCard
            key={withdrawal.id}
            title={withdrawal.requestNumber}
            subtitle={`${withdrawal.memberName} · ${formatDate(requestedAt, locale)}`}
            status={
              <StatusBadge
                tone={statusTone(withdrawal.status)}
                label={t(adminStatusKey(withdrawal.status))}
              />
            }
          >
            <AdminRecordField
              label={withdrawal.type === "PRINCIPAL" ? t("principalWithdrawal") : t("availableWithdrawal")}
              value={withdrawal.investmentNumber}
            />
            <AdminRecordField label={t("method")} value={withdrawal.method} />
            <AdminRecordField label={tc("amount")} value={formatSP(BigInt(withdrawal.amountPaisa))} />
            <AdminRecordField label={t("fee")} value={formatSP(BigInt(withdrawal.feePaisa))} />
            <AdminRecordField
              label={t("net")}
              value={
                <span className="text-base font-bold text-primary">
                  {formatSP(BigInt(withdrawal.netPaisa))}
                </span>
              }
              wide
            />
            <AdminRecordField
              label={t("noticeAt")}
              value={noticeAt ? formatDate(noticeAt, locale) : "—"}
            />
            <AdminRecordField
              label={t("payableAt")}
              value={payableAt ? formatDate(payableAt, locale) : "—"}
            />
            <div className="col-span-2 flex flex-wrap gap-2 pt-1">
              <AdminActionDialogButton
                label={withdrawal.actions.length > 0 ? t("review") : tc("details")}
                title={`${t("withdrawalsTitle")} · ${withdrawal.requestNumber}`}
                intro={withdrawal.memberEmail}
                className="flex-1"
              >
                <div className="space-y-5">
                  <div>
                    <p className="text-xs font-bold text-muted-foreground">
                      {t("member")} · {t("method")}
                    </p>
                    <p className="mt-1 break-words text-sm font-semibold">
                      {withdrawal.memberName} · {withdrawal.method}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-muted-foreground">{tc("details")}</p>
                    <pre className="mt-1 max-h-52 overflow-auto whitespace-pre-wrap break-words rounded-xl border border-border bg-muted/30 p-3 font-mono text-xs text-muted-foreground">
                      {prettyJson(withdrawal.accountDetails)}
                    </pre>
                    {withdrawal.note ? (
                      <p className="mt-2 break-words text-xs text-muted-foreground">
                        {withdrawal.note}
                      </p>
                    ) : null}
                    {withdrawal.type === "PRINCIPAL" ? (
                      <p className="mt-2 text-xs text-muted-foreground">
                        {t("principalNoticeHint")}
                      </p>
                    ) : null}
                  </div>
                  {withdrawal.actions.length > 0 ? (
                    <div className="border-t border-border pt-4">
                      <WithdrawalReviewForm
                        withdrawalId={withdrawal.id}
                        actions={withdrawal.actions}
                      />
                    </div>
                  ) : null}
                </div>
              </AdminActionDialogButton>
            </div>
          </AdminRecordCard>
        );
      })}
    </div>
  );
}
