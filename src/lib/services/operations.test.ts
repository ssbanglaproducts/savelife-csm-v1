import { describe, expect, it } from "vitest";
import type { PrismaClient } from "../../generated/prisma/client";
import { spToPaisa } from "../money";
import { calculatePrincipalPayableDate } from "./maturity";
import {
  DEFAULT_ROI_RATE_CONFIG,
  loadRoiSponsorIndex,
  postRoiCommissions,
} from "./roi-commission";
import {
  completePrincipalWithdrawal,
  createPrincipalWithdrawalNotice,
  createWithdrawalRequest,
  creditAffiliateRewardsForInvestment,
  creditDueInstallments,
  payDuePrincipalWithdrawals,
  postProfitDistribution,
  reverseInstallmentCredit,
  transferBalanceToAvailable,
} from "./operations";

type WalletRecord = {
  id: string;
  memberId: string;
  availablePaisa: bigint;
  pendingPaisa: bigint;
  investmentPaisa: bigint;
  profitPaisa: bigint;
  affiliatePaisa: bigint;
  rankRewardPaisa: bigint;
  salaryPaisa: bigint;
  roiPaisa: bigint;
};

type LedgerRecord = {
  id: string;
  walletId: string;
  memberId: string;
  amountPaisa: bigint;
  idempotencyKey: string;
  installmentId: string | null;
  investmentId: string | null;
  category: string;
  direction: string;
  type: string;
};

type DistributionRecord = {
  id: string;
  month: string;
  distributablePaisa: bigint;
  totalEligiblePaisa: bigint;
  profitPerThousandPaisa: bigint;
  status: string;
};

type InstallmentRecord = {
  id: string;
  investmentId: string;
  memberId: string;
  periodNo: number;
  dueDate: Date;
  amountPaisa: bigint;
  status: string;
  paidAt: Date | null;
};

type InvestmentRecord = {
  id: string;
  memberId: string;
  amountPaisa: bigint;
  remainingPrincipalPaisa: bigint;
  type: string;
  status: string;
  lockInEndsAt: Date | null;
  startDate: Date | null;
  lockInMonths: number | null;
  createdAt: Date;
};

type WithdrawalRecord = {
  id: string;
  requestNumber: string;
  memberId: string;
  type: string;
  investmentId: string | null;
  amountPaisa: bigint;
  feePaisa: bigint;
  netPaisa: bigint;
  status: string;
  noticeAt: Date | null;
  payableAt: Date | null;
  processedBy: string | null;
  processedAt: Date | null;
};

type Data = Record<string, unknown>;

function uniqueViolation(): Error & { code: string } {
  return Object.assign(new Error("unique violation"), { code: "P2002" });
}

function applyUpdate(record: object, data: Data): void {
  const target = record as Data;
  for (const [field, value] of Object.entries(data)) {
    if (typeof value === "object" && value !== null && !(value instanceof Date)) {
      const operation = value as Data;
      const current = target[field];
      if (typeof current === "bigint" && typeof operation.increment === "bigint") {
        target[field] = current + operation.increment;
      } else if (typeof current === "bigint" && typeof operation.decrement === "bigint") {
        target[field] = current - operation.decrement;
      } else {
        target[field] = value;
      }
    } else {
      target[field] = value;
    }
  }
}

function makeWallet(memberId: string, values: Partial<WalletRecord> = {}): WalletRecord {
  return {
    id: `wallet-${memberId}`,
    memberId,
    availablePaisa: 0n,
    pendingPaisa: 0n,
    investmentPaisa: 0n,
    profitPaisa: 0n,
    affiliatePaisa: 0n,
    rankRewardPaisa: 0n,
    salaryPaisa: 0n,
    roiPaisa: 0n,
    ...values,
  };
}

/** Minimal in-memory stand-in: exercises real service code without a database. */
class FakePrisma {
  wallets: WalletRecord[] = [];
  ledgerEntries: LedgerRecord[] = [];
  distributions: DistributionRecord[] = [];
  installments: InstallmentRecord[] = [];
  investments: InvestmentRecord[] = [];
  withdrawals: WithdrawalRecord[] = [];
  rewards: Array<{
    id: string;
    investmentId: string;
    beneficiaryId: string;
    level: number;
  }> = [];
  audits: Array<Data & { id: string }> = [];
  private sequence = 0;

  private nextId(prefix: string): string {
    this.sequence += 1;
    return `${prefix}-${this.sequence}`;
  }

  asClient(): PrismaClient {
    return this as unknown as PrismaClient;
  }

  $transaction<T>(callback: (tx: PrismaClient) => Promise<T>): Promise<T> {
    // Emulates database transaction rollback for the atomicity tests.
    const snapshot = {
      // Wallet balances are mutated in place, so the snapshot needs copies.
      wallets: this.wallets.map((item) => ({ ...item })),
      ledgerEntries: this.ledgerEntries.map((item) => ({ ...item })),
      distributions: this.distributions.map((item) => ({ ...item })),
      installments: this.installments.map((item) => ({ ...item })),
      investments: this.investments.map((item) => ({ ...item })),
      withdrawals: this.withdrawals.map((item) => ({ ...item })),
      rewards: this.rewards.map((item) => ({ ...item })),
      audits: this.audits.map((item) => ({ ...item })),
      roiDistributions: this.roiDistributions.map((item) => ({ ...item })),
      roiLines: this.roiLines.map((item) => ({ ...item })),
    };
    return callback(this.asClient()).catch((error: unknown) => {
      this.wallets = snapshot.wallets;
      this.ledgerEntries = snapshot.ledgerEntries;
      this.distributions = snapshot.distributions;
      this.installments = snapshot.installments;
      this.investments = snapshot.investments;
      this.withdrawals = snapshot.withdrawals;
      this.rewards = snapshot.rewards;
      this.audits = snapshot.audits;
      this.roiDistributions = snapshot.roiDistributions;
      this.roiLines = snapshot.roiLines;
      throw error;
    });
  }

  wallet = {
    update: async ({ where, data }: { where: { memberId: string }; data: Data }) => {
      const found = this.wallets.find((item) => item.memberId === where.memberId);
      if (!found) throw new Error("wallet not found");
      applyUpdate(found, data);
      return { ...found };
    },
    findUnique: async ({ where }: { where: { memberId: string } }) =>
      this.wallets.find((item) => item.memberId === where.memberId) ?? null,
    upsert: async ({
      where,
      create,
    }: {
      where: { memberId: string };
      create: { memberId: string };
    }) => {
      const found = this.wallets.find((item) => item.memberId === where.memberId);
      if (found) return { ...found };
      const created = makeWallet(create.memberId);
      this.wallets.push(created);
      return { ...created };
    },
  };

  ledgerEntry = {
    findUnique: async ({ where }: { where: { idempotencyKey: string } }) =>
      this.ledgerEntries.find((entry) => entry.idempotencyKey === where.idempotencyKey) ?? null,
    create: async ({ data }: { data: Data }) => {
      const installmentId = (data.installmentId as string | null) ?? null;
      if (
        this.ledgerEntries.some((entry) => entry.idempotencyKey === data.idempotencyKey) ||
        (installmentId &&
          this.ledgerEntries.some((entry) => entry.installmentId === installmentId))
      ) {
        throw uniqueViolation();
      }
      const entry: LedgerRecord = {
        id: this.nextId("ledger"),
        walletId: String(data.walletId),
        memberId: String(data.memberId),
        amountPaisa: data.amountPaisa as bigint,
        idempotencyKey: String(data.idempotencyKey),
        installmentId,
        investmentId: (data.investmentId as string | null) ?? null,
        category: String(data.category),
        direction: String(data.direction),
        type: String(data.type),
      };
      this.ledgerEntries.push(entry);
      return entry;
    },
  };

  profitDistribution = {
    findUnique: async ({ where }: { where: { month: string } }) =>
      this.distributions.find((item) => item.month === where.month) ?? null,
    create: async ({ data }: { data: Data }) => {
      const record: DistributionRecord = {
        id: this.nextId("distribution"),
        month: String(data.month),
        distributablePaisa: data.distributablePaisa as bigint,
        totalEligiblePaisa: data.totalEligiblePaisa as bigint,
        profitPerThousandPaisa: data.profitPerThousandPaisa as bigint,
        status: String(data.status),
      };
      this.distributions.push(record);
      return record;
    },
  };

  profitDistributionLine = {
    create: async ({ data }: { data: Data }) => {
      const record = { id: this.nextId("line"), ...data };
      return record;
    },
  };

  members: Array<{
    id: string;
    memberId: string;
    fullName: string;
    sponsorId: string | null;
    role?: string;
    placementParentId?: string | null;
  }> = [];
  roiDistributions: Array<Data & { id: string }> = [];
  roiLines: Array<Data & { id: string }> = [];

  member = {
    findMany: async ({ where }: { where?: { role?: string } } = {}) =>
      this.members
        .filter((member) => (where?.role ?? "MEMBER") === (member.role ?? "MEMBER"))
        .map((member) => ({ ...member })),
  };

  roiCommissionDistribution = {
    create: async ({ data }: { data: Data }) => {
      if (this.roiDistributions.some((item) => item.distributionId === data.distributionId)) {
        throw uniqueViolation();
      }
      const record = { id: String(data.distributionId ?? this.nextId("roi-run")), ...data };
      this.roiDistributions.push(record);
      return record;
    },
  };

  roiCommissionLine = {
    create: async ({ data }: { data: Data }) => {
      const duplicate = this.roiLines.some(
        (item) =>
          item.distributionId === data.distributionId &&
          item.sourceInvestmentId === data.sourceInvestmentId &&
          item.level === data.level,
      );
      if (duplicate) throw uniqueViolation();
      const record = { id: String(data.id ?? this.nextId("roi-line")), ...data };
      this.roiLines.push(record);
      return record;
    },
  };

  investmentInstallment = {
    // Deliberately ignores the status filter to simulate a stale concurrent read;
    // the service must still rely on its atomic status check and ledger key.
    findMany: async ({ where, take }: { where: { dueDate: { lte: Date } }; take: number }) => {
      const matches = this.installments.filter(
        (item) => item.dueDate.getTime() <= where.dueDate.lte.getTime(),
      );
      return matches.slice(0, take).map((item) => ({
        ...item,
        investment: { memberId: item.memberId },
      }));
    },
    updateMany: async ({
      where,
      data,
    }: {
      where: { id: string; status: string };
      data: Data;
    }) => {
      const found = this.installments.find(
        (item) => item.id === where.id && item.status === where.status,
      );
      if (!found) return { count: 0 };
      applyUpdate(found, data);
      return { count: 1 };
    },
  };

  investment = {
    findUnique: async ({ where }: { where: { id: string } }) =>
      this.investments.find((item) => item.id === where.id) ?? null,
    findMany: async () =>
      this.investments
        .filter((item) => item.type === "PROFIT_ONLY" && item.status === "ACTIVE")
        .map((item) => ({ ...item })),
    updateMany: async ({
      where,
      data,
    }: {
      where: { id: string; status: string };
      data: Data;
    }) => {
      const found = this.investments.find(
        (item) => item.id === where.id && item.status === where.status,
      );
      if (!found) return { count: 0 };
      applyUpdate(found, data);
      return { count: 1 };
    },
    update: async ({ where, data }: { where: { id: string }; data: Data }) => {
      const found = this.investments.find((item) => item.id === where.id);
      if (!found) throw new Error("investment not found");
      applyUpdate(found, data);
      return { ...found };
    },
  };

  withdrawal = {
    findUnique: async ({
      where,
    }: {
      where: { id?: string; requestNumber?: string };
    }) =>
      this.withdrawals.find(
        (item) =>
          (where.id !== undefined && item.id === where.id) ||
          (where.requestNumber !== undefined && item.requestNumber === where.requestNumber),
      ) ?? null,
    findFirst: async ({ where }: { where: Data }) =>
      this.withdrawals.find((item) => {
        if (where.investmentId !== undefined && item.investmentId !== where.investmentId) {
          return false;
        }
        if (where.type !== undefined && item.type !== where.type) return false;
        if (where.status && typeof where.status === "object") {
          const statuses = (where.status as { in?: string[] }).in ?? [];
          return statuses.includes(item.status);
        }
        return true;
      }) ?? null,
    findMany: async ({ where }: { where: Data }) =>
      this.withdrawals
        .filter((item) => {
          if (where.type !== undefined && item.type !== where.type) return false;
          if (where.status !== undefined && item.status !== where.status) return false;
          if (where.payableAt && typeof where.payableAt === "object") {
            const lte = (where.payableAt as { lte?: Date }).lte;
            if (lte && (!item.payableAt || item.payableAt.getTime() > lte.getTime())) {
              return false;
            }
          }
          return true;
        })
        .map((item) => ({
          ...item,
          investment: this.investments.find((entry) => entry.id === item.investmentId) ?? null,
        })),
    create: async ({ data }: { data: Data }) => {
      const record: WithdrawalRecord = {
        id: this.nextId("withdrawal"),
        requestNumber: String(data.requestNumber),
        memberId: String(data.memberId),
        type: String(data.type ?? "AVAILABLE"),
        investmentId: (data.investmentId as string | null) ?? null,
        amountPaisa: data.amountPaisa as bigint,
        feePaisa: data.feePaisa as bigint,
        netPaisa: data.netPaisa as bigint,
        status: String(data.status ?? "PENDING"),
        noticeAt: (data.noticeAt as Date | null) ?? null,
        payableAt: (data.payableAt as Date | null) ?? null,
        processedBy: null,
        processedAt: null,
      };
      this.withdrawals.push(record);
      return record;
    },
    updateMany: async ({
      where,
      data,
    }: {
      where: { id: string; status: string };
      data: Data;
    }) => {
      const found = this.withdrawals.find(
        (item) => item.id === where.id && item.status === where.status,
      );
      if (!found) return { count: 0 };
      applyUpdate(found, data);
      return { count: 1 };
    },
  };

  affiliateReward = {
    findUnique: async ({
      where,
    }: {
      where: {
        investmentId_beneficiaryId_level: {
          investmentId: string;
          beneficiaryId: string;
          level: number;
        };
      };
    }) => {
      const key = where.investmentId_beneficiaryId_level;
      return (
        this.rewards.find(
          (item) =>
            item.investmentId === key.investmentId &&
            item.beneficiaryId === key.beneficiaryId &&
            item.level === key.level,
        ) ?? null
      );
    },
    create: async ({ data }: { data: Data }) => {
      const record = {
        id: this.nextId("reward"),
        investmentId: String(data.investmentId),
        beneficiaryId: String(data.beneficiaryId),
        level: data.level as number,
      };
      this.rewards.push(record);
      return record;
    },
  };

  systemSetting = {
    findUnique: async () => null,
  };

  investmentSettings = {
    findFirst: async () => null,
  };

  auditLog = {
    findFirst: async ({
      where,
    }: {
      where: { action: string; entityType: string; entityId: string };
    }) =>
      this.audits.find(
        (audit) =>
          audit.action === where.action &&
          audit.entityType === where.entityType &&
          audit.entityId === where.entityId,
      ) ?? null,
    create: async ({ data }: { data: Data }) => {
      const record = { id: this.nextId("audit"), ...data };
      this.audits.push(record);
      return record;
    },
  };
}

describe("postProfitDistribution", () => {
  const input = {
    month: "2026-02",
    distributablePaisa: 100n,
    eligible: [
      { investmentId: "i1", memberId: "m1", eligiblePaisa: 1n },
      { investmentId: "i2", memberId: "m2", eligiblePaisa: 1n },
    ],
    createdBy: "admin",
  };

  it("posts, credits Profit wallets and writes a ledger per line", async () => {
    const fake = new FakePrisma();
    fake.wallets.push(makeWallet("m1"), makeWallet("m2"));

    const result = await postProfitDistribution(fake.asClient(), input);

    expect(result.applied).toBe(true);
    expect(result.ledgerEntryIds).toHaveLength(2);
    expect(fake.distributions).toHaveLength(1);
    expect(fake.ledgerEntries.map((entry) => entry.amountPaisa)).toEqual([50n, 50n]);
    expect(fake.wallets.find((item) => item.memberId === "m1")?.profitPaisa).toBe(50n);
    expect(fake.wallets.find((item) => item.memberId === "m2")?.profitPaisa).toBe(50n);
  });

  it("allows repeated distributions in the same month with unique ledger keys", async () => {
    const fake = new FakePrisma();
    fake.wallets.push(makeWallet("m1"), makeWallet("m2"));

    const first = await postProfitDistribution(fake.asClient(), input);
    const second = await postProfitDistribution(fake.asClient(), input);

    expect(first.applied).toBe(true);
    expect(second.applied).toBe(true);
    expect(fake.distributions).toHaveLength(2);
    expect(fake.ledgerEntries).toHaveLength(4);
    expect(new Set(fake.ledgerEntries.map((entry) => entry.idempotencyKey)).size).toBe(4);
    expect(fake.wallets.find((item) => item.memberId === "m1")?.profitPaisa).toBe(100n);
  });

  it("rejects a negative distributable amount", async () => {
    const fake = new FakePrisma();
    await expect(
      postProfitDistribution(fake.asClient(), { ...input, distributablePaisa: -1n }),
    ).rejects.toThrow();
    expect(fake.distributions).toHaveLength(0);
  });

  function addRoiChain(fake: FakePrisma, sourceId = "m1"): readonly string[] {
    const sponsorIds = ["s1", "s2", "s3", "s4", "s5"];
    fake.members.push({
      id: sourceId,
      memberId: sourceId,
      fullName: "Source member",
      sponsorId: "s1",
      // Placement is deliberately different and must never be used by ROI.
      placementParentId: "wrong",
    });
    sponsorIds.forEach((id, index) => {
      fake.members.push({
        id,
        memberId: id,
        fullName: `Sponsor ${index + 1}`,
        sponsorId: sponsorIds[index + 1] ?? null,
      });
    });
    fake.members.push({
      id: "wrong",
      memberId: "wrong",
      fullName: "Placement parent",
      sponsorId: null,
    });
    return sponsorIds;
  }

  const roiInput = {
    month: "2026-03",
    distributablePaisa: spToPaisa("10000"),
    eligible: [
      { investmentId: "i1", memberId: "m1", eligiblePaisa: spToPaisa("10000") },
    ],
    createdBy: "admin",
  };

  it("pays five sponsors additionally without touching the original profit", async () => {
    const fake = new FakePrisma();
    fake.wallets.push(makeWallet("m1"));
    const sponsors = addRoiChain(fake);

    const result = await postProfitDistribution(fake.asClient(), roiInput);

    expect(result.applied).toBe(true);
    expect(result.roiCommission?.totalCommissionPaisa).toBe(spToPaisa("350"));
    expect(fake.distributions[0]?.distributablePaisa).toBe(spToPaisa("10000"));
    expect(fake.wallets.find((item) => item.memberId === "m1")?.profitPaisa).toBe(
      spToPaisa("10000"),
    );
    expect(fake.wallets.find((item) => item.memberId === "m1")?.roiPaisa).toBe(0n);
    expect(sponsors.map((id) => fake.wallets.find((item) => item.memberId === id)?.roiPaisa)).toEqual([
      spToPaisa("200"),
      spToPaisa("50"),
      spToPaisa("50"),
      spToPaisa("30"),
      spToPaisa("20"),
    ]);

    const roiLedgers = fake.ledgerEntries.filter(
      (entry) => entry.type === "ROI_COMMISSION_CREDIT",
    );
    expect(roiLedgers).toHaveLength(5);
    expect(roiLedgers.every((entry) => entry.category === "ROI_COMMISSION")).toBe(true);
    expect(new Set(roiLedgers.map((entry) => entry.idempotencyKey)).size).toBe(5);
    expect(fake.roiLines.map((line) => line.level)).toEqual([1, 2, 3, 4, 5]);
    expect(fake.roiLines.some((line) => line.beneficiaryId === "wrong")).toBe(false);
    expect(result.ledgerEntryIds).toHaveLength(6);
  });

  it("pays per investment line so one sponsor can be paid twice", async () => {
    const fake = new FakePrisma();
    fake.wallets.push(makeWallet("m1"));
    addRoiChain(fake);

    const result = await postProfitDistribution(fake.asClient(), {
      ...roiInput,
      eligible: [
        { investmentId: "i1", memberId: "m1", eligiblePaisa: spToPaisa("5000") },
        { investmentId: "i2", memberId: "m1", eligiblePaisa: spToPaisa("5000") },
      ],
    });

    expect(result.applied).toBe(true);
    expect(result.roiCommission?.totalCommissionPaisa).toBe(spToPaisa("350"));
    expect(fake.roiLines).toHaveLength(10);
    expect(fake.roiLines.filter((line) => line.beneficiaryId === "s1")).toHaveLength(2);
    expect(fake.wallets.find((item) => item.memberId === "s1")?.roiPaisa).toBe(spToPaisa("200"));
    expect(fake.wallets.find((item) => item.memberId === "s2")?.roiPaisa).toBe(spToPaisa("50"));
  });

  it("rolls back profit and ROI together when a commission line fails", async () => {
    const fake = new FakePrisma();
    fake.wallets.push(makeWallet("m1"));
    addRoiChain(fake);
    fake.roiCommissionLine.create = async () => {
      throw new Error("ROI posting failed");
    };

    await expect(postProfitDistribution(fake.asClient(), roiInput)).rejects.toThrow(
      "ROI posting failed",
    );
    expect(fake.distributions).toHaveLength(0);
    expect(fake.ledgerEntries).toHaveLength(0);
    expect(fake.roiDistributions).toHaveLength(0);
    expect(fake.roiLines).toHaveLength(0);
    expect(fake.wallets.find((item) => item.memberId === "m1")?.profitPaisa).toBe(0n);
    expect(fake.wallets.find((item) => item.memberId === "s1")?.roiPaisa ?? 0n).toBe(0n);
  });

  it("does not double-pay when the same ROI distribution is posted twice", async () => {
    const fake = new FakePrisma();
    fake.wallets.push(makeWallet("m1"));
    addRoiChain(fake);
    const sponsorIndex = await loadRoiSponsorIndex(fake.asClient());
    const commissionInput = {
      distributionId: "dist-roi",
      month: "2026-03",
      lines: [
        {
          profitDistributionLineId: "line-roi",
          sourceMemberId: "m1",
          investmentId: "i1",
          basisPaisa: spToPaisa("10000"),
        },
      ],
      sponsorIndex,
      config: DEFAULT_ROI_RATE_CONFIG,
      createdBy: "admin",
    };

    const first = await fake.$transaction((tx) => postRoiCommissions(tx, commissionInput));
    expect(first.totalCommissionPaisa).toBe(spToPaisa("350"));

    await expect(
      fake.$transaction((tx) => postRoiCommissions(tx, commissionInput)),
    ).rejects.toThrow();
    expect(fake.roiDistributions).toHaveLength(1);
    expect(fake.roiLines).toHaveLength(5);
    expect(fake.wallets.find((item) => item.memberId === "s1")?.roiPaisa).toBe(spToPaisa("200"));
  });
});

describe("installment credits and reversals", () => {
  function setup(): FakePrisma {
    const fake = new FakePrisma();
    fake.wallets.push(makeWallet("m1"));
    fake.investments.push({
      id: "inv-1",
      memberId: "m1",
      amountPaisa: spToPaisa("3000"),
      // Period 2 was already paid before this test starts.
      remainingPrincipalPaisa: spToPaisa("2000"),
      type: "INSTALLMENT",
      status: "ACTIVE",
      lockInEndsAt: null,
      startDate: new Date("2026-01-01T00:00:00.000Z"),
      lockInMonths: null,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
    });
    fake.installments.push(
      {
        id: "inst-1",
        investmentId: "inv-1",
        memberId: "m1",
        periodNo: 1,
        dueDate: new Date("2026-01-31T00:00:00.000Z"),
        amountPaisa: spToPaisa("1000"),
        status: "PENDING",
        paidAt: null,
      },
      {
        id: "inst-2",
        investmentId: "inv-1",
        memberId: "m1",
        periodNo: 2,
        dueDate: new Date("2026-01-31T00:00:00.000Z"),
        amountPaisa: spToPaisa("1000"),
        status: "PAID",
        paidAt: new Date("2026-01-31T00:00:00.000Z"),
      },
      {
        id: "inst-3",
        investmentId: "inv-1",
        memberId: "m1",
        periodNo: 3,
        dueDate: new Date("2026-03-31T00:00:00.000Z"),
        amountPaisa: spToPaisa("1000"),
        status: "PENDING",
        paidAt: null,
      },
    );
    return fake;
  }

  it("credits only due pending installments and skips already paid ones", async () => {
    const fake = setup();
    const asOf = new Date("2026-02-01T00:00:00.000Z");

    const first = await creditDueInstallments(fake.asClient(), { asOf });

    expect(first.appliedIds).toEqual(["inst-1"]);
    expect(first.skippedIds).toEqual(["inst-2"]);
    expect(first.skippedReasons["inst-2"]).toBe("ALREADY_APPLIED");
    expect(fake.wallets[0]?.availablePaisa).toBe(spToPaisa("1000"));
    expect(fake.installments[0]?.status).toBe("PAID");
    expect(fake.installments[2]?.status).toBe("PENDING");
    expect(fake.investments[0]?.remainingPrincipalPaisa).toBe(spToPaisa("1000"));
    expect(fake.investments[0]?.status).toBe("ACTIVE");

    const second = await creditDueInstallments(fake.asClient(), { asOf });

    expect(second.appliedIds).toEqual([]);
    expect(fake.ledgerEntries).toHaveLength(1);
    expect(fake.wallets[0]?.availablePaisa).toBe(spToPaisa("1000"));
  });

  it("lets an admin reverse a credit exactly once without re-crediting", async () => {
    const fake = setup();
    const asOf = new Date("2026-02-01T00:00:00.000Z");
    await creditDueInstallments(fake.asClient(), { asOf });

    const first = await reverseInstallmentCredit(fake.asClient(), {
      installmentId: "inst-1",
      createdBy: "admin",
    });
    expect(first.applied).toBe(true);
    expect(fake.wallets[0]?.availablePaisa).toBe(0n);
    expect(fake.installments[0]?.status).toBe("PAID");
    expect(fake.investments[0]?.remainingPrincipalPaisa).toBe(spToPaisa("2000"));

    const second = await reverseInstallmentCredit(fake.asClient(), {
      installmentId: "inst-1",
      createdBy: "admin",
    });
    expect(second).toMatchObject({ applied: false, reason: "DUPLICATE" });
    expect(fake.ledgerEntries).toHaveLength(2);
  });
});

describe("Profit Only principal notices", () => {
  function profitOnlyInvestment(
    id: string,
    memberId: string,
    lockInEndsAt: Date,
  ): InvestmentRecord {
    return {
      id,
      memberId,
      amountPaisa: spToPaisa("100000"),
      remainingPrincipalPaisa: spToPaisa("100000"),
      type: "PROFIT_ONLY",
      status: "ACTIVE",
      lockInEndsAt,
      startDate: new Date("2025-01-01T00:00:00.000Z"),
      lockInMonths: 12,
      createdAt: new Date("2025-01-01T00:00:00.000Z"),
    };
  }

  const noticeInput = {
    memberId: "m1",
    investmentId: "matured",
    method: "BKASH" as const,
    accountDetails: { accountName: "Test", accountNumber: "01700000000" },
    idempotencyKey: "notice-1",
  };

  it("registers a two-month notice without moving money", async () => {
    const fake = new FakePrisma();
    fake.wallets.push(makeWallet("m1", { investmentPaisa: spToPaisa("100000") }));
    fake.investments.push(
      profitOnlyInvestment("matured", "m1", new Date("2026-01-01T00:00:00.000Z")),
    );

    const notice = await createPrincipalWithdrawalNotice(fake.asClient(), noticeInput);

    expect(notice.applied).toBe(true);
    expect(notice.amountPaisa).toBe(spToPaisa("100000"));
    expect(notice.payableAt).toBeDefined();
    expect(fake.withdrawals).toHaveLength(1);
    expect(fake.withdrawals[0]).toMatchObject({
      type: "PRINCIPAL",
      investmentId: "matured",
      status: "PENDING",
    });
    expect(calculatePrincipalPayableDate(fake.withdrawals[0]!.noticeAt!).getTime()).toBe(
      fake.withdrawals[0]!.payableAt!.getTime(),
    );
    expect(fake.ledgerEntries).toHaveLength(0);
    expect(fake.wallets[0]?.availablePaisa).toBe(0n);
    expect(fake.investments[0]?.status).toBe("ACTIVE");
  });

  it("refuses notices while the principal is still locked", async () => {
    const fake = new FakePrisma();
    fake.investments.push(
      profitOnlyInvestment("locked", "m1", new Date("2030-01-01T00:00:00.000Z")),
    );

    const notice = await createPrincipalWithdrawalNotice(fake.asClient(), {
      ...noticeInput,
      investmentId: "locked",
      idempotencyKey: "notice-locked",
    });

    expect(notice).toMatchObject({ applied: false, reason: "NOT_MATURED" });
    expect(fake.withdrawals).toHaveLength(0);
  });

  it("releases due principal once, closes the investment and stays idempotent", async () => {
    const fake = new FakePrisma();
    fake.wallets.push(makeWallet("m1", { investmentPaisa: spToPaisa("100000") }));
    fake.investments.push(
      profitOnlyInvestment("matured", "m1", new Date("2026-01-01T00:00:00.000Z")),
    );
    const notice = await createPrincipalWithdrawalNotice(fake.asClient(), noticeInput);
    expect(notice.applied).toBe(true);
    const asOf = new Date(
      fake.withdrawals[0]!.payableAt!.getTime() + 24 * 60 * 60 * 1000,
    );

    const first = await payDuePrincipalWithdrawals(fake.asClient(), { asOf });
    expect(first.appliedIds).toEqual([fake.withdrawals[0]!.id]);
    expect(fake.wallets[0]?.availablePaisa).toBe(spToPaisa("100000"));
    expect(fake.wallets[0]?.investmentPaisa).toBe(0n);
    expect(fake.investments[0]?.status).toBe("CLOSED");
    expect(fake.investments[0]?.remainingPrincipalPaisa).toBe(0n);
    expect(fake.withdrawals[0]?.status).toBe("APPROVED");
    expect(fake.ledgerEntries).toHaveLength(2);

    const second = await payDuePrincipalWithdrawals(fake.asClient(), { asOf });
    expect(second.appliedIds).toEqual([]);
    expect(fake.ledgerEntries).toHaveLength(2);
  });

  it("does not pay a notice before its payable date", async () => {
    const fake = new FakePrisma();
    fake.wallets.push(makeWallet("m1", { investmentPaisa: spToPaisa("100000") }));
    fake.investments.push(
      profitOnlyInvestment("matured", "m1", new Date("2026-01-01T00:00:00.000Z")),
    );
    await createPrincipalWithdrawalNotice(fake.asClient(), noticeInput);

    const result = await payDuePrincipalWithdrawals(fake.asClient(), { asOf: new Date("2020-01-01T00:00:00.000Z") });
    expect(result.appliedIds).toEqual([]);
    expect(fake.wallets[0]?.availablePaisa).toBe(0n);
    expect(fake.withdrawals[0]?.status).toBe("PENDING");
  });

  it("marks a released principal notice as paid exactly once", async () => {
    const fake = new FakePrisma();
    fake.wallets.push(makeWallet("m1", { investmentPaisa: spToPaisa("100000") }));
    fake.investments.push(
      profitOnlyInvestment("matured", "m1", new Date("2026-01-01T00:00:00.000Z")),
    );
    await createPrincipalWithdrawalNotice(fake.asClient(), noticeInput);
    const withdrawalId = fake.withdrawals[0]!.id;
    const release = await payDuePrincipalWithdrawals(fake.asClient(), {
      asOf: new Date(fake.withdrawals[0]!.payableAt!.getTime() + 1000),
    });
    expect(release.appliedIds).toEqual([withdrawalId]);

    const first = await completePrincipalWithdrawal(fake.asClient(), {
      withdrawalId,
      processedBy: "admin",
    });
    expect(first.applied).toBe(true);
    expect(fake.withdrawals[0]?.status).toBe("PAID");
    expect(fake.wallets[0]?.availablePaisa).toBe(0n);
    expect(fake.ledgerEntries).toHaveLength(3);

    const second = await completePrincipalWithdrawal(fake.asClient(), {
      withdrawalId,
      processedBy: "admin",
    });
    expect(second).toMatchObject({ applied: false, reason: "INELIGIBLE" });
    expect(fake.ledgerEntries).toHaveLength(3);
  });
});

describe("transferBalanceToAvailable", () => {
  it("moves money between buckets with two linked ledger entries, once per key", async () => {
    const fake = new FakePrisma();
    fake.wallets.push(makeWallet("m1", { profitPaisa: spToPaisa("1000") }));
    const input = {
      memberId: "m1",
      source: "PROFIT" as const,
      amountPaisa: spToPaisa("300"),
      idempotencyKey: "transfer-1",
      createdBy: "admin",
    };

    const first = await transferBalanceToAvailable(fake.asClient(), input);
    expect(first.applied).toBe(true);
    expect(first.ledgerEntryIds).toHaveLength(2);
    expect(fake.wallets[0]?.profitPaisa).toBe(spToPaisa("700"));
    expect(fake.wallets[0]?.availablePaisa).toBe(spToPaisa("300"));

    const second = await transferBalanceToAvailable(fake.asClient(), input);
    expect(second).toMatchObject({ applied: false, reason: "DUPLICATE" });
    expect(fake.ledgerEntries).toHaveLength(2);
  });

  it("moves rank rewards to Available like other reward buckets", async () => {
    const fake = new FakePrisma();
    fake.wallets.push(makeWallet("m1", { rankRewardPaisa: spToPaisa("1000") }));

    const result = await transferBalanceToAvailable(fake.asClient(), {
      memberId: "m1",
      source: "RANK_REWARD",
      amountPaisa: spToPaisa("400"),
      idempotencyKey: "transfer-rank-reward",
    });

    expect(result.applied).toBe(true);
    expect(fake.wallets[0]?.rankRewardPaisa).toBe(spToPaisa("600"));
    expect(fake.wallets[0]?.availablePaisa).toBe(spToPaisa("400"));
    expect(fake.ledgerEntries).toHaveLength(2);
  });

  it("never overdraws the source bucket", async () => {
    const fake = new FakePrisma();
    fake.wallets.push(makeWallet("m1", { affiliatePaisa: spToPaisa("100") }));

    const result = await transferBalanceToAvailable(fake.asClient(), {
      memberId: "m1",
      source: "AFFILIATE",
      amountPaisa: spToPaisa("200"),
      idempotencyKey: "transfer-2",
    });

    expect(result).toMatchObject({ applied: false, reason: "INSUFFICIENT_BALANCE" });
    expect(fake.ledgerEntries).toHaveLength(0);
    expect(fake.wallets[0]?.affiliatePaisa).toBe(spToPaisa("100"));
  });
});

describe("createWithdrawalRequest", () => {
  const feeConfig = { feeBps: 1000, minWithdrawalPaisa: spToPaisa("500") };
  const base = {
    memberId: "m1",
    amountPaisa: spToPaisa("1000"),
    method: "BKASH" as const,
    accountDetails: { account: "01700000000" },
    idempotencyKey: "withdrawal-1",
    feeConfig,
  };

  it("creates one PENDING request with net and fee ledger entries", async () => {
    const fake = new FakePrisma();
    fake.wallets.push(makeWallet("m1", { availablePaisa: spToPaisa("2000") }));

    const first = await createWithdrawalRequest(fake.asClient(), base);

    expect(first.applied).toBe(true);
    expect(first.feePaisa).toBe(spToPaisa("100"));
    expect(first.netPaisa).toBe(spToPaisa("900"));
    expect(fake.withdrawals).toHaveLength(1);
    expect(fake.wallets[0]?.availablePaisa).toBe(spToPaisa("1000"));
    expect(fake.ledgerEntries.map((entry) => entry.amountPaisa)).toEqual([
      spToPaisa("900"),
      spToPaisa("100"),
    ]);

    const second = await createWithdrawalRequest(fake.asClient(), base);
    expect(second).toMatchObject({ applied: false, reason: "DUPLICATE" });
    expect(fake.withdrawals).toHaveLength(1);
    expect(fake.ledgerEntries).toHaveLength(2);
  });

  it("rejects below-minimum and over-Available withdrawals without writing", async () => {
    const fake = new FakePrisma();
    fake.wallets.push(makeWallet("m1", { availablePaisa: spToPaisa("2000") }));

    const belowMinimum = await createWithdrawalRequest(fake.asClient(), {
      ...base,
      amountPaisa: spToPaisa("100"),
      idempotencyKey: "withdrawal-small",
    });
    const tooLarge = await createWithdrawalRequest(fake.asClient(), {
      ...base,
      amountPaisa: spToPaisa("3000"),
      idempotencyKey: "withdrawal-large",
    });

    expect(belowMinimum).toMatchObject({ applied: false, reason: "BELOW_MINIMUM" });
    expect(tooLarge).toMatchObject({ applied: false, reason: "INSUFFICIENT_BALANCE" });
    expect(fake.withdrawals).toHaveLength(0);
    expect(fake.ledgerEntries).toHaveLength(0);
    expect(fake.wallets[0]?.availablePaisa).toBe(spToPaisa("2000"));
  });
});

describe("creditAffiliateRewardsForInvestment", () => {
  it("skips missing levels permanently and never duplicates a reward", async () => {
    const fake = new FakePrisma();
    fake.wallets.push(makeWallet("l2"));
    fake.investments.push({
      id: "inv-1",
      memberId: "investor",
      amountPaisa: spToPaisa("100000"),
      remainingPrincipalPaisa: spToPaisa("100000"),
      type: "INSTALLMENT",
      status: "ACTIVE",
      lockInEndsAt: null,
      startDate: null,
      lockInMonths: null,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
    });
    const input = {
      investmentId: "inv-1",
      uplines: [{ memberId: "l2", level: 2 }],
    };

    const first = await creditAffiliateRewardsForInvestment(fake.asClient(), input);

    expect(first.appliedIds).toEqual(["2:l2"]);
    expect(first.skippedLevels).toEqual([1, 3]);
    expect(fake.rewards).toHaveLength(1);
    expect(fake.wallets[0]?.affiliatePaisa).toBe(spToPaisa("1000"));
    expect(fake.ledgerEntries).toHaveLength(1);

    const second = await creditAffiliateRewardsForInvestment(fake.asClient(), input);
    expect(second.appliedIds).toEqual([]);
    expect(second.skippedReasons["2:l2"]).toBe("DUPLICATE");
    expect(fake.rewards).toHaveLength(1);
    expect(fake.ledgerEntries).toHaveLength(1);
  });

  it("does not backfill a skipped level if later called with a fuller chain", async () => {
    const fake = new FakePrisma();
    fake.wallets.push(makeWallet("l1"), makeWallet("l2"));
    fake.investments.push({
      id: "inv-2",
      memberId: "investor",
      amountPaisa: spToPaisa("100000"),
      remainingPrincipalPaisa: spToPaisa("100000"),
      type: "INSTALLMENT",
      status: "ACTIVE",
      lockInEndsAt: null,
      startDate: null,
      lockInMonths: null,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
    });

    await creditAffiliateRewardsForInvestment(fake.asClient(), {
      investmentId: "inv-2",
      uplines: [{ memberId: "l2", level: 2 }],
    });
    // A later call with a level-1 upline must not create a level-1 reward:
    // skipped rewards are permanent and the skipped-level audit is immutable.
    const later = await creditAffiliateRewardsForInvestment(fake.asClient(), {
      investmentId: "inv-2",
      uplines: [
        { memberId: "l1", level: 1 },
        { memberId: "l2", level: 2 },
      ],
    });

    expect(later.appliedIds).toEqual([]);
    expect(later.skippedLevels).toEqual([1, 3]);
    expect(fake.rewards.map((reward) => reward.level)).toEqual([2]);
    expect(fake.ledgerEntries).toHaveLength(1);
  });
});
