import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import {
  runSalaryAutomation,
  serializeSalaryAutomationResult,
} from "@/lib/services/salary-automation";

export const dynamic = "force-dynamic";

const schema = z.object({
  asOf: z.string().datetime().optional(),
});

function errorResponse(code: string, status: number) {
  return NextResponse.json({ error: code }, { status });
}

export async function POST(request: Request) {
  const admin = await auth();
  if (admin?.user?.role !== "ADMIN" || !admin.user.id) {
    return errorResponse("FORBIDDEN", 403);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return errorResponse("INVALID_REQUEST", 400);

  const asOf = parsed.data.asOf ? new Date(parsed.data.asOf) : undefined;
  const result = await runSalaryAutomation({ asOf, createdBy: admin.user.id });
  return NextResponse.json(serializeSalaryAutomationResult(result), {
    status: result.ok ? 200 : 500,
  });
}
