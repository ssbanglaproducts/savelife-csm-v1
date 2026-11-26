import { describe, expect, it } from "vitest";
import type { PrismaClient } from "../../generated/prisma/client";
import { spToPaisa } from "../money";
import { fundSalaryTreasuriesForInvestment } from "./salary-funding";

type Data = Record<string, unknown>;

type FundingRow = {
  investmentId: string;
  rankKey: string;
  amountPaisa: bigint;
};

type TreasuryRow = {
  rankKey: string;
  balancePaisa: bigint;
  totalAllocatedPaisa: bigint;
  totalPaidPaisa: bigint;
};

function applyUpdate(record: object, data: Data): void {
  const target = record as Data;
  for (const [field, value] of Object.entries(data)) {
    if (typeof value === "object" && value !== null) {
      const operation = value as Data;
      const current = target[field];
      if (typeof current === "bigint" && typeof operation.increment === "bigint") {
        target[field] = current + operation.increment;
      } else {
        target[field] = value;
      }
    } else {
      target[field] = value;
    }
  }
}

class FakeFundingClient {
  readonly fundings: FundingRow[] = [];
  readonly treasuries: TreasuryRow[] = [];

  asClient(): PrismaClient {
    return this as unknown as PrismaClient;
  }

  $transaction<T>(callback: (tx: PrismaClient) => Promise<T>): Promise<T> {
    return callback(this.asClient());
  }

  addFunding(row: FundingRow): void {
    this.fundings.push(row);
  }

  salaryFunding = {
    findMany: async ({ where }: { where: { investmentId: string } }) =>
      this.fundings
        .filter((row) => row.investmentId === where.investmentId)
        .map((row) => ({ rankKey: row.rankKey })),
    createMany: async ({
      data,
      skipDuplicates,
    }: {
      data: FundingRow[];
      skipDuplicates?: boolean;
    }) => {
      let count = 0;
      for (const row of data) {
        const duplicate = this.fundings.some(
          (item) =>
            item.investmentId === row.investmentId && item.rankKey === row.rankKey,
        );
        if (duplicate) {
          if (skipDuplicates) continue;
          throw Object.assign(new Error("duplicate"), { code: "P2002" });
        }
        this.fundings.push(row);
        count += 1;
      }
      return { count };
    },
  };

  salaryTreasury = {
    upsert: async ({
      where,
      create,
      update,
    }: {
      where: { rankKey: string };
      create: TreasuryRow;
      update: Data;
    }) => {
      const existing = this.treasuries.find((row) => row.rankKey === where.rankKey);
      if (!existing) {
        this.treasuries.push({ ...create });
        return { ...create };
      }
      applyUpdate(existing, update);
      return { ...existing };
    },
  };
}

describe("salary investment funding", () => {
  it("allocates 9.5% into eight separate treasuries", async () => {
    const db = new FakeFundingClient();

    const result = await fundSalaryTreasuriesForInvestment(db.asClient(), {
      investmentId: "inv-1",
      amountPaisa: spToPaisa("100000"),
    });

    expect(result.applied).toBe(true);
    expect(result.fundedRanks).toHaveLength(8);
    expect(result.totalPaisa).toBe(spToPaisa("9500"));
    expect(db.fundings).toHaveLength(8);
    expect(db.treasuries.map((row) => row.rankKey)).toEqual([
      "R2",
      "R3",
      "R4",
      "R5",
      "R6",
      "R7",
      "R8",
      "R9",
    ]);
    expect(db.treasuries.find((row) => row.rankKey === "R2")?.balancePaisa).toBe(
      spToPaisa("2000"),
    );
    expect(
      db.treasuries.reduce((total, row) => total + row.balancePaisa, 0n),
    ).toBe(spToPaisa("9500"));
  });

  it("is idempotent when called again for the same investment", async () => {
    const db = new FakeFundingClient();
    const input = { investmentId: "inv-1", amountPaisa: spToPaisa("100000") };

    await fundSalaryTreasuriesForInvestment(db.asClient(), input);
    const second = await fundSalaryTreasuriesForInvestment(db.asClient(), input);

    expect(second).toEqual({ applied: false, fundedRanks: [], totalPaisa: 0n });
    expect(db.fundings).toHaveLength(8);
    expect(
      db.treasuries.reduce((total, row) => total + row.balancePaisa, 0n),
    ).toBe(spToPaisa("9500"));
  });

  it("only funds ranks that are missing after a partial failure", async () => {
    const db = new FakeFundingClient();
    db.addFunding({
      investmentId: "inv-1",
      rankKey: "R9",
      amountPaisa: spToPaisa("500"),
    });

    const result = await fundSalaryTreasuriesForInvestment(db.asClient(), {
      investmentId: "inv-1",
      amountPaisa: spToPaisa("100000"),
    });

    expect(result.applied).toBe(true);
    expect(result.fundedRanks).not.toContain("R9");
    expect(db.fundings.filter((row) => row.rankKey === "R9")).toHaveLength(1);
    expect(db.fundings).toHaveLength(8);
  });
});
