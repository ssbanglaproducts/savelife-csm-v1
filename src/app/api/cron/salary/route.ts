import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import {
  runSalaryAutomation,
  serializeSalaryAutomationResult,
} from "@/lib/services/salary-automation";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function isAuthorized(request: Request): boolean {
  const secret = process.env.SALARY_AUTOMATION_SECRET ?? process.env.INVESTMENT_AUTOMATION_SECRET;
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
    timingSafeEqual(expectedBuffer, providedBuffer)
  );
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    asOf?: string;
  };
  const asOf = body.asOf ? new Date(body.asOf) : undefined;
  if (asOf && Number.isNaN(asOf.getTime())) {
    return NextResponse.json({ error: "INVALID_AS_OF" }, { status: 400 });
  }

  const result = await runSalaryAutomation({ asOf });
  return NextResponse.json(serializeSalaryAutomationResult(result), {
    status: result.ok ? 200 : 500,
  });
}
