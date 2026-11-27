import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getMemberSalaryData } from "@/lib/services/member-salary";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "LOGIN_REQUIRED" }, { status: 401 });
  }
  if (session.user.role !== "MEMBER") return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

  const data = await getMemberSalaryData(prisma, session.user.id);
  return NextResponse.json(data);
}
