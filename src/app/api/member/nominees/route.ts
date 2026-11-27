import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { writeAuditLog } from "@/lib/audit";
import { nomineeInputSchema } from "@/lib/nominee-input";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "LOGIN_REQUIRED" }, { status: 401 });
  if (session.user.role !== "MEMBER") return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

  const nominees = await prisma.nominee.findMany({
    where: { memberId: session.user.id },
    orderBy: { createdAt: "asc" },
    select: { id: true, fullName: true, relation: true, phone: true },
  });
  return NextResponse.json({ nominees });
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "LOGIN_REQUIRED" }, { status: 401 });
  if (session.user.role !== "MEMBER") {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const parsed = nomineeInputSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  const nominee = await prisma.nominee.create({
    data: { memberId: session.user.id, ...parsed.data },
    select: { id: true, fullName: true, relation: true, phone: true },
  });

  await writeAuditLog({
    actorId: session.user.id,
    actorRole: "MEMBER",
    action: "NOMINEE_CREATED",
    entityType: "Nominee",
    entityId: nominee.id,
    after: { fullName: nominee.fullName, relation: nominee.relation, phone: nominee.phone },
  });
  revalidatePath("/[locale]/member/profile", "page");

  return NextResponse.json({ nominee }, { status: 201 });
}
