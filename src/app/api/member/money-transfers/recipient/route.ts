import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { normalizeMemberId } from "@/lib/member-id";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function errorResponse(code: string, status: number) {
  return NextResponse.json({ error: code }, { status });
}

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return errorResponse("LOGIN_REQUIRED", 401);
  if (session.user.role !== "MEMBER") return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const memberId = normalizeMemberId(searchParams.get("memberId") ?? "");
  if (!memberId) return errorResponse("MEMBER_ID_REQUIRED", 400);

  const recipient = await prisma.member.findUnique({
    where: { memberId, role: "MEMBER" },
    select: {
      id: true,
      memberId: true,
      fullName: true,
      profileImage: true,
      status: true,
    },
  });

  if (!recipient) return errorResponse("RECIPIENT_NOT_FOUND", 404);
  if (recipient.id === session.user.id) return errorResponse("CANNOT_SEND_TO_SELF", 400);
  if (recipient.status === "SUSPENDED") return errorResponse("RECIPIENT_UNAVAILABLE", 403);

  return NextResponse.json({
    recipient: {
      id: recipient.id,
      memberId: recipient.memberId,
      fullName: recipient.fullName,
      profileImage: recipient.profileImage,
      status: recipient.status,
    },
  });
}
