import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getNetworkChildren, isNetworkNodeVisible, type NetworkView } from "@/lib/services/network";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const view = searchParams.get("view");
  const nodeId = searchParams.get("nodeId");
  if ((view !== "placement" && view !== "sponsor") || !nodeId) {
    return NextResponse.json({ error: "INVALID_REQUEST" }, { status: 400 });
  }

  const visible = await isNetworkNodeVisible(prisma, session.user.id, nodeId, view as NetworkView);
  if (!visible) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  const children = await getNetworkChildren(prisma, view as NetworkView, nodeId);
  return NextResponse.json(children);
}
