import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { activeMemberErrorResponse, requireActiveMemberApi } from "@/lib/member-access";
import { writeAuditLog } from "@/lib/audit";
import { nomineeInputSchema } from "@/lib/nominee-input";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const access = await requireActiveMemberApi();
  if (!access.ok) return activeMemberErrorResponse(access);

  const nominees = await prisma.nominee.findMany({
    where: { memberId: access.memberId },
    orderBy: { createdAt: "asc" },
    select: { id: true, fullName: true, relation: true, phone: true },
  });
  return NextResponse.json({ nominees });
}

export async function POST(request: Request) {
  const access = await requireActiveMemberApi();
  if (!access.ok) return activeMemberErrorResponse(access);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const parsed = nomineeInputSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  const nominee = await prisma.nominee.create({
    data: { memberId: access.memberId, ...parsed.data },
    select: { id: true, fullName: true, relation: true, phone: true },
  });

  await writeAuditLog({
    actorId: access.memberId,
    actorRole: "MEMBER",
    action: "NOMINEE_CREATED",
    entityType: "Nominee",
    entityId: nominee.id,
    after: { fullName: nominee.fullName, relation: nominee.relation, phone: nominee.phone },
  });
  revalidatePath("/[locale]/member/profile", "page");

  return NextResponse.json({ nominee }, { status: 201 });
}
