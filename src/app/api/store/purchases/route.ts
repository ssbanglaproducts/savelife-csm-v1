import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { writeAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { verifyMemberTPin } from "@/lib/tpin";
import { notifyOrderConfirmed } from "@/lib/services/notification-events";
import { createPaidOrder } from "@/lib/services/purchase";

export const dynamic = "force-dynamic";

const purchaseSchema = z.object({
  flow: z.enum(["ACTIVATION", "DELIVERY"]),
  productId: z.string().min(1),
  quantity: z.number().int().min(1).max(999).optional().default(1),
  tPin: z.string(),
  idempotencyKey: z.string().trim().min(8).max(200),
  locale: z.enum(["en", "bn"]).optional().default("en"),
  addressId: z.string().min(1).optional(),
  addressLabel: z.enum(["HOME", "OFFICE", "PERSONAL", "OTHER"]).optional(),
  fullAddress: z.string().trim().min(3).max(200).optional(),
  thana: z.string().trim().min(1).max(80).optional(),
  district: z.string().trim().min(1).max(80).optional(),
  postalCode: z.string().trim().max(20).optional(),
  useAsMain: z.boolean().optional().default(false),
});

const errorStatus: Record<string, number> = {
  DUPLICATE_REQUEST: 409,
  INSUFFICIENT_BALANCE: 400,
  INSUFFICIENT_STOCK: 409,
  PRODUCT_UNAVAILABLE: 409,
  ACTIVATION_NOT_ELIGIBLE: 409,
  MEMBER_NOT_ACTIVE: 403,
  MEMBER_SUSPENDED: 403,
  MEMBER_NOT_FOUND: 404,
  WALLET_NOT_FOUND: 404,
  ADDRESS_NOT_FOUND: 404,
  INVALID_ORDER_TOTAL: 400,
  LOGIN_REQUIRED: 401,
};

function errorResponse(code: string, status = errorStatus[code] ?? 400) {
  return NextResponse.json({ error: code }, { status });
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return errorResponse("LOGIN_REQUIRED", 401);
  if (session.user.role !== "MEMBER") return errorResponse("FORBIDDEN", 403);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse("Invalid request", 400);
  }

  const parsed = purchaseSchema.safeParse(body);
  if (!parsed.success) return errorResponse("Invalid request", 400);
  const data = parsed.data;

  if (data.flow === "DELIVERY" && !data.addressId && (!data.fullAddress || !data.thana || !data.district)) {
    return errorResponse("ADDRESS_REQUIRED", 400);
  }

  const tPin = await verifyMemberTPin(session.user.id, data.tPin);
  if (!tPin.ok) return errorResponse(tPin.code, 400);

  const [member, product] = await Promise.all([
    prisma.member.findUnique({
      where: { id: session.user.id },
      select: { fullName: true, phone: true, status: true },
    }),
    prisma.product.findUnique({
      where: { id: data.productId },
      select: {
        id: true,
        name: true,
        nameBn: true,
        pricePaisa: true,
        stock: true,
        isActive: true,
        images: { orderBy: { sortOrder: "asc" }, take: 1, select: { url: true } },
      },
    }),
  ]);

  if (!member) return errorResponse("MEMBER_NOT_FOUND", 404);
  if (member.status === "SUSPENDED") return errorResponse("MEMBER_SUSPENDED", 403);
  if (!product || !product.isActive || product.stock <= 0) return errorResponse("PRODUCT_UNAVAILABLE", 409);
  if (data.quantity > product.stock) return errorResponse("INSUFFICIENT_STOCK", 409);
  if (data.flow === "ACTIVATION") {
    if (member.status !== "INACTIVE") return errorResponse("ACTIVATION_NOT_ELIGIBLE", 409);
  } else if (member.status !== "ACTIVE") {
    return errorResponse("MEMBER_NOT_ACTIVE", 403);
  }

  const address =
    data.flow === "ACTIVATION"
      ? ({ mode: "office", fullName: member.fullName, phone: member.phone } as const)
      : data.addressId !== undefined
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

  const itemName = data.locale === "bn" ? product.nameBn || product.name : product.name;

  try {
    const result = await createPaidOrder(prisma, {
      memberId: session.user.id,
      fulfillment: data.flow === "ACTIVATION" ? "OFFICE_PICKUP" : "HOME_DELIVERY",
      idempotencyKey: data.idempotencyKey,
      address,
      items: [
        {
          productId: product.id,
          productName: itemName,
          productImage: product.images[0]?.url ?? null,
          unitPricePaisa: product.pricePaisa,
          quantity: data.quantity,
          dbProduct: { id: product.id, stock: product.stock },
        },
      ],
    });

    if (!result.duplicate) {
      await notifyOrderConfirmed(session.user.id, result.order.orderNumber, result.activated);
      await writeAuditLog({
        actorId: session.user.id,
        actorRole: "MEMBER",
        action: result.activated ? "MEMBER_ACTIVATED_BY_PURCHASE" : "ORDER_PAID_WITH_WALLET",
        entityType: "Order",
        entityId: result.order.id,
        after: {
          orderNumber: result.order.orderNumber,
          amountPaisa: result.totalPaisa.toString(),
          fulfillment: data.flow === "ACTIVATION" ? "OFFICE_PICKUP" : "HOME_DELIVERY",
          activated: result.activated,
        },
      });
    }

    return NextResponse.json(
      {
        order: result.order,
        activated: result.activated,
        availablePaisa: result.availablePaisa.toString(),
        fulfillment: data.flow === "ACTIVATION" ? "OFFICE_PICKUP" : "HOME_DELIVERY",
        duplicate: result.duplicate,
      },
      { status: result.duplicate ? 200 : 201 },
    );
  } catch (error) {
    const code = error instanceof Error ? error.message : "PURCHASE_FAILED";
    console.error("Purchase failed", error);
    return errorResponse(code);
  }
}
