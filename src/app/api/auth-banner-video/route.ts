import { NextResponse } from "next/server";
import { loadAuthBannerSetting } from "@/lib/auth-banner-video";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/** Public setting used by the shared visual banner on sign-in/sign-up. */
export async function GET() {
  return NextResponse.json({ video: await loadAuthBannerSetting(prisma) });
}
