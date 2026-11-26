import { getLocale, getTranslations } from "next-intl/server";
import { Wallet } from "lucide-react";
import { auth } from "@/auth";
import { redirect } from "@/i18n/navigation";
import {
  AdminPageIntro,
  AdminSection,
  AdminTable,
  EmptyState,
  StatusBadge,
  adminStatusKey,
  formatDate,
  prettyJson,
  statusTone,
} from "@/components/admin/admin-ui";
import { WithdrawalReviewForm } from "@/components/admin/action-forms";
import { AdminActionDialogButton } from "@/components/admin/admin-action-dialog-button";
import { WithdrawalRecords, type WithdrawalRecord } from "@/components/admin/withdrawal-records";
import { formatSP } from "@/lib/money";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function AdminWithdrawalsPage() {
  const [session, locale, tn, ta, tc] = await Promise.all([
    auth(),
    getLocale(),
    getTranslations("nav"),
    getTranslations("adminPanel"),
    getTranslations("common"),
  ]);
  if (session?.user?.role !== "ADMIN") redirect({ href: "/login", locale });

  const withdrawals = await prisma.withdrawal.findMany({
    orderBy: { requestedAt: "desc" },
    include: {
      member: { select: { fullName: true, email: true } },
      investment: { select: { investmentNumber: true } },
    },
  });

  const actionsFor = (withdrawal: (typeof withdrawals)[number]) =>
    withdrawal.status === "PENDING"
      ? withdrawal.type === "PRINCIPAL"
        ? (["REJECT"] as const)
        : (["APPROVE", "REJECT"] as const)
      : withdrawal.status === "APPROVED"
        ? (["PAID"] as const)
        : ([] as const);

  const mobileRows: WithdrawalRecord[] = withdrawals.map((withdrawal) => ({
    id: withdrawal.id,
    requestNumber: withdrawal.requestNumber,
    memberName: withdrawal.member.fullName,
    memberEmail: withdrawal.member.email,
    type: withdrawal.type,
    investmentNumber: withdrawal.investment?.investmentNumber ?? "—",
    amountPaisa: withdrawal.amountPaisa.toString(),
    feePaisa: withdrawal.feePaisa.toString(),
    netPaisa: withdrawal.netPaisa.toString(),
    method: withdrawal.method,
    status: withdrawal.status,
    noticeAt: withdrawal.noticeAt?.toISOString() ?? null,
    payableAt: withdrawal.payableAt?.toISOString() ?? null,
    requestedAt: withdrawal.requestedAt.toISOString(),
    accountDetails: withdrawal.accountDetails,
    note: withdrawal.note,
    actions: [...actionsFor(withdrawal)],
  }));

  return (
    <div className="space-y-8 animate-rise">
      <AdminPageIntro
        eyebrow={tn("admin")}
        title={ta("withdrawalsTitle")}
        intro={ta("withdrawalsIntro")}
        icon={<Wallet className="size-3.5" aria-hidden="true" />}
      />
      <AdminSection id="withdrawals" title={ta("overview")}>
        {withdrawals.length === 0 ? (
          <EmptyState message={ta("noWithdrawals")} />
        ) : (
          <AdminTable
            caption={ta("withdrawalsTitle")}
            headers={[
              ta("requestNumber"),
              ta("member"),
              ta("withdrawalType"),
              ta("investmentNumber"),
              tc("amount"),
              ta("fee"),
              ta("net"),
              ta("method"),
              tc("status"),
              ta("noticeAt"),
              ta("payableAt"),
              tc("date"),
              tc("details"),
              ta("action"),
            ]}
            mobile={<WithdrawalRecords rows={mobileRows} locale={locale} />}
          >
            {withdrawals.map((withdrawal) => (
              <tr key={withdrawal.id} className="align-top">
                <td className="whitespace-nowrap px-4 py-3 font-mono text-xs">
                  {withdrawal.requestNumber}
                </td>
                <td className="min-w-[150px] px-4 py-3">
                  <span className="block font-semibold">{withdrawal.member.fullName}</span>
                  <span className="block break-all text-xs text-muted-foreground">
                    {withdrawal.member.email}
                  </span>
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-xs">
                  {withdrawal.type === "PRINCIPAL"
                    ? ta("principalWithdrawal")
                    : ta("availableWithdrawal")}
                </td>
                <td className="whitespace-nowrap px-4 py-3 font-mono text-xs">
                  {withdrawal.investment?.investmentNumber ?? "—"}
                </td>
                <td className="whitespace-nowrap px-4 py-3 font-semibold tabular-nums">
                  {formatSP(withdrawal.amountPaisa)}
                </td>
                <td className="whitespace-nowrap px-4 py-3 tabular-nums">
                  {formatSP(withdrawal.feePaisa)}
                </td>
                <td className="whitespace-nowrap px-4 py-3 font-semibold tabular-nums">
                  {formatSP(withdrawal.netPaisa)}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-xs">{withdrawal.method}</td>
                <td className="px-4 py-3">
                  <StatusBadge
                    tone={statusTone(withdrawal.status)}
                    label={ta(adminStatusKey(withdrawal.status))}
                  />
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground">
                  {withdrawal.noticeAt ? formatDate(withdrawal.noticeAt, locale) : "—"}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground">
                  {withdrawal.payableAt ? formatDate(withdrawal.payableAt, locale) : "—"}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground">
                  {formatDate(withdrawal.requestedAt, locale)}
                </td>
                <td className="min-w-[200px] px-4 py-3">
                  <pre className="max-w-[240px] overflow-x-auto whitespace-pre-wrap break-words font-mono text-xs text-muted-foreground">
                    {prettyJson(withdrawal.accountDetails)}
                  </pre>
                  {withdrawal.note ? (
                    <p className="mt-2 break-words text-xs text-muted-foreground">
                      {withdrawal.note}
                    </p>
                  ) : null}
                  {withdrawal.type === "PRINCIPAL" ? (
                    <p className="mt-2 text-xs text-muted-foreground">
                      {ta("principalNoticeHint")}
                    </p>
                  ) : null}
                </td>
                <td className="px-4 py-3">
                  <AdminActionDialogButton
                    label={actionsFor(withdrawal).length > 0 ? ta("review") : tc("details")}
                    title={`${ta("withdrawalsTitle")} · ${withdrawal.requestNumber}`}
                    intro={withdrawal.member.email}
                  >
                    <div className="space-y-5">
                      <div>
                        <p className="text-xs font-bold text-muted-foreground">
                          {ta("member")} · {ta("method")}
                        </p>
                        <p className="mt-1 break-words text-sm font-semibold">
                          {withdrawal.member.fullName} · {withdrawal.method}
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
                            {ta("principalNoticeHint")}
                          </p>
                        ) : null}
                      </div>
                      {actionsFor(withdrawal).length > 0 ? (
                        <div className="border-t border-border pt-4">
                          <WithdrawalReviewForm
                            withdrawalId={withdrawal.id}
                            actions={[...actionsFor(withdrawal)]}
                          />
                        </div>
                      ) : null}
                    </div>
                  </AdminActionDialogButton>
                </td>
              </tr>
            ))}
          </AdminTable>
        )}
      </AdminSection>
    </div>
  );
}
