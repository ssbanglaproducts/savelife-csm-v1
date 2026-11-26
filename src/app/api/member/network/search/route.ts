import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { searchNetwork, type NetworkView } from "@/lib/services/network";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const view: NetworkView = searchParams.get("view") === "sponsor" ? "sponsor" : "placement";
  const query = searchParams.get("query") ?? "";
  const nodes = await searchNetwork(prisma, session.user.id, view, query);
  return NextResponse.json({ nodes });
}
