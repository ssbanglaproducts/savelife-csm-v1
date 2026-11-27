import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { writeAuditLog } from "@/lib/audit";
import { clearCart, getCartSummary } from "@/lib/cart";
import { rejectInactiveCartAccess } from "@/lib/cart-access";
import { prisma } from "@/lib/prisma";
import { ServiceError, invalidInput } from "@/lib/services/errors";
import { notifyOrderConfirmed } from "@/lib/services/notification-events";
import {
  debitWalletFieldIfSufficient,
  hasLedgerEntry,
  isUniqueViolation,
  recordLedgerEntry,
} from "@/lib/services/ledger";
import {
  LedgerEntryType as LedgerType,
  WalletCategory as Category,
} from "@/generated/prisma/enums";
import { verifyMemberTPin } from "@/lib/tpin";

export const dynamic = "force-dynamic";

const checkoutSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  phone: z.string().trim().min(8).max(30),
  street: z.string().trim().min(3).max(200),
  city: z.string().trim().min(2).max(80),
  district: z.string().trim().max(80).optional().default(""),
  postalCode: z.string().trim().max(20).optional().default(""),
  notes: z.string().trim().max(500).optional().default(""),
  tPin: z.string(),
  locale: z.enum(["en", "bn"]).optional().default("en"),
  idempotencyKey: z.string().trim().min(8).max(200).optional(),
});

function errorResponse(code: string, status: number) {
  return NextResponse.json({ error: code }, { status });
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return errorResponse("LOGIN_REQUIRED", 401);
  if (session.user.role !== "MEMBER") return errorResponse("FORBIDDEN", 403);

  const blocked = await rejectInactiveCartAccess();
  if (blocked) return blocked;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse("Invalid request", 400);
  }

  const parsed = checkoutSchema.safeParse(body);
  if (!parsed.success) return errorResponse("Please check the form details", 400);

  const tPin = await verifyMemberTPin(session.user.id, parsed.data.tPin);
  if (!tPin.ok) return errorResponse(tPin.code, 400);

  const cart = await getCartSummary();
  if (cart.lines.length === 0) return errorResponse("CART_EMPTY", 400);

  const data = parsed.data;
  const idempotencyKey =
    data.idempotencyKey ??
    `${session.user.id}:order:${Date.now()}:${randomUUID()}`;
  const paymentKey = `order-wallet-payment:${idempotencyKey}`;
  const orderNumber = `SL-ORD-${Date.now().toString().slice(-8)}-${randomUUID()
    .slice(0, 4)
    .toUpperCase()}`;

  if (await hasLedgerEntry(prisma, paymentKey)) {
    return errorResponse("DUPLICATE_REQUEST", 409);
  }

  try {
    const dbProducts = await prisma.product.findMany({
      where: { id: { in: cart.lines.map((line) => line.productId) } },
      select: { id: true, name: true, nameBn: true, pricePaisa: true, stock: true, isActive: true },
    });
    const productById = new Map(dbProducts.map((product) => [product.id, product]));

    const pricedItems = cart.lines.map((line) => {
      const product = productById.get(line.productId);

      if (product && !product.isActive) throw new Error("PRODUCT_UNAVAILABLE");
      if (product && product.stock < line.quantity) throw new Error("INSUFFICIENT_STOCK");

      const unitPrice = product?.pricePaisa ?? BigInt(line.unitPricePaisa);
      const lineTotal = unitPrice * BigInt(line.quantity);

      return {
        productId: product?.id ?? null,
        productName:
          data.locale === "bn"
            ? product?.nameBn || product?.name || line.nameBn || line.name
            : product?.name || product?.nameBn || line.name || line.nameBn || "Product",
        productImage: line.image,
        unitPricePaisa: unitPrice,
        quantity: line.quantity,
        lineTotalPaisa: lineTotal,
        dbProduct: product ?? null,
      };
    });

    const subtotal = pricedItems.reduce((sum, item) => sum + item.lineTotalPaisa, 0n);
    if (subtotal <= 0n) throw invalidInput("Order total must be positive");

    const result = await prisma.$transaction(async (tx) => {
      if (await hasLedgerEntry(tx, paymentKey)) throw new Error("DUPLICATE_REQUEST");

      for (const item of pricedItems) {
        if (!item.dbProduct) continue;
        const claimed = await tx.product.updateMany({
          where: { id: item.dbProduct.id, stock: { gte: item.quantity } },
          data: { stock: { decrement: item.quantity } },
        });
        if (claimed.count === 0) throw new Error("INSUFFICIENT_STOCK");
      }

      const member = await tx.member.findFirst({
        where: { id: session.user.id, role: "MEMBER" },
        select: { status: true },
      });
      if (!member) throw new Error("MEMBER_NOT_FOUND");
      if (member.status === "SUSPENDED") throw new Error("MEMBER_SUSPENDED");

      const wallet = await tx.wallet.findUnique({
        where: { memberId: session.user.id },
        select: { availablePaisa: true },
      });
      if (!wallet) throw new Error("WALLET_NOT_FOUND");

      // Existence was read above; spending is authorized only by this
      // conditional update, which cannot be won by two concurrent checkouts.
      const debited = await debitWalletFieldIfSufficient(
        tx,
        session.user.id,
        "availablePaisa",
        subtotal,
      );
      if (!debited) throw new Error("INSUFFICIENT_BALANCE");

      const address = await tx.address.create({
        data: {
          memberId: session.user.id,
          fullName: data.fullName,
          phone: data.phone,
          street: data.street,
          city: data.city,
          district: data.district,
          postalCode: data.postalCode,
          isDefault: false,
        },
      });

      const order = await tx.order.create({
        data: {
          orderNumber,
          memberId: session.user.id,
          status: "CONFIRMED",
          addressSnapshot: {
            id: address.id,
            fullName: data.fullName,
            phone: data.phone,
            street: data.street,
            city: data.city,
            district: data.district,
            postalCode: data.postalCode,
            country: "Bangladesh",
          },
          subtotalPaisa: subtotal,
          shippingPaisa: 0n,
          discountPaisa: 0n,
          totalPaisa: subtotal,
          notes: data.notes,
          items: {
            create: pricedItems.map((item) => ({
              productId: item.productId,
              productName: item.productName,
              productImage: item.productImage,
              unitPricePaisa: item.unitPricePaisa,
              quantity: item.quantity,
              lineTotalPaisa: item.lineTotalPaisa,
            })),
          },
          statusHistory: {
            create: {
              toStatus: "CONFIRMED",
              note: "Paid with available balance",
            },
          },
          paymentProofs: {
            create: {
              memberId: session.user.id,
              method: "WALLET",
              transactionRef: paymentKey,
              amountPaisa: subtotal,
              imageUrl: null,
              status: "APPROVED",
              note: "Paid from available balance",
              reviewedBy: session.user.id,
              reviewedAt: new Date(),
            },
          },
        },
        select: { id: true, orderNumber: true },
      });

      await recordLedgerEntry(tx, {
        walletId: debited.walletId,
        memberId: session.user.id,
        category: Category.AVAILABLE,
        direction: "DEBIT",
        amountPaisa: subtotal,
        balanceAfterPaisa: debited.balanceAfterPaisa,
        type: LedgerType.ORDER_WALLET_PAYMENT,
        idempotencyKey: paymentKey,
        referenceType: "Order",
        referenceId: order.orderNumber,
        createdBy: session.user.id,
      });

      let activated = false;
      if (member.status === "INACTIVE") {
        const existingActivation = await tx.activationHistory.findUnique({
          where: { memberId: session.user.id },
          select: { id: true },
        });
        await tx.member.update({
          where: { id: session.user.id },
          data: { status: "ACTIVE", activationDate: new Date() },
        });
        if (!existingActivation) {
          await tx.activationHistory.create({
            data: {
              memberId: session.user.id,
              orderId: order.id,
              activatedBy: session.user.id,
              note: "Activated by first wallet purchase",
            },
          });
        }
        activated = true;
      }

      return {
        order,
        activated,
        availablePaisa: debited.balanceAfterPaisa,
        totalPaisa: subtotal,
      };
    });

    await clearCart();
    await notifyOrderConfirmed(session.user.id, result.order.orderNumber, result.activated);

    await writeAuditLog({
      actorId: session.user.id,
      actorRole: "MEMBER",
      action: result.activated ? "MEMBER_ACTIVATED_BY_ORDER" : "ORDER_PAID_WITH_WALLET",
      entityType: "Order",
      entityId: result.order.id,
      after: {
        orderNumber: result.order.orderNumber,
        amountPaisa: result.totalPaisa.toString(),
        activated: result.activated,
      },
    });

    return NextResponse.json(
      {
        order: result.order,
        activated: result.activated,
        availablePaisa: result.availablePaisa.toString(),
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof ServiceError) return errorResponse(error.code, 400);
    const message = error instanceof Error ? error.message : "CHECKOUT_FAILED";
    if (message === "DUPLICATE_REQUEST") return errorResponse("DUPLICATE_REQUEST", 409);
    if (message === "INSUFFICIENT_BALANCE") return errorResponse("INSUFFICIENT_BALANCE", 400);
    if (message === "WALLET_NOT_FOUND") return errorResponse("WALLET_NOT_FOUND", 404);
    if (message === "MEMBER_SUSPENDED") return errorResponse("MEMBER_SUSPENDED", 403);
    const known = ["PRODUCT_UNAVAILABLE", "INSUFFICIENT_STOCK"].includes(message);
    if (!known && !isUniqueViolation(error)) console.error("Checkout failed", error);
    if (isUniqueViolation(error) && (await hasLedgerEntry(prisma, paymentKey))) {
      return errorResponse("DUPLICATE_REQUEST", 409);
    }
    return errorResponse(known ? message : "CHECKOUT_FAILED", known ? 409 : 500);
  }
}
