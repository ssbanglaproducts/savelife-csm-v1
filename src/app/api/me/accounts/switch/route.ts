import { NextResponse } from "next/server";
import { z } from "zod";
import { auth, updateSession } from "@/auth";
import { canAccessAccount } from "@/lib/account-ownership";
import { writeAuditLog } from "@/lib/audit";
import { clearCart } from "@/lib/cart";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const schema = z.object({ memberId: z.string().trim().min(5).max(20) });

export async function POST(request: Request) {
  const session = await auth();
  const user = session?.user;
  if (!user?.id) {
    return NextResponse.json({ error: "LOGIN_REQUIRED" }, { status: 401 });
  }

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

  const principalId = user.principalId ?? user.id;
  const target = await prisma.member.findUnique({
    where: { memberId: parsed.data.memberId.trim().toUpperCase() },
    select: {
      id: true,
      memberId: true,
      fullName: true,
      email: true,
      profileImage: true,
      role: true,
      status: true,
    },
  });
  if (!target) {
    return NextResponse.json({ error: "ACCOUNT_NOT_FOUND" }, { status: 404 });
  }

  const allowed = await canAccessAccount(prisma, principalId, target.id);
  if (!allowed) {
    return NextResponse.json({ error: "ACCOUNT_NOT_OWNED" }, { status: 403 });
  }
  if (target.id === user.id) {
    return NextResponse.json({ ok: true, memberId: target.memberId });
  }

  const updated = await updateSession({
    user: {
      id: target.id,
      name: target.fullName,
      email: target.email,
      image: target.profileImage,
      memberId: target.memberId,
      role: target.role,
      status: target.status,
    },
  });
  if (!updated) {
    return NextResponse.json({ error: "SWITCH_FAILED" }, { status: 500 });
  }

  // The cart lives in a single browser cookie, so it is not scoped to a member.
  // Clear it on a real account switch to prevent carrying another account's
  // selection into the newly active identity.
  await clearCart();

  await writeAuditLog({
    actorId: principalId,
    actorRole: user.role,
    action: "ACCOUNT_SWITCHED",
    entityType: "Member",
    entityId: target.id,
    after: { fromMemberId: user.memberId, toMemberId: target.memberId },
  });

  return NextResponse.json({ ok: true, memberId: target.memberId });
}
