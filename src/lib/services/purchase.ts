import { randomUUID } from "node:crypto";
import type { PrismaClient } from "@/generated/prisma/client";
import {
  LedgerEntryType as LedgerType,
  WalletCategory as Category,
} from "@/generated/prisma/enums";
import {
  debitWalletFieldIfSufficient,
  hasLedgerEntry,
  isUniqueViolation,
  recordLedgerEntry,
} from "@/lib/services/ledger";

/** An item whose product price has already been resolved from the database. */
export type PricedPurchaseItem = {
  productId: string | null;
  productName: string;
  productImage: string | null;
  unitPricePaisa: bigint;
  quantity: number;
  dbProduct?: { id: string; stock: number } | null;
};

export type PurchaseAddressInput =
  | { mode: "existing"; addressId: string }
  | { mode: "office"; fullName: string; phone: string }
  | {
      mode: "new";
      label: string;
      fullName: string;
      phone: string;
      street: string;
      thana: string;
      district: string;
      postalCode: string;
      isMain: boolean;
    };

export type PurchaseAddressSnapshot = {
  id: string | null;
  label: string;
  fullName: string;
  phone: string;
  street: string;
  thana: string;
  district: string;
  postalCode: string;
  country: string;
};

export type CreatePaidOrderInput = {
  memberId: string;
  items: PricedPurchaseItem[];
  address: PurchaseAddressInput;
  fulfillment: "OFFICE_PICKUP" | "HOME_DELIVERY";
  idempotencyKey: string;
  notes?: string;
};

export type CreatePaidOrderResult = {
  order: { id: string; orderNumber: string };
  activated: boolean;
  availablePaisa: bigint;
  totalPaisa: bigint;
  addressSnapshot: PurchaseAddressSnapshot;
  /** True when an earlier request with the same key already created the order. */
  duplicate: boolean;
};

function purchaseError(code: string): Error {
  return new Error(code);
}

/**
 * The single atomic wallet-funded order path shared by activation Buy Now,
 * delivery Buy Now and cart checkout. Payment, stock claim, address snapshot,
 * order creation and activation either all succeed or all roll back.
 */
export async function createPaidOrder(
  client: PrismaClient,
  input: CreatePaidOrderInput,
): Promise<CreatePaidOrderResult> {
  const paymentKey = `order-wallet-payment:${input.idempotencyKey}`;
  const orderNumber = `SL-ORD-${Date.now().toString().slice(-8)}-${randomUUID()
    .slice(0, 4)
    .toUpperCase()}`;

  const replay = async (
    db: { wallet: PrismaClient["wallet"] },
    order: {
      id: string;
      orderNumber: string;
      totalPaisa: bigint;
      addressSnapshot: unknown;
    },
  ): Promise<CreatePaidOrderResult> => {
    const wallet = await db.wallet.findUnique({
      where: { memberId: input.memberId },
      select: { availablePaisa: true },
    });
    return {
      order: { id: order.id, orderNumber: order.orderNumber },
      activated: false,
      availablePaisa: wallet?.availablePaisa ?? 0n,
      totalPaisa: order.totalPaisa,
      addressSnapshot: order.addressSnapshot as PurchaseAddressSnapshot,
      duplicate: true,
    };
  };

  // A completed replay returns the original order. Only a ledger entry without
  // its order is an inconsistent duplicate and must be rejected.
  const existingRequest = await client.order.findUnique({
    where: { requestKey: input.idempotencyKey },
    select: { id: true, orderNumber: true, totalPaisa: true, addressSnapshot: true },
  });
  if (existingRequest) return replay(client, existingRequest);
  if (await hasLedgerEntry(client, paymentKey)) throw purchaseError("DUPLICATE_REQUEST");

  const totalPaisa = input.items.reduce(
    (sum, item) => sum + item.unitPricePaisa * BigInt(item.quantity),
    0n,
  );
  if (totalPaisa <= 0n) throw purchaseError("INVALID_ORDER_TOTAL");
  if (input.items.length === 0) throw purchaseError("CART_EMPTY");

  try {
    const result = await client.$transaction(async (tx) => {
      const claimedRequest = await tx.order.findUnique({
        where: { requestKey: input.idempotencyKey },
        select: { id: true, orderNumber: true, totalPaisa: true, addressSnapshot: true },
      });
      if (claimedRequest) return replay(tx, claimedRequest);
      if (await hasLedgerEntry(tx, paymentKey)) throw purchaseError("DUPLICATE_REQUEST");

      for (const item of input.items) {
        if (!item.dbProduct) continue;
        const claimed = await tx.product.updateMany({
          where: { id: item.dbProduct.id, stock: { gte: item.quantity } },
          data: { stock: { decrement: item.quantity } },
        });
        if (claimed.count === 0) throw purchaseError("INSUFFICIENT_STOCK");
      }

      const member = await tx.member.findUnique({
        where: { id: input.memberId, role: "MEMBER" },
        select: { status: true },
      });
      if (!member) throw purchaseError("MEMBER_NOT_FOUND");
      if (member.status === "SUSPENDED") throw purchaseError("MEMBER_SUSPENDED");
      if (input.fulfillment === "OFFICE_PICKUP" && member.status !== "INACTIVE") {
        throw purchaseError("ACTIVATION_NOT_ELIGIBLE");
      }
      if (input.fulfillment === "HOME_DELIVERY" && member.status !== "ACTIVE") {
        throw purchaseError("MEMBER_NOT_ACTIVE");
      }

      const wallet = await tx.wallet.findUnique({
        where: { memberId: input.memberId },
        select: { availablePaisa: true },
      });
      if (!wallet) throw purchaseError("WALLET_NOT_FOUND");

      let snapshot: PurchaseAddressSnapshot;
      if (input.address.mode === "office") {
        // Pickup orders never create or reuse a delivery address. The snapshot
        // records the member identity and the collection point only.
        snapshot = {
          id: null,
          label: "OFFICE",
          fullName: input.address.fullName,
          phone: input.address.phone,
          street: "SaveLife Office",
          thana: "",
          district: "",
          postalCode: "",
          country: "Bangladesh",
        };
      } else if (input.address.mode === "existing") {
        const address = await tx.address.findFirst({
          where: { id: input.address.addressId, memberId: input.memberId },
          select: {
            id: true,
            label: true,
            fullName: true,
            phone: true,
            street: true,
            thana: true,
            city: true,
            district: true,
            postalCode: true,
            country: true,
          },
        });
        if (!address) throw purchaseError("ADDRESS_NOT_FOUND");
        snapshot = {
          id: address.id,
          label: address.label ?? "OTHER",
          fullName: address.fullName,
          phone: address.phone,
          street: address.street,
          thana: address.thana ?? address.city,
          district: address.district ?? "",
          postalCode: address.postalCode ?? "",
          country: address.country,
        };
      } else {
        if (input.address.isMain) {
          await tx.address.updateMany({
            where: { memberId: input.memberId },
            data: { isDefault: false },
          });
        }
        const address = await tx.address.create({
          data: {
            memberId: input.memberId,
            label: input.address.label,
            fullName: input.address.fullName,
            phone: input.address.phone,
            street: input.address.street,
            // `city` is kept for legacy address views; `thana` is the canonical field.
            city: input.address.thana,
            thana: input.address.thana,
            district: input.address.district,
            postalCode: input.address.postalCode,
            country: "Bangladesh",
            isDefault: input.address.isMain,
          },
          select: { id: true },
        });
        snapshot = {
          id: address.id,
          label: input.address.label,
          fullName: input.address.fullName,
          phone: input.address.phone,
          street: input.address.street,
          thana: input.address.thana,
          district: input.address.district,
          postalCode: input.address.postalCode,
          country: "Bangladesh",
        };
      }

      // The wallet read above proves existence only; the conditional debit is
      // the authority to spend and rolls back the stock claim when it loses.
      const debited = await debitWalletFieldIfSufficient(
        tx,
        input.memberId,
        "availablePaisa",
        totalPaisa,
      );
      if (!debited) throw purchaseError("INSUFFICIENT_BALANCE");

      const isPickup = input.fulfillment === "OFFICE_PICKUP";
      const statusNote = isPickup
        ? "Paid with available balance — office pickup"
        : "Paid with available balance";

      const order = await tx.order.create({
        data: {
          orderNumber,
          memberId: input.memberId,
          status: "CONFIRMED",
          fulfillmentType: input.fulfillment,
          pickupStatus: isPickup ? "PENDING" : null,
          requestKey: input.idempotencyKey,
          addressSnapshot: snapshot,
          subtotalPaisa: totalPaisa,
          shippingPaisa: 0n,
          discountPaisa: 0n,
          totalPaisa,
          notes: input.notes,
          items: {
            create: input.items.map((item) => ({
              productId: item.productId,
              productName: item.productName,
              productImage: item.productImage,
              unitPricePaisa: item.unitPricePaisa,
              quantity: item.quantity,
              lineTotalPaisa: item.unitPricePaisa * BigInt(item.quantity),
            })),
          },
          statusHistory: { create: { toStatus: "CONFIRMED", note: statusNote } },
          paymentProofs: {
            create: {
              memberId: input.memberId,
              method: "WALLET",
              transactionRef: paymentKey,
              amountPaisa: totalPaisa,
              imageUrl: null,
              status: "APPROVED",
              note: "Paid from available balance",
              reviewedBy: input.memberId,
              reviewedAt: new Date(),
            },
          },
        },
        select: { id: true, orderNumber: true },
      });

      await recordLedgerEntry(tx, {
        walletId: debited.walletId,
        memberId: input.memberId,
        category: Category.AVAILABLE,
        direction: "DEBIT",
        amountPaisa: totalPaisa,
        balanceAfterPaisa: debited.balanceAfterPaisa,
        type: LedgerType.ORDER_WALLET_PAYMENT,
        idempotencyKey: paymentKey,
        referenceType: "Order",
        referenceId: order.orderNumber,
        createdBy: input.memberId,
      });

      let activated = false;
      if (isPickup) {
        const existingActivation = await tx.activationHistory.findUnique({
          where: { memberId: input.memberId },
          select: { id: true },
        });
        await tx.member.update({
          where: { id: input.memberId },
          data: { status: "ACTIVE", activationDate: new Date() },
        });
        if (!existingActivation) {
          await tx.activationHistory.create({
            data: {
              memberId: input.memberId,
              orderId: order.id,
              activatedBy: input.memberId,
              note: "Activated by store purchase",
            },
          });
        }
        activated = true;
      }

      return {
        order,
        activated,
        availablePaisa: debited.balanceAfterPaisa,
        totalPaisa,
        addressSnapshot: snapshot,
        duplicate: false,
      };
    });

    return {
      order: result.order,
      activated: result.activated,
      availablePaisa: result.availablePaisa,
      totalPaisa: result.totalPaisa,
      addressSnapshot: result.addressSnapshot,
      duplicate: result.duplicate,
    };
  } catch (error) {
    const duplicate = error instanceof Error && error.message === "DUPLICATE_REQUEST";
    if (duplicate || isUniqueViolation(error)) {
      const raced = await client.order.findUnique({
        where: { requestKey: input.idempotencyKey },
        select: { id: true, orderNumber: true, totalPaisa: true, addressSnapshot: true },
      });
      if (raced) return replay(client, raced);
      throw purchaseError("DUPLICATE_REQUEST");
    }
    throw error;
  }
}
