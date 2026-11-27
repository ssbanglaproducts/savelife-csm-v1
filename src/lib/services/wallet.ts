import {
  WalletCategory as Category,
  LedgerEntryType as LedgerType,
} from "../../generated/prisma/enums";
import type { Prisma, PrismaClient } from "../../generated/prisma/client";
import { invalidInput } from "./errors";
import {
  adjustWalletField,
  categoryForWalletField,
  hasLedgerEntry,
  isUniqueViolation,
  makeKey,
  recordLedgerEntry,
} from "./ledger";
import type { NoOpReason } from "./types";
import {
  notifyMoneyReceived,
  notifyMoneySent,
  notifyTopUpApproved,
} from "./notification-events";
import {
  REWARD_WALLETS,
  type RewardWalletBalances,
  type RewardWalletField,
} from "../wallet-config";

const DEBIT = "DEBIT" as const;
const CREDIT = "CREDIT" as const;

export type CollectRewardsResult =
  | {
      readonly applied: true;
      readonly collectedPaisa: bigint;
      readonly ledgerEntryIds: readonly string[];
    }
  | {
      readonly applied: false;
      readonly reason: NoOpReason;
      readonly collectedPaisa: bigint;
      readonly ledgerEntryIds: readonly [];
    };

export interface CollectRewardsInput {
  readonly memberId: string;
  readonly idempotencyKey: string;
  readonly createdBy?: string;
}

/** Moves every positive reward bucket into Available in one atomic posting. */
export async function collectRewardsToAvailable(
  client: PrismaClient,
  input: CollectRewardsInput,
): Promise<CollectRewardsResult> {
  if (!input.memberId) throw invalidInput("Member is required");
  if (!input.idempotencyKey) throw invalidInput("Idempotency key is required");

  const keys = REWARD_WALLETS.flatMap((walletDefinition) => [
    makeKey(input.idempotencyKey, walletDefinition.field, "debit"),
    makeKey(input.idempotencyKey, walletDefinition.field, "credit"),
  ]);
  if (await hasLedgerEntry(client, keys[0])) {
    return { applied: false, reason: "DUPLICATE", collectedPaisa: 0n, ledgerEntryIds: [] };
  }

  const post = async (tx: Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0]) => {
    for (const key of keys) {
      if (await hasLedgerEntry(tx, key)) {
        return {
          applied: false as const,
          reason: "DUPLICATE" as const,
          collectedPaisa: 0n,
          ledgerEntryIds: [] as const,
        };
      }
    }

    const rewardSelect = Object.fromEntries(
      REWARD_WALLETS.map((walletDefinition) => [walletDefinition.field, true]),
    ) as Prisma.WalletSelect;
    const wallet = await tx.wallet.findUnique({
      where: { memberId: input.memberId },
      select: { id: true, ...rewardSelect },
    });
    if (!wallet) {
      return {
        applied: false as const,
        reason: "NOT_FOUND" as const,
        collectedPaisa: 0n,
        ledgerEntryIds: [] as const,
      };
    }

    const balances = wallet as RewardWalletBalances & { id: string };
    const positiveFields = REWARD_WALLETS.filter(
      (walletDefinition) => balances[walletDefinition.field] > 0n,
    );
    if (positiveFields.length === 0) {
      return {
        applied: false as const,
        reason: "NOT_DUE" as const,
        collectedPaisa: 0n,
        ledgerEntryIds: [] as const,
      };
    }

    const ledgerEntryIds: string[] = [];
    let collectedPaisa = 0n;

    for (const walletDefinition of positiveFields) {
      const amount = balances[walletDefinition.field];
      const debited = await adjustWalletField(
        tx,
        input.memberId,
        walletDefinition.field as RewardWalletField,
        amount,
        DEBIT,
      );
      const credited = await adjustWalletField(
        tx,
        input.memberId,
        "availablePaisa",
        amount,
        CREDIT,
      );

      const debitKey = makeKey(input.idempotencyKey, walletDefinition.field, "debit");
      const creditKey = makeKey(input.idempotencyKey, walletDefinition.field, "credit");

      const debitEntry = await recordLedgerEntry(tx, {
        walletId: debited.walletId,
        memberId: input.memberId,
        category: categoryForWalletField(walletDefinition.field as RewardWalletField),
        direction: DEBIT,
        amountPaisa: amount,
        balanceAfterPaisa: debited.balanceAfterPaisa,
        type: LedgerType.REWARD_COLLECTION,
        idempotencyKey: debitKey,
        referenceType: "RewardCollection",
        referenceId: input.idempotencyKey,
        createdBy: input.createdBy,
      });
      const creditEntry = await recordLedgerEntry(tx, {
        walletId: credited.walletId,
        memberId: input.memberId,
        category: Category.AVAILABLE,
        direction: CREDIT,
        amountPaisa: amount,
        balanceAfterPaisa: credited.balanceAfterPaisa,
        type: LedgerType.REWARD_COLLECTION,
        idempotencyKey: creditKey,
        referenceType: "RewardCollection",
        referenceId: input.idempotencyKey,
        createdBy: input.createdBy,
      });

      ledgerEntryIds.push(debitEntry.id, creditEntry.id);
      collectedPaisa += amount;
    }

    return { applied: true as const, collectedPaisa, ledgerEntryIds };
  };

  try {
    return await client.$transaction(post);
  } catch (error) {
    if (isUniqueViolation(error) && (await hasLedgerEntry(client, keys[0]))) {
      return { applied: false, reason: "DUPLICATE", collectedPaisa: 0n, ledgerEntryIds: [] };
    }
    throw error;
  }
}

export interface TransferMoneyInput {
  readonly senderId: string;
  readonly recipientId: string;
  readonly amountPaisa: bigint;
  readonly note?: string;
  readonly transferNumber: string;
  readonly idempotencyKey: string;
}

export type TransferMoneyResult =
  | {
      readonly applied: true;
      readonly transferId: string;
      readonly transferNumber: string;
      readonly ledgerEntryIds: readonly string[];
      readonly senderMemberId: string;
      readonly recipientMemberId: string;
      readonly senderBalancePaisa: bigint;
      readonly recipientBalancePaisa: bigint;
    }
  | {
      readonly applied: false;
      readonly reason: NoOpReason;
      readonly ledgerEntryIds: readonly [];
    };

/** Sends SP from one member's Available Balance to another member's Available Balance. */
export async function transferMoneyBetweenMembers(
  client: PrismaClient,
  input: TransferMoneyInput,
): Promise<TransferMoneyResult> {
  if (input.senderId === input.recipientId) {
    throw invalidInput("Cannot send SP to yourself");
  }
  if (input.amountPaisa <= 0n) throw invalidInput("Transfer amount must be positive");

  const debitKey = makeKey(input.idempotencyKey, "sender-debit");
  const creditKey = makeKey(input.idempotencyKey, "recipient-credit");
  if (
    (await hasLedgerEntry(client, debitKey)) ||
    (await hasLedgerEntry(client, creditKey)) ||
    (await client.memberTransfer.findUnique({
      where: { idempotencyKey: input.idempotencyKey },
      select: { id: true },
    }))
  ) {
    return { applied: false, reason: "DUPLICATE", ledgerEntryIds: [] };
  }

  const post = async (tx: Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0]) => {
    const [sender, recipient, senderWallet, recipientWallet] = await Promise.all([
      tx.member.findUnique({
        where: { id: input.senderId },
        select: { status: true, fullName: true, memberId: true },
      }),
      tx.member.findUnique({
        where: { id: input.recipientId },
        select: { status: true, fullName: true, memberId: true },
      }),
      tx.wallet.findUnique({
        where: { memberId: input.senderId },
        select: { availablePaisa: true },
      }),
      tx.wallet.findUnique({
        where: { memberId: input.recipientId },
        select: { availablePaisa: true },
      }),
    ]);

    if (!sender || !recipient || !senderWallet || !recipientWallet) {
      return { applied: false as const, reason: "NOT_FOUND" as const, ledgerEntryIds: [] as const };
    }
    if (sender.status !== "ACTIVE" || recipient.status === "SUSPENDED") {
      return { applied: false as const, reason: "INELIGIBLE" as const, ledgerEntryIds: [] as const };
    }
    if (senderWallet.availablePaisa < input.amountPaisa) {
      return {
        applied: false as const,
        reason: "INSUFFICIENT_BALANCE" as const,
        ledgerEntryIds: [] as const,
      };
    }

    const debited = await adjustWalletField(
      tx,
      input.senderId,
      "availablePaisa",
      input.amountPaisa,
      DEBIT,
    );
    const credited = await adjustWalletField(
      tx,
      input.recipientId,
      "availablePaisa",
      input.amountPaisa,
      CREDIT,
    );

    const transfer = await tx.memberTransfer.create({
      data: {
        transferNumber: input.transferNumber,
        senderId: input.senderId,
        recipientId: input.recipientId,
        amountPaisa: input.amountPaisa,
        note: input.note || null,
        idempotencyKey: input.idempotencyKey,
      },
      select: { id: true, transferNumber: true },
    });

    const debitEntry = await recordLedgerEntry(tx, {
      walletId: debited.walletId,
      memberId: input.senderId,
      category: Category.AVAILABLE,
      direction: DEBIT,
      amountPaisa: input.amountPaisa,
      balanceAfterPaisa: debited.balanceAfterPaisa,
      type: LedgerType.MEMBER_TRANSFER_OUT,
      idempotencyKey: debitKey,
      referenceType: "MemberTransfer",
      referenceId: transfer.transferNumber,
      description: input.note || undefined,
    });
    const creditEntry = await recordLedgerEntry(tx, {
      walletId: credited.walletId,
      memberId: input.recipientId,
      category: Category.AVAILABLE,
      direction: CREDIT,
      amountPaisa: input.amountPaisa,
      balanceAfterPaisa: credited.balanceAfterPaisa,
      type: LedgerType.MEMBER_TRANSFER_IN,
      idempotencyKey: creditKey,
      referenceType: "MemberTransfer",
      referenceId: transfer.transferNumber,
      description: input.note || undefined,
    });

    return {
      applied: true as const,
      transferId: transfer.id,
      transferNumber: transfer.transferNumber,
      ledgerEntryIds: [debitEntry.id, creditEntry.id],
      senderMemberId: sender.memberId,
      recipientMemberId: recipient.memberId,
      senderBalancePaisa: debited.balanceAfterPaisa,
      recipientBalancePaisa: credited.balanceAfterPaisa,
    };
  };

  try {
    const result = await client.$transaction(post);
    if (result.applied) {
      await Promise.all([
        notifyMoneySent(input.senderId, result.recipientMemberId, input.amountPaisa),
        notifyMoneyReceived(result.senderMemberId, input.recipientId, input.amountPaisa),
      ]);
    }
    return result;
  } catch (error) {
    if (isUniqueViolation(error) && (await hasLedgerEntry(client, debitKey))) {
      return { applied: false, reason: "DUPLICATE", ledgerEntryIds: [] };
    }
    throw error;
  }
}

/**
 * Atomically claims a PENDING top-up for review. Only the caller that wins the
 * status transition may credit the wallet or send notifications.
 */
export async function claimPendingWalletTopUp(
  client: Prisma.TransactionClient | PrismaClient,
  topUpId: string,
  data: Prisma.WalletTopUpUpdateInput,
): Promise<boolean> {
  if (typeof client.walletTopUp.updateMany === "function") {
    const claimed = await client.walletTopUp.updateMany({
      where: { id: topUpId, status: "PENDING" },
      data,
    });
    return claimed.count > 0;
  }

  // Test doubles may implement only findUnique/update.
  const current = await client.walletTopUp.findUnique({
    where: { id: topUpId },
    select: { status: true },
  });
  if (!current || current.status !== "PENDING") return false;
  await client.walletTopUp.update({ where: { id: topUpId }, data });
  return true;
}

export interface ApproveTopUpInput {
  readonly topUpId: string;
  readonly adminId: string;
}

export type ApproveTopUpResult =
  | {
      readonly applied: true;
      readonly ledgerEntryId: string;
      readonly amountPaisa: bigint;
      readonly memberId: string;
      readonly requestNumber: string;
    }
  | { readonly applied: false; readonly reason: NoOpReason };

/** Credits an admin-confirmed external top-up into the member's Available Balance. */
export async function approveWalletTopUp(
  client: PrismaClient,
  input: ApproveTopUpInput,
): Promise<ApproveTopUpResult> {
  const idempotencyKey = `wallet-top-up-credit:${input.topUpId}`;

  const post = async (tx: Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0]) => {
    const topUp = await tx.walletTopUp.findUnique({
      where: { id: input.topUpId },
      select: {
        id: true,
        memberId: true,
        requestNumber: true,
        amountPaisa: true,
      },
    });
    if (!topUp) return { applied: false as const, reason: "NOT_FOUND" as const };

    if (await hasLedgerEntry(tx, idempotencyKey)) {
      return { applied: false as const, reason: "ALREADY_APPLIED" as const };
    }
    const claimed = await claimPendingWalletTopUp(tx, input.topUpId, {
      status: "APPROVED",
      reviewedBy: input.adminId,
      reviewedAt: new Date(),
    });
    if (!claimed) return { applied: false as const, reason: "ALREADY_APPLIED" as const };

    const credited = await adjustWalletField(
      tx,
      topUp.memberId,
      "availablePaisa",
      topUp.amountPaisa,
      CREDIT,
    );
    const entry = await recordLedgerEntry(tx, {
      walletId: credited.walletId,
      memberId: topUp.memberId,
      category: Category.AVAILABLE,
      direction: CREDIT,
      amountPaisa: topUp.amountPaisa,
      balanceAfterPaisa: credited.balanceAfterPaisa,
      type: LedgerType.WALLET_TOP_UP,
      idempotencyKey,
      referenceType: "WalletTopUp",
      referenceId: topUp.requestNumber,
      createdBy: input.adminId,
    });

    return {
      applied: true as const,
      ledgerEntryId: entry.id,
      amountPaisa: topUp.amountPaisa,
      memberId: topUp.memberId,
      requestNumber: topUp.requestNumber,
    };
  };

  try {
    const result = await client.$transaction(post);
    if (result.applied) {
      await notifyTopUpApproved(result.memberId, result.requestNumber, result.amountPaisa);
    }
    return result;
  } catch (error) {
    if (isUniqueViolation(error) && (await hasLedgerEntry(client, idempotencyKey))) {
      return { applied: false, reason: "ALREADY_APPLIED" };
    }
    throw error;
  }
}
