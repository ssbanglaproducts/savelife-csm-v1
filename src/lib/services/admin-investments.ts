import { getLocale, getTranslations } from "next-intl/server";
import { adminStatusKey, formatDate, statusTone } from "@/components/admin/admin-ui";
import type { InvestmentCardRow } from "@/components/admin/investment-cards";
import { formatSP } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import { formatPercent } from "@/lib/rates";

export type InvestmentAudience = "admin" | "member";

type AuditRow = {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  createdAt: Date;
  actor: { fullName: string; memberId: string } | null;
};

/**
 * Builds the display DTO used by the investments list, the admin detail page
 * and the member detail page. Dates and money are formatted on the server so
 * no BigInt or Date crosses the client boundary.
 *
 * `audience` selects the translation namespace for status labels, and
 * `includeAudit` keeps internal audit records out of the member view.
 */
export async function getInvestmentCardRows(
  options: {
    id?: string;
    memberId?: string;
    audience?: InvestmentAudience;
    includeAudit?: boolean;
  } = {},
): Promise<InvestmentCardRow[]> {
  const { id, memberId, audience = "admin", includeAudit = true } = options;
  const [locale, ta, tm, tco] = await Promise.all([
    getLocale(),
    getTranslations("adminPanel"),
    getTranslations("memberPanel"),
    getTranslations("checkout"),
  ]);
  const tstatus = audience === "member" ? tm : ta;

  const investments = await prisma.investment.findMany({
    where: {
      ...(id ? { id } : {}),
      ...(memberId ? { memberId } : {}),
    },
    orderBy: { createdAt: "desc" },
    include: {
      member: {
        select: {
          id: true,
          memberId: true,
          fullName: true,
          email: true,
          phone: true,
          profileImage: true,
        },
      },
      settings: {
        select: {
          version: true,
          installmentDurationMonths: true,
          profitOnlyLockInMonths: true,
        },
      },
      installments: {
        orderBy: { periodNo: "asc" },
        select: {
          id: true,
          periodNo: true,
          dueDate: true,
          amountPaisa: true,
          status: true,
          paidAt: true,
        },
      },
      paymentProofs: {
        orderBy: { submittedAt: "desc" },
      },
      rewards: {
        orderBy: { createdAt: "desc" },
        include: {
          beneficiary: { select: { memberId: true, fullName: true } },
        },
      },
      profitLines: {
        orderBy: { createdAt: "desc" },
        include: {
          distribution: {
            select: {
              month: true,
              createdAt: true,
              status: true,
              profitPerThousandPaisa: true,
            },
          },
        },
      },
      ledgerEntries: {
        orderBy: { createdAt: "desc" },
        include: { installment: { select: { periodNo: true } } },
      },
      withdrawals: {
        where: { type: "PRINCIPAL" },
        orderBy: { requestedAt: "desc" },
        take: 1,
        select: {
          id: true,
          status: true,
          noticeAt: true,
          payableAt: true,
          netPaisa: true,
        },
      },
    },
  });

  const investmentIds = investments.map((investment) => investment.id);
  const installmentIds = investments.flatMap((investment) =>
    investment.installments.map((installment) => installment.id),
  );

  const audits: AuditRow[] = includeAudit
    ? await prisma.auditLog.findMany({
        where: {
          OR: [
            { entityType: "Investment", entityId: { in: investmentIds } },
            { entityType: "InvestmentInstallment", entityId: { in: installmentIds } },
          ],
        },
        orderBy: { createdAt: "desc" },
        take: 200,
        select: {
          id: true,
          action: true,
          entityType: true,
          entityId: true,
          createdAt: true,
          actor: { select: { fullName: true, memberId: true } },
        },
      })
    : [];

  const auditByEntity = new Map<string, AuditRow[]>();
  for (const entry of audits) {
    if (!entry.entityId) continue;
    const existing = auditByEntity.get(entry.entityId) ?? [];
    existing.push(entry);
    auditByEntity.set(entry.entityId, existing);
  }

  function fmt(value: Date | null | undefined): string {
    return value ? formatDate(value, locale) : "—";
  }

  function statusLabel(status: string): string {
    return status === "ACTIVE" ? tm("active") : tstatus(adminStatusKey(status));
  }

  function proofMethod(method: string): string {
    switch (method) {
      case "BKASH":
        return tco("bkash");
      case "NAGAD":
        return tco("nagad");
      case "BANK":
        return tco("bank");
      default:
        return tco("other");
    }
  }

  function ledgerType(type: string): string {
    switch (type) {
      case "INVESTMENT_PRINCIPAL":
        return tm("investmentPrincipal");
      case "INSTALLMENT_PAYMENT":
        return tm("installmentPayment");
      case "PROFIT_DISTRIBUTION":
        return tm("profitDistribution");
      case "AFFILIATE_REWARD":
        return tm("affiliateReward");
      case "PRINCIPAL_RETURN":
        return tm("principalReturn");
      case "BALANCE_TRANSFER":
        return tm("balanceTransfer");
      case "WITHDRAWAL":
        return tm("withdrawalPayout");
      case "WITHDRAWAL_FEE":
        return tm("withdrawalFee");
      case "ADMIN_ADJUSTMENT":
        return tm("adminAdjustment");
      case "ROI_COMMISSION_CREDIT":
        return tm("roiCommissionCredit");
      default:
        return type;
    }
  }

  return investments.map((investment) => {
    const settings = investment.settings;
    const durationMonths = investment.durationMonths ?? settings?.installmentDurationMonths ?? null;
    const lockInMonths = investment.lockInMonths ?? settings?.profitOnlyLockInMonths ?? null;
    const paid = investment.installments.filter(
      (installment) => installment.status === "PAID",
    ).length;
    const total = investment.installments.length;
    const ledger = investment.ledgerEntries.map((entry) => ({
      id: entry.id,
      date: fmt(entry.createdAt),
      typeLabel: ledgerType(entry.type),
      direction: tm(entry.direction === "CREDIT" ? "directionIn" : "directionOut"),
      directionType: entry.direction === "CREDIT" ? ("CREDIT" as const) : ("DEBIT" as const),
      amount: formatSP(entry.amountPaisa),
      balanceAfter: formatSP(entry.balanceAfterPaisa),
      description: entry.description || "—",
      reference:
        [entry.referenceType, entry.referenceId].filter(Boolean).join(": ") ||
        (entry.installment ? `Installment #${entry.installment.periodNo}` : "—"),
    }));

    return {
      id: investment.id,
      investmentNumber: investment.investmentNumber,
      type: investment.type,
      status: investment.status,
      statusLabel: statusLabel(investment.status),
      tone: statusTone(investment.status),
      typeLabel: investment.type === "INSTALLMENT" ? tm("installment") : tm("profitOnly"),
      amount: formatSP(investment.amountPaisa),
      monthlyInstallment: investment.monthlyInstallmentPaisa
        ? formatSP(investment.monthlyInstallmentPaisa)
        : "—",
      createdAt: fmt(investment.createdAt),
      progressLabel: total > 0 ? `${paid}/${total}` : "—",
      progress: { paid, total, percent: total > 0 ? Math.round((paid / total) * 100) : 0 },
      canReject: investment.status === "PENDING",
      hasPendingProof: investment.paymentProofs.some((proof) => proof.status === "PENDING"),
      member: {
        id: investment.member.id,
        memberId: investment.member.memberId,
        name: investment.member.fullName,
        email: investment.member.email,
        phone: investment.member.phone,
        profileImage: investment.member.profileImage,
      },
      terms: {
        remainingPrincipal: formatSP(investment.remainingPrincipalPaisa),
        durationMonths: durationMonths !== null ? String(durationMonths) : "—",
        lockInMonths: lockInMonths !== null ? String(lockInMonths) : "—",
        startDate: fmt(investment.startDate),
        lockInEndsAt: fmt(investment.lockInEndsAt),
        createdAt: fmt(investment.createdAt),
        updatedAt: fmt(investment.updatedAt),
        verifiedAt: fmt(investment.verifiedAt),
        settingsVersion:
          settings?.version !== null && settings?.version !== undefined
            ? String(settings.version)
            : "—",
      },
      principalNotice: investment.withdrawals[0]
        ? {
            id: investment.withdrawals[0].id,
            status: investment.withdrawals[0].status,
            statusLabel: statusLabel(investment.withdrawals[0].status),
            tone: statusTone(investment.withdrawals[0].status),
            noticeAt: fmt(investment.withdrawals[0].noticeAt),
            payableAt: fmt(investment.withdrawals[0].payableAt),
            amount: formatSP(investment.withdrawals[0].netPaisa),
          }
        : null,
      installments: investment.installments.map((installment) => ({
        id: installment.id,
        periodNo: installment.periodNo,
        dueDate: fmt(installment.dueDate),
        amount: formatSP(installment.amountPaisa),
        status: installment.status,
        statusLabel: statusLabel(installment.status),
        tone: statusTone(installment.status),
        paidAt: fmt(installment.paidAt),
      })),
      proofs: investment.paymentProofs.map((proof) => ({
        id: proof.id,
        status: proof.status,
        method: proofMethod(proof.method),
        transactionRef: proof.transactionRef,
        amount: formatSP(proof.amountPaisa),
        statusLabel: statusLabel(proof.status),
        tone: statusTone(proof.status),
        note: proof.note || "—",
        imageUrl: proof.imageUrl,
        submittedAt: fmt(proof.submittedAt),
        reviewedAt: fmt(proof.reviewedAt),
      })),
      rewards: investment.rewards.map((reward) => ({
        id: reward.id,
        beneficiary: `${reward.beneficiary.fullName} (${reward.beneficiary.memberId})`,
        level: reward.level,
        rate: formatPercent(reward.rateBps),
        amount: formatSP(reward.amountPaisa),
        createdAt: fmt(reward.createdAt),
      })),
      profitLines: investment.profitLines.map((line) => ({
        id: line.id,
        month: line.distribution.month,
        date: fmt(line.distribution.createdAt),
        statusLabel: statusLabel(line.distribution.status),
        eligible: formatSP(line.eligiblePaisa),
        allocated: formatSP(line.allocatedPaisa),
        rate: formatSP(line.distribution.profitPerThousandPaisa),
      })),
      ledger,
      recentLedger: ledger.slice(0, 2),
      audit: [
        ...(auditByEntity.get(investment.id) ?? []),
        ...investment.installments.flatMap(
          (installment) => auditByEntity.get(installment.id) ?? [],
        ),
      ].map((entry) => ({
        id: entry.id,
        action: entry.action,
        entityType: entry.entityType,
        actor: entry.actor?.fullName ?? entry.actor?.memberId ?? "—",
        createdAt: fmt(entry.createdAt),
      })),
    };
  });
}
