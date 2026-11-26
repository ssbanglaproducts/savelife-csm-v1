import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { writeAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { notifyStatusChanged } from "@/lib/services/notification-events";

export const dynamic = "force-dynamic";

const schema = z.object({
  action: z.enum(["DEACTIVATE", "REACTIVATE", "ACTIVATE"]),
  note: z.string().trim().max(500).optional(),
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
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Please check the values" }, { status: 400 });
  }

  const { action } = parsed.data;
  const note = parsed.data.note?.trim() || null;
  if (action === "DEACTIVATE" && !note) {
    return NextResponse.json({ error: "NOTE_REQUIRED" }, { status: 400 });
  }

  const existing = await prisma.member.findUnique({
    where: { id },
    select: { status: true, deactivationNote: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "MEMBER_NOT_FOUND" }, { status: 404 });
  }

  const updated = await prisma.member.update({
    where: { id },
    data:
      action === "DEACTIVATE"
        ? { status: "SUSPENDED", deactivationNote: note }
        : { status: "ACTIVE", deactivationNote: null },
    select: { memberId: true, status: true, deactivationNote: true },
  });

  await notifyStatusChanged(id, updated.status, updated.deactivationNote);

  await writeAuditLog({
    actorId: session.user.id,
    actorRole: "ADMIN",
    action:
      action === "DEACTIVATE"
        ? "MEMBER_DEACTIVATED"
        : action === "ACTIVATE"
          ? "MEMBER_ACTIVATED"
          : "MEMBER_REACTIVATED",
    entityType: "Member",
    entityId: id,
    before: { status: existing.status, note: existing.deactivationNote },
    after: { status: updated.status, note: updated.deactivationNote },
  });

  return NextResponse.json({ memberId: updated.memberId, status: updated.status });
}
