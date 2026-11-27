import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { writeAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import {
  getPlacementSlots,
  isInPlacementSubtree,
  isPlacementConflictError,
  isPlacementSlot,
} from "@/lib/services/placement";

export const dynamic = "force-dynamic";

const schema = z.object({
  placementMemberId: z.string().trim().min(5).max(20),
  placementSlot: z.number().int().refine(isPlacementSlot, "Invalid placement slot"),
});

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  const { id } = await context.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "INVALID_REQUEST" }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "INVALID_REQUEST" }, { status: 400 });
  }

  const { placementMemberId, placementSlot } = parsed.data;

  try {
    const result = await prisma.$transaction(async (tx) => {
      const member = await tx.member.findUnique({
        where: { id },
        select: {
          id: true,
          memberId: true,
          sponsorId: true,
          placementParentId: true,
          placementSlot: true,
        },
      });
      if (!member) throw new Error("MEMBER_NOT_FOUND");
      if (!member.sponsorId) throw new Error("INVALID_PLACEMENT_MOVE");

      const parent = await tx.member.findUnique({
        where: { memberId: placementMemberId.trim().toUpperCase() },
        select: { id: true, memberId: true, status: true, role: true },
      });
      if (!parent || parent.role === "ADMIN" || parent.status !== "ACTIVE") {
        throw new Error("INVALID_PLACEMENT_MOVE");
      }

      const inSponsorNetwork = await isInPlacementSubtree(tx, member.sponsorId, parent.id);
      const createsCycle = await isInPlacementSubtree(tx, member.id, parent.id);
      if (!inSponsorNetwork || createsCycle) throw new Error("INVALID_PLACEMENT_MOVE");

      const slots = await getPlacementSlots(tx, parent.id);
      const taken = slots.find((row) => row.slot === placementSlot)?.occupied;
      const unchanged = member.placementParentId === parent.id && member.placementSlot === placementSlot;
      if (taken && !unchanged) throw new Error("PLACEMENT_SLOT_UNAVAILABLE");

      if (!unchanged) {
        await tx.member.update({
          where: { id: member.id },
          data: { placementParentId: parent.id, placementSlot },
        });
      }

      return {
        memberId: member.memberId,
        placementMemberId: parent.memberId,
        placementSlot,
        previousParentId: member.placementParentId,
        previousSlot: member.placementSlot,
        unchanged,
      };
    });

    if (!result.unchanged) {
      await writeAuditLog({
        actorId: session.user.id,
        actorRole: "ADMIN",
        action: "MEMBER_PLACEMENT_MOVED",
        entityType: "Member",
        entityId: id,
        before: {
          placementParentId: result.previousParentId,
          placementSlot: result.previousSlot,
        },
        after: {
          placementParentId: result.placementMemberId,
          placementSlot: result.placementSlot,
        },
      });
    }

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof Error && error.message === "MEMBER_NOT_FOUND") {
      return NextResponse.json({ error: "MEMBER_NOT_FOUND" }, { status: 404 });
    }
    if (
      error instanceof Error &&
      (error.message === "INVALID_PLACEMENT_MOVE" || error.message === "PLACEMENT_SLOT_UNAVAILABLE")
    ) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (isPlacementConflictError(error)) {
      return NextResponse.json({ error: "PLACEMENT_SLOT_UNAVAILABLE" }, { status: 409 });
    }
    console.error("Placement move failed", error);
    return NextResponse.json({ error: "PLACEMENT_MOVE_FAILED" }, { status: 500 });
  }
}
