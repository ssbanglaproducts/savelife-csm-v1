import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { requireAdminApiSession } from "@/lib/admin-access";
import { writeAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { isTPin } from "@/lib/tpin";
import { notifyTPinReset } from "@/lib/services/notification-events";

export const dynamic = "force-dynamic";

const schema = z.object({
  newTPin: z.string(),
  confirmTPin: z.string(),
  note: z.string().trim().min(3).max(500),
});

function error(code: string, status: number) {
  return NextResponse.json({ error: code }, { status });
}

/** Administrator-assisted T-PIN reset. The new PIN is never returned. */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await requireAdminApiSession("members.manage");
  if (!session) {
    return error("FORBIDDEN", 403);
  }

  const { id } = await context.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return error("INVALID_REQUEST", 400);
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    const pinIssue = parsed.error.issues.some((issue) =>
      ["newTPin", "confirmTPin"].includes(String(issue.path[0])),
    );
    return error(pinIssue ? "INVALID_TPIN" : "NOTE_REQUIRED", 400);
  }

  const { newTPin, confirmTPin, note } = parsed.data;
  if (!isTPin(newTPin) || newTPin !== confirmTPin) {
    return error("TPIN_MISMATCH", 400);
  }

  const member = await prisma.member.findFirst({
    where: { id, role: "MEMBER" },
    select: { memberId: true, tPinHash: true },
  });
  if (!member) return error("MEMBER_NOT_FOUND", 404);
  if (member.tPinHash && (await bcrypt.compare(newTPin, member.tPinHash))) {
    return error("TPIN_UNCHANGED", 400);
  }

  const tPinHash = await bcrypt.hash(newTPin, 12);
  await prisma.member.update({
    where: { id },
    data: { tPinHash, tPinUpdatedAt: new Date() },
  });

  await notifyTPinReset(id, note);

  await writeAuditLog({
    actorId: session.user.id,
    actorRole: session.user.role,
    action: "MEMBER_TPIN_RESET_BY_ADMIN",
    entityType: "Member",
    entityId: id,
    before: { hasTPin: Boolean(member.tPinHash) },
    after: { hasTPin: true, note },
  });

  return NextResponse.json({ memberId: member.memberId, ok: true });
}
