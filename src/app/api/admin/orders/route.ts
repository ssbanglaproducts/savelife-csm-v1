import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminApiSession } from "@/lib/admin-access";
import { writeAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { notifyOrderStatus } from "@/lib/services/notification-events";

export const dynamic = "force-dynamic";

const deliveryTransitions: Record<string, readonly string[]> = {
  PENDING: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["PROCESSING", "CANCELLED"],
  PROCESSING: ["SHIPPED", "CANCELLED"],
  SHIPPED: ["OUT_FOR_DELIVERY", "DELIVERED", "RETURNED"],
  OUT_FOR_DELIVERY: ["DELIVERED", "RETURNED"],
  DELIVERED: ["RETURNED"],
  CANCELLED: [],
  RETURNED: [],
};

const schema = z.object({
  orderId: z.string().min(1),
  status: z
    .enum([
      "PENDING",
      "CONFIRMED",
      "PROCESSING",
      "SHIPPED",
      "OUT_FOR_DELIVERY",
      "DELIVERED",
      "CANCELLED",
      "RETURNED",
      "PICKED_UP",
    ])
    .optional(),
  note: z.string().trim().max(300).optional().default(""),
  courierName: z.string().trim().max(80).nullable().optional(),
  trackingNumber: z.string().trim().max(80).nullable().optional(),
  trackingUrl: z.url({ protocol: /^https?$/ }).max(500).nullable().optional(),
});

async function isAdmin() {
  return requireAdminApiSession("orders.manage");
}

export async function PATCH(request: Request) {
  const admin = await isAdmin();
  if (!admin?.user?.id) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success || (!parsed.data.status && !parsed.data.courierName && !parsed.data.trackingNumber && !parsed.data.trackingUrl)) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const { orderId, status, note, courierName, trackingNumber, trackingUrl } = parsed.data;

  try {
    const result = await prisma.$transaction(async (tx) => {
      const current = await tx.order.findUnique({
        where: { id: orderId },
        select: {
          status: true,
          memberId: true,
          fulfillmentType: true,
          pickupStatus: true,
        },
      });
      if (!current) return null;

      const isPickup = current.fulfillmentType === "OFFICE_PICKUP";
      const hasTrackingUpdate =
        courierName !== undefined || trackingNumber !== undefined || trackingUrl !== undefined;

      if (isPickup) {
        // Pickup orders have exactly one admin action and never accept courier data.
        if (status !== "PICKED_UP" || hasTrackingUpdate) {
          return { invalidTransition: true } as const;
        }
        if (current.pickupStatus !== "PENDING") {
          return { invalidTransition: true } as const;
        }

        const pickedUpOrder = await tx.order.update({
          where: { id: orderId },
          data: { pickupStatus: "PICKED_UP" },
          select: { id: true, orderNumber: true, memberId: true },
        });
        await tx.orderStatusHistory.create({
          data: {
            orderId,
            fromStatus: current.status,
            toStatus: "PICKED_UP",
            note: note || "Product collected from office",
            changedBy: admin.user.id,
          },
        });

        return {
          order: pickedUpOrder,
          previousStatus: current.status,
          notificationStatus: "PICKED_UP",
          invalidTransition: false,
        } as const;
      }

      // Home delivery orders cannot be marked picked up.
      if (status === "PICKED_UP") return { invalidTransition: true } as const;
      if (status && !(deliveryTransitions[current.status] ?? []).includes(status)) {
        return { invalidTransition: true } as const;
      }

      const order = await tx.order.update({
        where: { id: orderId },
        data: {
          ...(status ? { status } : {}),
          ...(hasTrackingUpdate
            ? {
                ...(courierName !== undefined ? { courierName } : {}),
                ...(trackingNumber !== undefined ? { trackingNumber } : {}),
                ...(trackingUrl !== undefined ? { trackingUrl } : {}),
              }
            : {}),
        },
        select: { id: true, orderNumber: true, memberId: true },
      });

      if (status) {
        await tx.orderStatusHistory.create({
          data: {
            orderId,
            fromStatus: current.status,
            toStatus: status,
            note: note || null,
            changedBy: admin.user.id,
          },
        });
      }

      if (status === "DELIVERED") {
        const approvedProof = await tx.paymentProof.findFirst({
          where: { orderId, status: "APPROVED" },
          select: { id: true },
        });

        if (approvedProof) {
          const existingActivation = await tx.activationHistory.findUnique({
            where: { memberId: order.memberId },
            select: { id: true },
          });

          if (!existingActivation) {
            await tx.activationHistory.create({
              data: {
                memberId: order.memberId,
                orderId,
                activatedBy: admin.user.id,
                note: "Delivered order with approved payment proof",
              },
            });

            await tx.member.update({
              where: { id: order.memberId },
              data: { status: "ACTIVE", activationDate: new Date() },
            });
          }
        }
      }

      return {
        order,
        previousStatus: current.status,
        notificationStatus: status ?? "PROCESSING",
        invalidTransition: false,
      } as const;
    });

    if (!result) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    if (result.invalidTransition) return NextResponse.json({ error: "INVALID_STATE" }, { status: 409 });

    await notifyOrderStatus(
      result.order.memberId,
      result.order.orderNumber || result.order.id,
      result.notificationStatus,
    );

    await writeAuditLog({
      actorId: admin.user.id,
      actorRole: admin.user.role,
      action: status === "PICKED_UP" ? "ORDER_PICKED_UP" : "ORDER_STATUS_UPDATED",
      entityType: "Order",
      entityId: result.order.id,
      before: { status: result.previousStatus },
      after: {
        status: status ?? "TRACKING_UPDATED",
        courierName: courierName ?? null,
        trackingNumber: trackingNumber ?? null,
        trackingUrl: trackingUrl ?? null,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Admin order update failed", error);
    return NextResponse.json({ error: "UPDATE_FAILED" }, { status: 500 });
  }
}
