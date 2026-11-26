import type { Prisma, PrismaClient } from "../../generated/prisma/client";
import {
  LedgerEntryType as LedgerType,
  WalletCategory as Category,
} from "../../generated/prisma/enums";
import { applyBps, sumPaisa, type Paisa } from "../money";
import { invalidInput } from "./errors";
import {
  LedgerDirectionValues as Direction,
  adjustWalletField,
  makeKey,
  recordLedgerEntry,
} from "./ledger";

/**
 * ROI commission is an ADDITIONAL payment. It is derived from a profit
 * distribution line but never debits the original member's Profit wallet or
 * the distributable pool.
 */

export const ROI_LEVEL_COUNT = 5;
export const DEFAULT_ROI_RATES_BPS = [200, 50, 50, 30, 20] as const; // 2%, .5%, .5%, .3%, .2%
export const ROI_RATES_SETTING_KEY = "roiCommission.ratesBps";

export interface RoiRateConfig {
  readonly ratesBps: readonly number[];
}

export const DEFAULT_ROI_RATE_CONFIG: RoiRateConfig = {
  ratesBps: [...DEFAULT_ROI_RATES_BPS],
};

export interface RoiSponsorCandidate {
  /** Internal member id of the sponsor, not the public member number. */
  readonly beneficiaryId: string;
  readonly level: number;
}

export interface RoiCommissionCalculation {
  readonly level: number;
  readonly beneficiaryId: string;
  readonly rateBps: number;
  readonly amountPaisa: Paisa;
}

export function normalizeRoiRatesBps(value: readonly number[]): readonly number[] {
  if (value.length !== ROI_LEVEL_COUNT) {
    throw invalidInput(`ROI commission requires exactly ${ROI_LEVEL_COUNT} rates`);
  }
  for (const rate of value) {
    if (!Number.isInteger(rate) || rate < 0 || rate > 10_000) {
      throw invalidInput(`Invalid ROI commission rate in basis points: ${rate}`);
    }
  }
  return [...value];
}

export function parseRoiRatesSetting(value: unknown): readonly number[] | null {
  if (!Array.isArray(value) || !value.every((item) => typeof item === "number")) return null;
  try {
    return normalizeRoiRatesBps(value as number[]);
  } catch {
    return null;
  }
}

export async function loadRoiRateConfig(
  client: PrismaClient | Prisma.TransactionClient,
): Promise<RoiRateConfig> {
  const setting = await client.systemSetting.findUnique({
    where: { key: ROI_RATES_SETTING_KEY },
  });
  const rates = setting ? parseRoiRatesSetting(setting.value) : null;
  return { ratesBps: rates ?? [...DEFAULT_ROI_RATES_BPS] };
}

export async function saveRoiRateConfig(
  client: PrismaClient,
  ratesBps: readonly number[],
): Promise<readonly number[]> {
  const normalized = normalizeRoiRatesBps(ratesBps);
  const value = [...normalized] as unknown as Prisma.InputJsonValue;
  await client.systemSetting.upsert({
    where: { key: ROI_RATES_SETTING_KEY },
    create: { key: ROI_RATES_SETTING_KEY, value },
    update: { value },
  });
  return normalized;
}

export function totalRoiRateBps(config: RoiRateConfig = DEFAULT_ROI_RATE_CONFIG): number {
  return normalizeRoiRatesBps(config.ratesBps).reduce((total, rate) => total + rate, 0);
}

/** Minimal member snapshot used to walk the permanent sponsor chain. */
export interface RoiSponsorNode {
  readonly id: string;
  readonly memberId: string;
  readonly fullName: string;
  readonly sponsorId: string | null;
}

export async function loadRoiSponsorIndex(
  client: PrismaClient | Prisma.TransactionClient,
): Promise<Map<string, RoiSponsorNode>> {
  const members = await client.member.findMany({
    select: { id: true, memberId: true, fullName: true, sponsorId: true },
  });
  return new Map(members.map((member) => [member.id, member] as const));
}

/**
 * Walks sponsorId only, one level at a time. Placement relationships are
 * deliberately never read. A cycle stops the walk; a missing level stays
 * missing and no deeper sponsor is promoted into it.
 */
export function resolveSponsorChain(
  sourceMemberId: string,
  index: ReadonlyMap<string, RoiSponsorNode>,
): readonly RoiSponsorCandidate[] {
  const sponsors: RoiSponsorCandidate[] = [];
  const visited = new Set<string>([sourceMemberId]);
  let current = index.get(sourceMemberId);

  for (let level = 1; level <= ROI_LEVEL_COUNT && current?.sponsorId; level += 1) {
    const sponsorId = current.sponsorId;
    if (visited.has(sponsorId)) break;
    visited.add(sponsorId);
    sponsors.push({ beneficiaryId: sponsorId, level });
    current = index.get(sponsorId);
  }

  return sponsors;
}

export function calculateRoiCommissions(
  basisPaisa: Paisa,
  sponsors: readonly RoiSponsorCandidate[],
  config: RoiRateConfig = DEFAULT_ROI_RATE_CONFIG,
): readonly RoiCommissionCalculation[] {
  if (basisPaisa < 0n) throw invalidInput("ROI commission basis cannot be negative");

  const rates = normalizeRoiRatesBps(config.ratesBps);
  const calculations: RoiCommissionCalculation[] = [];

  for (let level = 1; level <= rates.length; level += 1) {
    const sponsor = sponsors.find((candidate) => candidate.level === level);
    if (!sponsor) continue;
    const rateBps = rates[level - 1] ?? 0;
    const amountPaisa = applyBps(basisPaisa, rateBps);
    // A zero-rate level has no payment and therefore no ledger entry.
    if (amountPaisa <= 0n) continue;
    calculations.push({ level, beneficiaryId: sponsor.beneficiaryId, rateBps, amountPaisa });
  }

  return calculations;
}

export function totalRoiCommissionPaisa(
  calculations: readonly RoiCommissionCalculation[],
): Paisa {
  return sumPaisa(calculations.map((calculation) => calculation.amountPaisa));
}

export interface RoiCommissionSourceLine {
  /** The profit line that funds these sponsor payments. */
  readonly profitDistributionLineId: string;
  readonly sourceMemberId: string;
  readonly investmentId: string;
  readonly basisPaisa: Paisa;
}

export interface RoiCommissionPostInput {
  readonly distributionId: string;
  readonly month: string;
  readonly lines: readonly RoiCommissionSourceLine[];
  readonly sponsorIndex: ReadonlyMap<string, RoiSponsorNode>;
  readonly config: RoiRateConfig;
  readonly createdBy: string;
  readonly idempotencyPrefix?: string;
}

export interface RoiCommissionPostResult {
  readonly applied: true;
  readonly distributionId: string;
  readonly totalBasisPaisa: Paisa;
  readonly totalCommissionPaisa: Paisa;
  readonly recipientCount: number;
  readonly ledgerEntryIds: readonly string[];
}

/**
 * Posts all sponsor commissions for a profit distribution. The caller runs
 * this inside the same transaction as the original profit credits, so a
 * failure rolls back both sides and no commission can exist without its basis.
 */
export async function postRoiCommissions(
  tx: Prisma.TransactionClient,
  input: RoiCommissionPostInput,
): Promise<RoiCommissionPostResult> {
  const rates = normalizeRoiRatesBps(input.config.ratesBps);
  const planned: Array<{
    source: RoiCommissionSourceLine;
    calculation: RoiCommissionCalculation;
  }> = [];
  const beneficiaries = new Set<string>();
  let totalBasisPaisa = 0n;
  let totalCommissionPaisa = 0n;

  for (const source of input.lines) {
    const sponsors = resolveSponsorChain(source.sourceMemberId, input.sponsorIndex);
    const calculations = calculateRoiCommissions(source.basisPaisa, sponsors, {
      ratesBps: rates,
    });
    totalBasisPaisa += source.basisPaisa;
    for (const calculation of calculations) {
      beneficiaries.add(calculation.beneficiaryId);
      totalCommissionPaisa += calculation.amountPaisa;
      planned.push({ source, calculation });
    }
  }

  const runRecord = await tx.roiCommissionDistribution.create({
    data: {
      distributionId: input.distributionId,
      month: input.month,
      ratesBps: [...rates],
      totalBasisPaisa,
      totalCommissionPaisa,
      recipientCount: beneficiaries.size,
    },
    select: { id: true },
  });

  const ledgerEntryIds: string[] = [];
  const prefix = input.idempotencyPrefix ?? "csm";

  for (const { source, calculation } of planned) {
    const lineId = makeKey(
      "roi-line",
      input.distributionId,
      source.investmentId,
      String(calculation.level),
    );
    const walletIdKey = makeKey(
      prefix,
      "roi-commission",
      input.distributionId,
      source.investmentId,
      String(calculation.level),
    );

    await tx.wallet.upsert({
      where: { memberId: calculation.beneficiaryId },
      create: { memberId: calculation.beneficiaryId },
      update: {},
    });

    const adjusted = await adjustWalletField(
      tx,
      calculation.beneficiaryId,
      "roiPaisa",
      calculation.amountPaisa,
      Direction.CREDIT,
    );

    const ledger = await recordLedgerEntry(tx, {
      id: makeKey("roi-ledger", walletIdKey),
      walletId: adjusted.walletId,
      memberId: calculation.beneficiaryId,
      category: Category.ROI_COMMISSION,
      direction: Direction.CREDIT,
      amountPaisa: calculation.amountPaisa,
      balanceAfterPaisa: adjusted.balanceAfterPaisa,
      type: LedgerType.ROI_COMMISSION_CREDIT,
      idempotencyKey: walletIdKey,
      referenceType: "RoiCommissionLine",
      referenceId: lineId,
      description: `ROI commission level ${calculation.level}`,
      createdBy: input.createdBy,
    });

    await tx.roiCommissionLine.create({
      data: {
        id: lineId,
        distributionId: runRecord.id,
        sourceMemberId: source.sourceMemberId,
        sourceInvestmentId: source.investmentId,
        beneficiaryId: calculation.beneficiaryId,
        level: calculation.level,
        rateBps: calculation.rateBps,
        basisPaisa: source.basisPaisa,
        amountPaisa: calculation.amountPaisa,
        ledgerEntryId: ledger.id,
      },
    });
    ledgerEntryIds.push(ledger.id);
  }

  return {
    applied: true,
    distributionId: runRecord.id,
    totalBasisPaisa,
    totalCommissionPaisa,
    recipientCount: beneficiaries.size,
    ledgerEntryIds,
  };
}
