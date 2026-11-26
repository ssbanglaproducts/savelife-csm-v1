import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { writeAuditLog } from "@/lib/audit";
import { clearCart, getCartSummary } from "@/lib/cart";
import { rejectInactiveCartAccess } from "@/lib/cart-access";
import { prisma } from "@/lib/prisma";
import { notifyOrderConfirmed } from "@/lib/services/notification-events";
import { createPaidOrder, type PricedPurchaseItem } from "@/lib/services/purchase";
import { verifyMemberTPin } from "@/lib/tpin";

export const dynamic = "force-dynamic";

const checkoutSchema = z.object({
  addressId: z.string().min(1).optional(),
  addressLabel: z.enum(["HOME", "OFFICE", "PERSONAL", "OTHER"]).optional(),
  fullAddress: z.string().trim().min(3).max(200).optional(),
  thana: z.string().trim().min(1).max(80).optional(),
  district: z.string().trim().min(1).max(80).optional(),
  postalCode: z.string().trim().max(20).optional(),
  useAsMain: z.boolean().optional().default(false),
  notes: z.string().trim().max(500).optional().default(""),
  tPin: z.string(),
  idempotencyKey: z.string().trim().min(8).max(200),
  locale: z.enum(["en", "bn"]).optional().default("en"),
});

const errorStatus: Record<string, number> = {
  DUPLICATE_REQUEST: 409,
  INSUFFICIENT_BALANCE: 400,
  INSUFFICIENT_STOCK: 409,
  CART_EMPTY: 400,
  MEMBER_NOT_ACTIVE: 403,
  MEMBER_SUSPENDED: 403,
  ADDRESS_NOT_FOUND: 404,
  ADDRESS_REQUIRED: 400,
  INVALID_ORDER_TOTAL: 400,
};

function errorResponse(code: string, status = errorStatus[code] ?? 400) {
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
  if (!parsed.success) return errorResponse("Invalid request", 400);
  const data = parsed.data;

  if (!data.addressId && (!data.fullAddress || !data.thana || !data.district)) {
    return errorResponse("ADDRESS_REQUIRED");
  }

  const tPin = await verifyMemberTPin(session.user.id, data.tPin);
  if (!tPin.ok) return errorResponse(tPin.code);

  const member = await prisma.member.findUnique({
    where: { id: session.user.id },
    select: { status: true, fullName: true, phone: true },
  });
  if (!member) return errorResponse("MEMBER_NOT_FOUND", 404);
  if (member.status !== "ACTIVE") return errorResponse("MEMBER_NOT_ACTIVE", 403);

  const cart = await getCartSummary();
  if (cart.lines.length === 0) return errorResponse("CART_EMPTY");

  const dbProducts = await prisma.product.findMany({
    where: { id: { in: cart.lines.map((line) => line.productId) } },
    select: {
      id: true,
      name: true,
      nameBn: true,
      pricePaisa: true,
      stock: true,
      isActive: true,
      images: { orderBy: { sortOrder: "asc" }, take: 1, select: { url: true } },
    },
  });
  const byId = new Map(dbProducts.map((product) => [product.id, product]));

  const items: PricedPurchaseItem[] = [];
  for (const line of cart.lines) {
    const product = byId.get(line.productId);
    if (!product || !product.isActive || product.stock < line.quantity) {
      return errorResponse("PRODUCT_UNAVAILABLE", 409);
    }
    items.push({
      productId: product.id,
      productName: data.locale === "bn" ? product.nameBn || product.name : product.name,
      productImage: product.images[0]?.url ?? null,
      unitPricePaisa: product.pricePaisa,
      quantity: line.quantity,
      dbProduct: { id: product.id, stock: product.stock },
    });
  }

  const address =
    data.addressId !== undefined
      ? ({ mode: "existing", addressId: data.addressId } as const)
      : ({
          mode: "new",
          label: data.addressLabel ?? "OTHER",
          fullName: member.fullName,
          phone: member.phone,
          street: data.fullAddress!,
          thana: data.thana!,
          district: data.district!,
          postalCode: data.postalCode ?? "",
          isMain: data.useAsMain ?? false,
        } as const);

  try {
    const result = await createPaidOrder(prisma, {
      memberId: session.user.id,
      fulfillment: "HOME_DELIVERY",
      idempotencyKey: data.idempotencyKey,
      address,
      notes: data.notes,
      items,
    });

    if (!result.duplicate) {
      await clearCart();
      await notifyOrderConfirmed(session.user.id, result.order.orderNumber, false);
      await writeAuditLog({
        actorId: session.user.id,
        actorRole: "MEMBER",
        action: "ORDER_PAID_WITH_WALLET",
        entityType: "Order",
        entityId: result.order.id,
        after: {
          orderNumber: result.order.orderNumber,
          amountPaisa: result.totalPaisa.toString(),
          fulfillment: "HOME_DELIVERY",
          itemCount: items.length,
        },
      });
    }

    return NextResponse.json(
      {
        order: result.order,
        activated: false,
        availablePaisa: result.availablePaisa.toString(),
        fulfillment: "HOME_DELIVERY",
        duplicate: result.duplicate,
      },
      { status: result.duplicate ? 200 : 201 },
    );
  } catch (error) {
    const code = error instanceof Error ? error.message : "PURCHASE_FAILED";
    console.error("Cart checkout failed", error);
    return errorResponse(code);
  }
}
