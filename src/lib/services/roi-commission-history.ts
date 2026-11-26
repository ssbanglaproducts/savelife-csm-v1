import type { Prisma, PrismaClient } from "../../generated/prisma/client";
import { DEFAULT_ROI_RATE_CONFIG, parseRoiRatesSetting } from "./roi-commission";

/**
 * Read models for the ROI Commission admin tabs. These are deliberately kept
 * separate from the posting service so historical snapshots are never mutated.
 */

export const ROI_HISTORY_PAGE_SIZE = 20;

export interface RoiHistoryFilters {
  readonly q?: string;
  readonly level?: number;
  readonly month?: string;
  readonly page?: number;
  readonly pageSize?: number;
}

export interface RoiOverviewRow {
  readonly id: string;
  readonly distributionId: string;
  readonly month: string;
  readonly postedAt: Date;
  readonly ratesBps: readonly number[];
  readonly totalBasisPaisa: bigint;
  readonly totalCommissionPaisa: bigint;
  readonly recipientCount: number;
  readonly lineCount: number;
  readonly originalProfitPaisa: bigint;
}

export interface RoiHistoryRow {
  readonly id: string;
  readonly level: number;
  readonly rateBps: number;
  readonly basisPaisa: bigint;
  readonly amountPaisa: bigint;
  readonly createdAt: Date;
  readonly month: string;
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

export interface RoiHistoryResult {
  readonly rows: readonly RoiHistoryRow[];
  readonly total: number;
  readonly page: number;
  readonly pageSize: number;
  readonly totalPages: number;
}

export async function loadRoiOverview(
  client: PrismaClient | Prisma.TransactionClient,
): Promise<readonly RoiOverviewRow[]> {
  const rows = await client.roiCommissionDistribution.findMany({
    orderBy: [{ postedAt: "desc" }, { createdAt: "desc" }],
    include: {
      distribution: { select: { distributablePaisa: true } },
      _count: { select: { lines: true } },
    },
  });

  return rows.map((row) => ({
    id: row.id,
    distributionId: row.distributionId,
    month: row.month,
    postedAt: row.postedAt,
    ratesBps: parseRoiRatesSetting(row.ratesBps) ?? DEFAULT_ROI_RATE_CONFIG.ratesBps,
    totalBasisPaisa: row.totalBasisPaisa,
    totalCommissionPaisa: row.totalCommissionPaisa,
    recipientCount: row.recipientCount,
    lineCount: row._count.lines,
    originalProfitPaisa: row.distribution.distributablePaisa,
  }));
}

function positiveInt(value: number | undefined, fallback: number, max: number): number {
  if (!Number.isInteger(value) || !value || value < 1) return fallback;
  return Math.min(value, max);
}

export async function loadRoiSponsorHistory(
  client: PrismaClient | Prisma.TransactionClient,
  filters: RoiHistoryFilters = {},
): Promise<RoiHistoryResult> {
  const page = positiveInt(filters.page, 1, 100_000);
  const pageSize = positiveInt(filters.pageSize, ROI_HISTORY_PAGE_SIZE, 100);
  const search = filters.q?.trim() ?? "";
  const where: Prisma.RoiCommissionLineWhereInput = {};

  if (search) {
    where.OR = [
      { beneficiary: { memberId: { contains: search, mode: "insensitive" } } },
      { beneficiary: { fullName: { contains: search, mode: "insensitive" } } },
      { sourceMember: { memberId: { contains: search, mode: "insensitive" } } },
      { sourceMember: { fullName: { contains: search, mode: "insensitive" } } },
      { sourceInvestment: { investmentNumber: { contains: search, mode: "insensitive" } } },
    ];
  }
  if (filters.level && filters.level >= 1 && filters.level <= 5) {
    where.level = filters.level;
  }
  if (filters.month?.trim()) {
    where.distribution = { month: filters.month.trim() };
  }

  const [rows, total] = await Promise.all([
    client.roiCommissionLine.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        beneficiary: { select: { memberId: true, fullName: true } },
        sourceMember: { select: { memberId: true, fullName: true } },
        sourceInvestment: { select: { investmentNumber: true } },
        distribution: { select: { month: true } },
      },
    }),
    client.roiCommissionLine.count({ where }),
  ]);

  return {
    rows: rows.map((row) => ({
      id: row.id,
      level: row.level,
      rateBps: row.rateBps,
      basisPaisa: row.basisPaisa,
      amountPaisa: row.amountPaisa,
      createdAt: row.createdAt,
      month: row.distribution.month,
      beneficiary: {
        memberId: row.beneficiary.memberId,
        fullName: row.beneficiary.fullName,
      },
      sourceMember: {
        memberId: row.sourceMember.memberId,
        fullName: row.sourceMember.fullName,
      },
      investmentNumber: row.sourceInvestment.investmentNumber,
    })),
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}
