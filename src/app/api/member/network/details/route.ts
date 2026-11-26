import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getNetworkDetails, isNetworkNodeVisible, type NetworkView } from "@/lib/services/network";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const view = searchParams.get("view") === "sponsor" ? "sponsor" : "placement";
  const memberId = searchParams.get("memberId");
  if (!memberId) {
    return NextResponse.json({ error: "INVALID_REQUEST" }, { status: 400 });
  }

  const visible = await isNetworkNodeVisible(prisma, session.user.id, memberId, view as NetworkView);
  if (!visible) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  const details = await getNetworkDetails(prisma, memberId);
  if (!details) {
    return NextResponse.json({ error: "MEMBER_NOT_FOUND" }, { status: 404 });
  }
  return NextResponse.json(details);
}
