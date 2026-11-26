import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { runInvestmentAutomation } from "@/lib/services/investment-automation";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function isAuthorized(request: Request): boolean {
  const secret = process.env.INVESTMENT_AUTOMATION_SECRET;
  if (!secret) return false;

  const authorization = request.headers.get("authorization");
  const provided =
    authorization?.match(/^Bearer\s+(.+)$/i)?.[1] ??
    request.headers.get("x-cron-secret") ??
    "";

  const expectedBuffer = Buffer.from(secret);
  const providedBuffer = Buffer.from(provided);
  return (
    providedBuffer.length === expectedBuffer.length &&
    timingSafeEqual(providedBuffer, expectedBuffer)
  );
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    asOf?: unknown;
    limit?: unknown;
  };

  const asOf =
    typeof body.asOf === "string" && body.asOf.trim()
      ? new Date(body.asOf)
      : undefined;
  if (asOf && Number.isNaN(asOf.getTime())) {
    return NextResponse.json({ error: "Invalid asOf" }, { status: 400 });
  }

  const limit =
    typeof body.limit === "number" && Number.isInteger(body.limit)
      ? body.limit
      : undefined;
  if (limit !== undefined && (limit < 1 || limit > 1000)) {
    return NextResponse.json({ error: "Invalid limit" }, { status: 400 });
  }

  const result = await runInvestmentAutomation({ asOf, limit });
  return NextResponse.json(result, { status: result.ok ? 200 : 500 });
}
