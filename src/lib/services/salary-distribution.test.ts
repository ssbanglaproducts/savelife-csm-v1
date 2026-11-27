import { describe, expect, it } from "vitest";
import type { PrismaClient } from "../../generated/prisma/client";
import { spToPaisa } from "../money";
import { runSalaryDistribution } from "./salary-distribution";

type Data = Record<string, unknown>;

type MemberRow = {
  id: string;
  fullName: string;
  status: "ACTIVE" | "INACTIVE" | "SUSPENDED";
  role: string;
};

type EntitlementRow = {
  id: string;
  memberId: string;
  rankKey: string;
  rankSortOrder: number;
  weeksPaid: number;
  member: MemberRow;
};

type TreasuryRow = {
  rankKey: string;
  balancePaisa: bigint;
  totalAllocatedPaisa: bigint;
  totalPaidPaisa: bigint;
};

type WalletRow = {
  id: string;
  memberId: string;
  salaryPaisa: bigint;
};

type LedgerRow = Data & {
  id: string;
  memberId: string;
  amountPaisa: bigint;
  type: string;
  category: string;
};

type PaymentRow = Data & {
  id: string;
  memberId: string;
  rankKey: string;
  amountPaisa: bigint;
  weekNumber: number;
  status: string;
};

type DistributionRow = Data & {
  id: string;
  weekEndAt: Date;
  totalPaidPaisa: bigint;
  recipientCount: number;
};

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
      } else if (typeof current === "number" && typeof operation.increment === "number") {
        target[field] = current + operation.increment;
      } else {
        target[field] = value;
      }
    } else {
      target[field] = value;
    }
  }
}

class FakeSalaryClient {
  readonly members: MemberRow[] = [];
  readonly entitlements: EntitlementRow[] = [];
  readonly treasuries: TreasuryRow[] = [];
  readonly wallets: WalletRow[] = [];
  readonly ledgers: LedgerRow[] = [];
  readonly payments: PaymentRow[] = [];
  readonly distributions: DistributionRow[] = [];
  readonly failRankKeys = new Set<string>();

  private sequence = 0;

  asClient(): PrismaClient {
    return this as unknown as PrismaClient;
  }

  $transaction<T>(callback: (tx: PrismaClient) => Promise<T>): Promise<T> {
    return callback(this.asClient());
  }

  private nextId(prefix: string): string {
    this.sequence += 1;
    return `${prefix}-${this.sequence}`;
  }

  addEntitlement(
    id: string,
    memberId: string,
    rankKey: string,
    rankSortOrder: number,
    weeksPaid: number,
    status: MemberRow["status"],
    role = "MEMBER",
  ): void {
    const member: MemberRow = {
      id: memberId,
      fullName: `Member ${memberId}`,
      status,
      role,
    };
    this.members.push(member);
    this.entitlements.push({
      id,
      memberId,
      rankKey,
      rankSortOrder,
      weeksPaid,
      member,
    });
  }

  addTreasury(rankKey: string, balancePaisa: bigint): void {
    this.treasuries.push({
      rankKey,
      balancePaisa,
      totalAllocatedPaisa: balancePaisa,
      totalPaidPaisa: 0n,
    });
  }

  salaryDistribution = {
    findUnique: async ({ where }: { where: { weekEndAt: Date } }) =>
      this.distributions.find(
        (row) => row.weekEndAt.getTime() === where.weekEndAt.getTime(),
      ) ?? null,
    create: async ({ data }: { data: Data }) => {
      const row: DistributionRow = {
        id: this.nextId("distribution"),
        weekEndAt: data.weekEndAt as Date,
        totalPaidPaisa: 0n,
        recipientCount: 0,
        ...data,
      } as DistributionRow;
      this.distributions.push(row);
      return row;
    },
    update: async ({ where, data }: { where: { id: string }; data: Data }) => {
      const found = this.distributions.find((row) => row.id === where.id);
      if (!found) throw new Error("distribution not found");
      applyUpdate(found, data);
      return { ...found };
    },
  };

  salaryTreasury = {
    findMany: async ({ where }: { where: { rankKey: { in: string[] } } }) =>
      this.treasuries
        .filter((row) => where.rankKey.in.includes(row.rankKey))
        .map((row) => ({ rankKey: row.rankKey, balancePaisa: row.balancePaisa })),
    updateMany: async ({
      where,
      data,
    }: {
      where: { rankKey: string; balancePaisa: { gte: bigint } };
      data: Data;
    }) => {
      if (this.failRankKeys.has(where.rankKey)) return { count: 0 };
      const found = this.treasuries.find((row) => row.rankKey === where.rankKey);
      if (!found || found.balancePaisa < where.balancePaisa.gte) return { count: 0 };
      applyUpdate(found, data);
      return { count: 1 };
    },
  };

  salaryEntitlement = {
    findMany: async ({
      where,
    }: {
      where: { rankKey: { in: string[] }; member: { status: string; role?: string } };
    }) =>
      this.entitlements
        .filter(
          (row) =>
            where.rankKey.in.includes(row.rankKey) &&
            row.member.status === where.member.status &&
            (where.member.role ?? "MEMBER") === row.member.role,
        )
        .map((row) => ({
          id: row.id,
          memberId: row.memberId,
          rankKey: row.rankKey,
          weeksPaid: row.weeksPaid,
          member: { fullName: row.member.fullName },
        })),
    update: async ({ where, data }: { where: { id: string }; data: Data }) => {
      const found = this.entitlements.find((row) => row.id === where.id);
      if (!found) throw new Error("entitlement not found");
      applyUpdate(found, data);
      return { ...found };
    },
  };

  wallet = {
    upsert: async ({ where }: { where: { memberId: string } }) => {
      const found = this.wallets.find((row) => row.memberId === where.memberId);
      if (found) return { ...found };
      const created: WalletRow = {
        id: this.nextId("wallet"),
        memberId: where.memberId,
        salaryPaisa: 0n,
      };
      this.wallets.push(created);
      return { ...created };
    },
    update: async ({ where, data }: { where: { memberId: string }; data: Data }) => {
      const found = this.wallets.find((row) => row.memberId === where.memberId);
      if (!found) throw new Error("wallet not found");
      applyUpdate(found, data);
      return { ...found };
    },
  };

  ledgerEntry = {
    create: async ({ data }: { data: Data }) => {
      const row: LedgerRow = {
        ...data,
        id: this.nextId("ledger"),
      } as LedgerRow;
      this.ledgers.push(row);
      return row;
    },
  };

  salaryPayment = {
    create: async ({ data }: { data: Data }) => {
      const row: PaymentRow = {
        ...data,
        id: this.nextId("payment"),
      } as PaymentRow;
      this.payments.push(row);
      return row;
    },
  };
}

function seedEligibleMembers(db: FakeSalaryClient): void {
  db.addTreasury("R2", spToPaisa("30000"));
  db.addTreasury("R9", spToPaisa("5000"));
  db.addEntitlement("ent-r2-a", "active-a", "R2", 2, 0, "ACTIVE");
  db.addEntitlement("ent-r2-b", "active-b", "R2", 2, 0, "ACTIVE");
  db.addEntitlement("ent-r2-inactive", "inactive", "R2", 2, 0, "INACTIVE");
  db.addEntitlement("ent-r2-staff", "staff", "R2", 2, 0, "ACTIVE", "STAFF");
  db.addEntitlement("ent-r2-complete", "completed", "R2", 2, 12, "ACTIVE");
  db.addEntitlement("ent-r9-a", "active-r9", "R9", 9, 0, "ACTIVE");
}

const sunday = new Date("2026-11-29T12:00:00.000Z");
const sundayBoundary = "2026-11-28T18:00:00.000Z";

describe("weekly salary distribution", () => {
  it("pays every salary rank together, caps shares and excludes ineligible members", async () => {
    const db = new FakeSalaryClient();
    seedEligibleMembers(db);

    const result = await runSalaryDistribution(db.asClient(), {
      asOf: sunday,
      createdBy: "admin-1",
    });

    expect(result.applied).toBe(true);
    expect(result.weekEndAt).toBe(sundayBoundary);
    expect(result.totalPaidPaisa).toBe(spToPaisa("25000"));
    expect(result.recipientCount).toBe(3);
    expect(result.failedCount).toBe(0);

    expect(db.wallets.find((row) => row.memberId === "active-a")?.salaryPaisa).toBe(
      spToPaisa("10000"),
    );
    expect(db.wallets.find((row) => row.memberId === "active-b")?.salaryPaisa).toBe(
      spToPaisa("10000"),
    );
    expect(db.wallets.find((row) => row.memberId === "active-r9")?.salaryPaisa).toBe(
      spToPaisa("5000"),
    );
    expect(db.wallets.find((row) => row.memberId === "inactive")).toBeUndefined();
    expect(db.wallets.find((row) => row.memberId === "staff")).toBeUndefined();
    expect(db.wallets.find((row) => row.memberId === "completed")).toBeUndefined();

    expect(db.ledgers).toHaveLength(3);
    expect(
      db.ledgers.every(
        (row) => row.type === "SALARY_PAYMENT" && row.category === "SALARY",
      ),
    ).toBe(true);
    expect(db.payments).toHaveLength(3);
    expect(db.payments.every((row) => row.status === "SUCCESS")).toBe(true);
    expect(db.payments.every((row) => row.weekNumber === 1)).toBe(true);

    const r2 = db.treasuries.find((row) => row.rankKey === "R2");
    const r9 = db.treasuries.find((row) => row.rankKey === "R9");
    expect(r2?.balancePaisa).toBe(spToPaisa("10000"));
    expect(r2?.totalPaidPaisa).toBe(spToPaisa("20000"));
    expect(r9?.balancePaisa).toBe(0n);
    expect(r9?.totalPaidPaisa).toBe(spToPaisa("5000"));
  });

  it("does not post the same week twice", async () => {
    const db = new FakeSalaryClient();
    seedEligibleMembers(db);

    await runSalaryDistribution(db.asClient(), { asOf: sunday });
    const repeated = await runSalaryDistribution(db.asClient(), { asOf: sunday });

    expect(repeated.applied).toBe(false);
    expect(repeated.reason).toBe("DUPLICATE");
    expect(db.distributions).toHaveLength(1);
    expect(db.ledgers).toHaveLength(3);
    expect(db.payments).toHaveLength(3);
  });

  it("records failed claims without counting a successful week", async () => {
    const db = new FakeSalaryClient();
    seedEligibleMembers(db);
    db.failRankKeys.add("R9");

    const failedWeek = await runSalaryDistribution(db.asClient(), { asOf: sunday });

    expect(failedWeek.totalPaidPaisa).toBe(spToPaisa("20000"));
    expect(failedWeek.recipientCount).toBe(2);
    expect(failedWeek.failedCount).toBe(1);

    const failedPayment = db.payments.find((row) => row.memberId === "active-r9");
    expect(failedPayment).toMatchObject({ status: "FAILED", weekNumber: 1 });
    expect(db.wallets.find((row) => row.memberId === "active-r9")).toBeUndefined();
    expect(
      db.entitlements.find((row) => row.memberId === "active-r9")?.weeksPaid,
    ).toBe(0);
    expect(db.treasuries.find((row) => row.rankKey === "R9")?.balancePaisa).toBe(
      spToPaisa("5000"),
    );

    db.failRankKeys.clear();
    const nextWeek = await runSalaryDistribution(db.asClient(), {
      asOf: new Date("2026-12-06T12:00:00.000Z"),
    });

    expect(nextWeek.applied).toBe(true);
    const successfulPayments = db.payments.filter(
      (row) => row.memberId === "active-r9" && row.status === "SUCCESS",
    );
    expect(successfulPayments).toHaveLength(1);
    expect(successfulPayments[0].weekNumber).toBe(1);
  });
});
