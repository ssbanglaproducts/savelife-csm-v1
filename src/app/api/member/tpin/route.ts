import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { writeAuditLog } from "@/lib/audit";
import { activeMemberErrorResponse, requireActiveMemberApi } from "@/lib/member-access";
import { prisma } from "@/lib/prisma";
import { isTPin } from "@/lib/tpin";

export const dynamic = "force-dynamic";

const schema = z.object({
  currentPassword: z.string().min(1),
  newTPin: z.string(),
  confirmTPin: z.string(),
});

function error(code: string, status: number) {
  return NextResponse.json({ error: code }, { status });
}

/** Members replace their own withdrawal T-PIN after proving their password. */
export async function POST(request: Request) {
  const access = await requireActiveMemberApi();
  if (!access.ok) return activeMemberErrorResponse(access);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return error("INVALID_REQUEST", 400);
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) return error("INVALID_TPIN", 400);

  const { currentPassword, newTPin, confirmTPin } = parsed.data;
  if (!isTPin(newTPin) || newTPin !== confirmTPin) {
    return error("TPIN_MISMATCH", 400);
  }

  const member = await prisma.member.findUnique({
    where: { id: access.memberId },
    select: { passwordHash: true, tPinHash: true },
  });
  if (!member) return error("MEMBER_NOT_FOUND", 404);
  if (!(await bcrypt.compare(currentPassword, member.passwordHash))) {
    return error("INVALID_PASSWORD", 401);
  }
  if (member.tPinHash && (await bcrypt.compare(newTPin, member.tPinHash))) {
    return error("TPIN_UNCHANGED", 400);
  }

  const tPinHash = await bcrypt.hash(newTPin, 12);
  await prisma.member.update({
    where: { id: access.memberId },
    data: { tPinHash, tPinUpdatedAt: new Date() },
  });

  await writeAuditLog({
    actorId: access.memberId,
    actorRole: "MEMBER",
    action: "MEMBER_TPIN_CHANGED",
    entityType: "Member",
    entityId: access.memberId,
    before: { hasTPin: Boolean(member.tPinHash) },
    after: { hasTPin: true },
  });

  return NextResponse.json({ ok: true });
}
