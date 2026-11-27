import type { Prisma, PrismaClient } from "../../generated/prisma/client";
import { requireMemberId } from "../member-id";
import { parseDistributionMonth } from "./date";

/**
 * Read model for the admin affiliate-commission log. It never posts or edits
 * rewards. Both the recipient and the investment owner must be real members so
 * admin/staff accounts cannot appear in member-derived financial history.
 */

export const AFFILIATE_HISTORY_PAGE_SIZE = 20;

export interface AffiliateCommissionFilters {
  readonly q?: string;
  readonly level?: number;
  readonly month?: string;
  readonly page?: number;
  readonly pageSize?: number;
}

export interface AffiliateCommissionRow {
  readonly id: string;
  readonly createdAt: Date;
  readonly level: number;
  readonly rateBps: number;
  readonly amountPaisa: bigint;
  readonly beneficiary: {
    readonly memberId: string;
    readonly fullName: string;
  };
  readonly sourceMember: {
    readonly memberId: string;
    readonly fullName: string;
  };
  readonly investmentNumber: string;
}

export interface AffiliateCommissionResult {
  readonly rows: readonly AffiliateCommissionRow[];
  readonly total: number;
  readonly totalPaisa: bigint;
  readonly page: number;
  readonly pageSize: number;
  readonly totalPages: number;
}

function positiveInt(value: number | undefined, fallback: number, max: number): number {
  if (!Number.isInteger(value) || !value || value < 1) return fallback;
  return Math.min(value, max);
}

export async function loadAffiliateCommissionHistory(
  client: PrismaClient,
  filters: AffiliateCommissionFilters = {},
): Promise<AffiliateCommissionResult> {
  const page = positiveInt(filters.page, 1, 100_000);
  const pageSize = positiveInt(filters.pageSize, AFFILIATE_HISTORY_PAGE_SIZE, 100);
  const search = filters.q?.trim() ?? "";
  const where: Prisma.AffiliateRewardWhereInput = {
    beneficiary: { role: "MEMBER" },
    investment: { member: { role: "MEMBER" } },
  };

  if (search) {
    where.OR = [
      { beneficiary: { memberId: { contains: search, mode: "insensitive" } } },
      { beneficiary: { fullName: { contains: search, mode: "insensitive" } } },
      { investment: { member: { memberId: { contains: search, mode: "insensitive" } } } },
      { investment: { member: { fullName: { contains: search, mode: "insensitive" } } } },
      { investment: { investmentNumber: { contains: search, mode: "insensitive" } } },
    ];
  }
  if (filters.level && filters.level >= 1 && filters.level <= 10) {
    where.level = filters.level;
  }
  if (filters.month?.trim()) {
    try {
      const { year, monthIndex } = parseDistributionMonth(filters.month.trim());
      where.createdAt = {
        gte: new Date(Date.UTC(year, monthIndex, 1)),
        lt: new Date(Date.UTC(year, monthIndex + 1, 1)),
      };
    } catch {
      // Invalid month input is ignored, matching the admin page parser.
    }
  }

  const [rows, total, aggregate] = await Promise.all([
    client.affiliateReward.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        beneficiary: { select: { memberId: true, fullName: true } },
        investment: {
          select: {
            investmentNumber: true,
            member: { select: { memberId: true, fullName: true } },
          },
        },
      },
    }),
    client.affiliateReward.count({ where }),
    client.affiliateReward.aggregate({ where, _sum: { amountPaisa: true } }),
  ]);

  return {
    rows: rows.map((row) => ({
      id: row.id,
      createdAt: row.createdAt,
      level: row.level,
      rateBps: row.rateBps,
      amountPaisa: row.amountPaisa,
      beneficiary: {
        memberId: requireMemberId(row.beneficiary),
        fullName: row.beneficiary.fullName,
      },
      sourceMember: {
        memberId: requireMemberId(row.investment.member),
        fullName: row.investment.member.fullName,
      },
      investmentNumber: row.investment.investmentNumber,
    })),
    total,
    totalPaisa: aggregate._sum.amountPaisa ?? 0n,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}
