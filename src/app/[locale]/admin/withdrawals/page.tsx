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
                  <WithdrawalReviewForm
                    withdrawalId={withdrawal.id}
                    actions={
                      withdrawal.status === "PENDING"
                        ? withdrawal.type === "PRINCIPAL"
                          ? ["REJECT"]
                          : ["APPROVE", "REJECT"]
                        : withdrawal.status === "APPROVED"
                          ? ["PAID"]
                          : []
                    }
                  />
                </td>
              </tr>
            ))}
          </AdminTable>
        )}
      </AdminSection>
    </div>
  );
}
