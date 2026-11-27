import { describe, expect, it } from "vitest";
import type { PrismaClient } from "../../generated/prisma/client";
import {
  LedgerEntryType as LedgerType,
  WalletCategory as Category,
} from "../../generated/prisma/enums";
import { spToPaisa } from "../money";
import { ServiceError } from "./errors";
import {
  approveWalletTopUp,
  collectRewardsToAvailable,
  transferMoneyBetweenMembers,
} from "./wallet";

type MemberStatus = "ACTIVE" | "INACTIVE" | "SUSPENDED";

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
};

type MemberRecord = {
  id: string;
  memberId: string;
  fullName: string;
  status: MemberStatus;
  role: string;
};

type LedgerRecord = {
  id: string;
  walletId: string;
  memberId: string;
  amountPaisa: bigint;
  balanceAfterPaisa: bigint;
  idempotencyKey: string;
  type: string;
  category: string;
  direction: string;
  referenceType: string | null;
  referenceId: string | null;
  description: string | null;
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

function selectFields<T extends object>(record: T, select: Data | undefined): Partial<T> {
  if (!select) return { ...record };
  return Object.fromEntries(
    Object.keys(select).filter((key) => select[key]).map((key) => [key, (record as Data)[key]]),
  ) as Partial<T>;
}

/** Minimal in-memory stand-in so tests exercise the real service code. */
class FakePrisma {
  wallets: WalletRecord[] = [];
  members: MemberRecord[] = [];
  ledgerEntries: LedgerRecord[] = [];
  transfers: Array<Data & { id: string }> = [];
  topUps: Array<
    Data & {
      id: string;
      memberId: string;
      requestNumber: string;
      amountPaisa: bigint;
      status: string;
    }
  > = [];
  private sequence = 0;
  walletUpdateManyCalls: Array<{ where: Data; data: Data }> = [];

  private nextId(prefix: string): string {
    this.sequence += 1;
    return `${prefix}-${this.sequence}`;
  }

  asClient(): PrismaClient {
    return this as unknown as PrismaClient;
  }

  $transaction<T>(callback: (tx: PrismaClient) => Promise<T>): Promise<T> {
    return callback(this.asClient());
  }

  addWallet(memberId: string, values: Partial<WalletRecord> = {}): WalletRecord {
    const wallet: WalletRecord = {
      id: `wallet-${memberId}`,
      memberId,
      availablePaisa: 0n,
      pendingPaisa: 0n,
      investmentPaisa: 0n,
      profitPaisa: 0n,
      affiliatePaisa: 0n,
      rankRewardPaisa: 0n,
      salaryPaisa: 0n,
      ...values,
    };
    this.wallets.push(wallet);
    return wallet;
  }

  addMember(id: string, status: MemberStatus, role = "MEMBER"): MemberRecord {
    const member: MemberRecord = {
      id,
      memberId: id.toUpperCase(),
      fullName: `Member ${id}`,
      status,
      role,
    };
    this.members.push(member);
    return member;
  }

  wallet = {
    findUnique: async ({
      where,
      select,
    }: {
      where: { memberId: string };
      select?: Data;
    }): Promise<Partial<WalletRecord> | null> => {
      const found = this.wallets.find((item) => item.memberId === where.memberId);
      return found ? selectFields(found, select) : null;
    },
    update: async ({ where, data }: { where: { memberId: string }; data: Data }) => {
      const found = this.wallets.find((item) => item.memberId === where.memberId);
      if (!found) throw new Error("wallet not found");
      applyUpdate(found, data);
      return { ...found };
    },
    // Mirrors Prisma's conditional updateMany so tests exercise the same
    // atomic debit path used in production (not the find/update fallback).
    updateMany: async ({ where, data }: { where: Data; data: Data }) => {
      this.walletUpdateManyCalls.push({ where, data });
      const found = this.wallets.find((item) => item.memberId === where.memberId);
      if (!found) return { count: 0 };
      for (const [field, condition] of Object.entries(where)) {
        if (field === "memberId" || !condition || typeof condition !== "object") continue;
        const threshold = (condition as Data).gte;
        const current = (found as Data)[field];
        if (typeof threshold === "bigint" && typeof current === "bigint" && current < threshold) {
          return { count: 0 };
        }
      }
      applyUpdate(found, data);
      return { count: 1 };
    },
  };

  member = {
    findUnique: async ({
      where,
      select,
    }: {
      where: { id: string; role?: string };
      select?: Data;
    }): Promise<Partial<MemberRecord> | null> => {
      const found = this.members.find(
        (item) => item.id === where.id && (where.role ?? "MEMBER") === item.role,
      );
      return found ? selectFields(found, select) : null;
    },
  };

  ledgerEntry = {
    findUnique: async ({ where }: { where: { idempotencyKey: string } }) =>
      this.ledgerEntries.find((entry) => entry.idempotencyKey === where.idempotencyKey) ?? null,
    create: async ({ data }: { data: Data }) => {
      if (this.ledgerEntries.some((entry) => entry.idempotencyKey === data.idempotencyKey)) {
        throw uniqueViolation();
      }
      const entry: LedgerRecord = {
        id: this.nextId("ledger"),
        walletId: String(data.walletId),
        memberId: String(data.memberId),
        amountPaisa: data.amountPaisa as bigint,
        balanceAfterPaisa: data.balanceAfterPaisa as bigint,
        idempotencyKey: String(data.idempotencyKey),
        type: String(data.type),
        category: String(data.category),
        direction: String(data.direction),
        referenceType: (data.referenceType as string | null) ?? null,
        referenceId: (data.referenceId as string | null) ?? null,
        description: (data.description as string | null) ?? null,
      };
      this.ledgerEntries.push(entry);
      return entry;
    },
  };

  memberTransfer = {
    findUnique: async ({ where }: { where: { idempotencyKey: string } }) =>
      this.transfers.find((item) => item.idempotencyKey === where.idempotencyKey) ?? null,
    create: async ({ data }: { data: Data }) => {
      const record = { id: this.nextId("transfer"), ...data };
      this.transfers.push(record);
      return record;
    },
  };

  walletTopUp = {
    findUnique: async ({ where }: { where: { id: string } }) =>
      this.topUps.find((item) => item.id === where.id) ?? null,
    update: async ({ where, data }: { where: { id: string }; data: Data }) => {
      const found = this.topUps.find((item) => item.id === where.id);
      if (!found) throw new Error("top-up not found");
      applyUpdate(found, data);
      return { ...found };
    },
  };
}

const fiveHundred = spToPaisa("500");
const sevenHundred = spToPaisa("700");

describe("collectRewardsToAvailable", () => {
  it("moves every positive reward into Available without touching invested capital", async () => {
    const db = new FakePrisma();
    const wallet = db.addWallet("SL1", {
      availablePaisa: spToPaisa("100"),
      profitPaisa: spToPaisa("300"),
      affiliatePaisa: spToPaisa("200"),
      rankRewardPaisa: spToPaisa("100"),
      salaryPaisa: spToPaisa("100"),
      investmentPaisa: spToPaisa("50000"),
    });

    const result = await collectRewardsToAvailable(db.asClient(), {
      memberId: "SL1",
      idempotencyKey: "collect-1",
      createdBy: "SL1",
    });

    expect(result.applied).toBe(true);
    if (!result.applied) return;
    expect(result.collectedPaisa).toBe(sevenHundred);
    expect(result.ledgerEntryIds).toHaveLength(8);
    expect(wallet.profitPaisa).toBe(0n);
    expect(wallet.affiliatePaisa).toBe(0n);
    expect(wallet.rankRewardPaisa).toBe(0n);
    expect(wallet.salaryPaisa).toBe(0n);
    expect(wallet.availablePaisa).toBe(spToPaisa("800"));
    expect(wallet.investmentPaisa).toBe(spToPaisa("50000"));
    expect(db.ledgerEntries.every((entry) => entry.type === LedgerType.REWARD_COLLECTION)).toBe(
      true,
    );
    expect(db.ledgerEntries.filter((entry) => entry.category === Category.AVAILABLE)).toHaveLength(
      4,
    );
    expect(db.ledgerEntries.filter((entry) => entry.category === Category.RANK_REWARD)).toHaveLength(
      1,
    );
  });

  it("is a no-op when there are no rewards to collect", async () => {
    const db = new FakePrisma();
    db.addWallet("SL1", { availablePaisa: spToPaisa("10") });

    const result = await collectRewardsToAvailable(db.asClient(), {
      memberId: "SL1",
      idempotencyKey: "collect-empty",
    });

    expect(result).toMatchObject({ applied: false, reason: "NOT_DUE", collectedPaisa: 0n });
    expect(db.ledgerEntries).toHaveLength(0);
  });

  it("does not post twice for the same idempotency key", async () => {
    const db = new FakePrisma();
    db.addWallet("SL1", { profitPaisa: spToPaisa("50") });
    const input = { memberId: "SL1", idempotencyKey: "collect-dup" };

    const first = await collectRewardsToAvailable(db.asClient(), input);
    const second = await collectRewardsToAvailable(db.asClient(), input);

    expect(first.applied).toBe(true);
    expect(second).toMatchObject({ applied: false, reason: "DUPLICATE" });
    expect(db.ledgerEntries).toHaveLength(2);
  });
});

describe("transferMoneyBetweenMembers", () => {
  function setup(senderStatus: MemberStatus, recipientStatus: MemberStatus) {
    const db = new FakePrisma();
    db.addMember("SL1", senderStatus);
    db.addMember("SL2", recipientStatus);
    const senderWallet = db.addWallet("SL1", { availablePaisa: spToPaisa("1000") });
    const recipientWallet = db.addWallet("SL2", { availablePaisa: 0n });
    return { db, senderWallet, recipientWallet };
  }

  const baseInput = {
    senderId: "SL1",
    recipientId: "SL2",
    amountPaisa: spToPaisa("300"),
    transferNumber: "SL-TR-1",
    idempotencyKey: "transfer-1",
  };

  it("debits the sender and credits an inactive recipient", async () => {
    const { db, senderWallet, recipientWallet } = setup("ACTIVE", "INACTIVE");

    const result = await transferMoneyBetweenMembers(db.asClient(), {
      ...baseInput,
      note: "Lunch",
    });

    expect(result.applied).toBe(true);
    if (!result.applied) return;
    expect(senderWallet.availablePaisa).toBe(spToPaisa("700"));
    expect(recipientWallet.availablePaisa).toBe(spToPaisa("300"));
    expect(db.transfers).toHaveLength(1);
    expect(db.ledgerEntries.map((entry) => entry.type)).toEqual([
      LedgerType.MEMBER_TRANSFER_OUT,
      LedgerType.MEMBER_TRANSFER_IN,
    ]);
    expect(db.ledgerEntries.every((entry) => entry.referenceId === "SL-TR-1")).toBe(true);
    expect(db.ledgerEntries.every((entry) => entry.description === "Lunch")).toBe(true);
  });

  it("claims the sender balance with a conditional atomic debit", async () => {
    const { db } = setup("ACTIVE", "ACTIVE");

    await transferMoneyBetweenMembers(db.asClient(), baseInput);

    // The sender debit must be a guarded updateMany (>= amount), never an
    // unconditional decrement that a concurrent transfer could also win.
    expect(db.walletUpdateManyCalls).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          where: {
            memberId: "SL1",
            availablePaisa: { gte: spToPaisa("300") },
          },
          data: { availablePaisa: { decrement: spToPaisa("300") } },
        }),
      ]),
    );
  });

  it("blocks suspended recipients and inactive senders", async () => {
    const suspended = setup("ACTIVE", "SUSPENDED");
    expect(
      await transferMoneyBetweenMembers(suspended.db.asClient(), baseInput),
    ).toMatchObject({ applied: false, reason: "INELIGIBLE" });

    const inactiveSender = setup("INACTIVE", "ACTIVE");
    expect(
      await transferMoneyBetweenMembers(inactiveSender.db.asClient(), baseInput),
    ).toMatchObject({ applied: false, reason: "INELIGIBLE" });
  });

  it("does not transfer money to or from staff accounts", async () => {
    const staffRecipient = new FakePrisma();
    staffRecipient.addMember("SL1", "ACTIVE");
    staffRecipient.addMember("SL2", "ACTIVE", "STAFF");
    staffRecipient.addWallet("SL1", { availablePaisa: spToPaisa("1000") });
    staffRecipient.addWallet("SL2", { availablePaisa: 0n });
    expect(
      await transferMoneyBetweenMembers(staffRecipient.asClient(), baseInput),
    ).toMatchObject({ applied: false, reason: "NOT_FOUND" });

    const staffSender = new FakePrisma();
    staffSender.addMember("SL1", "ACTIVE", "STAFF");
    staffSender.addMember("SL2", "ACTIVE");
    staffSender.addWallet("SL1", { availablePaisa: spToPaisa("1000") });
    staffSender.addWallet("SL2", { availablePaisa: 0n });
    expect(
      await transferMoneyBetweenMembers(staffSender.asClient(), baseInput),
    ).toMatchObject({ applied: false, reason: "NOT_FOUND" });
  });

  it("rejects insufficient available balance", async () => {
    const { db } = setup("ACTIVE", "ACTIVE");
    expect(
      await transferMoneyBetweenMembers(db.asClient(), {
        ...baseInput,
        amountPaisa: spToPaisa("1001"),
      }),
    ).toMatchObject({ applied: false, reason: "INSUFFICIENT_BALANCE" });
    expect(db.ledgerEntries).toHaveLength(0);
  });

  it("refuses self-transfers and non-positive amounts", async () => {
    const { db } = setup("ACTIVE", "ACTIVE");
    await expect(
      transferMoneyBetweenMembers(db.asClient(), { ...baseInput, recipientId: "SL1" }),
    ).rejects.toBeInstanceOf(ServiceError);
    await expect(
      transferMoneyBetweenMembers(db.asClient(), { ...baseInput, amountPaisa: 0n }),
    ).rejects.toBeInstanceOf(ServiceError);
  });

  it("does not repeat a transfer for the same idempotency key", async () => {
    const { db, senderWallet } = setup("ACTIVE", "ACTIVE");
    const first = await transferMoneyBetweenMembers(db.asClient(), baseInput);
    const second = await transferMoneyBetweenMembers(db.asClient(), baseInput);

    expect(first.applied).toBe(true);
    expect(second).toMatchObject({ applied: false, reason: "DUPLICATE" });
    expect(senderWallet.availablePaisa).toBe(spToPaisa("700"));
    expect(db.transfers).toHaveLength(1);
    expect(db.ledgerEntries).toHaveLength(2);
  });
});

describe("approveWalletTopUp", () => {
  function setup(status = "PENDING") {
    const db = new FakePrisma();
    const wallet = db.addWallet("SL1", { availablePaisa: spToPaisa("10") });
    db.topUps.push({
      id: "topup-1",
      memberId: "SL1",
      requestNumber: "SL-TU-1",
      amountPaisa: fiveHundred,
      status,
      reviewedBy: null,
      reviewedAt: null,
    });
    return { db, wallet };
  }

  it("credits a pending top-up and marks it approved", async () => {
    const { db, wallet } = setup();

    const result = await approveWalletTopUp(db.asClient(), {
      topUpId: "topup-1",
      adminId: "SL000000",
    });

    expect(result).toMatchObject({ applied: true, amountPaisa: fiveHundred });
    expect(wallet.availablePaisa).toBe(spToPaisa("510"));
    expect(db.topUps[0]).toMatchObject({ status: "APPROVED", reviewedBy: "SL000000" });
    expect(db.ledgerEntries).toHaveLength(1);
    expect(db.ledgerEntries[0]).toMatchObject({
      type: LedgerType.WALLET_TOP_UP,
      category: Category.AVAILABLE,
      referenceId: "SL-TU-1",
    });
  });

  it("does not credit the same top-up twice", async () => {
    const { db, wallet } = setup("APPROVED");

    expect(
      await approveWalletTopUp(db.asClient(), { topUpId: "topup-1", adminId: "SL000000" }),
    ).toMatchObject({ applied: false, reason: "ALREADY_APPLIED" });
    expect(wallet.availablePaisa).toBe(spToPaisa("10"));
    expect(db.ledgerEntries).toHaveLength(0);
  });

  it("returns NOT_FOUND for an unknown top-up", async () => {
    const { db } = setup();
    expect(
      await approveWalletTopUp(db.asClient(), { topUpId: "missing", adminId: "SL000000" }),
    ).toMatchObject({ applied: false, reason: "NOT_FOUND" });
  });
});
