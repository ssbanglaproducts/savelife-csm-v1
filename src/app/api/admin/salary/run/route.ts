import { NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  runSalaryAutomation,
  serializeSalaryAutomationResult,
} from "@/lib/services/salary-automation";

export const dynamic = "force-dynamic";

function errorResponse(code: string, status: number) {
  return NextResponse.json({ error: code }, { status });
}

export async function POST() {
  const admin = await auth();
  if (admin?.user?.role !== "ADMIN" || !admin.user.id) {
    return errorResponse("FORBIDDEN", 403);
  }

  // The admin endpoint always runs against server time. `asOf` remains an
  // option of the service for cron jobs and deterministic tests only.
  const result = await runSalaryAutomation({ asOf: new Date(), createdBy: admin.user.id });
  return NextResponse.json(serializeSalaryAutomationResult(result), {
    status: result.ok ? 200 : 500,
  });
}
