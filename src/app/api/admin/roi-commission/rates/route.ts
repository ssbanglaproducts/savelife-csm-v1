import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { writeAuditLog } from "@/lib/audit";
import { ServiceError } from "@/lib/services/errors";
import {
  loadRoiRateConfig,
  saveRoiRateConfig,
  totalRoiRateBps,
} from "@/lib/services/roi-commission";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const schema = z.object({
  ratesBps: z.array(z.number().int().min(0).max(10_000)).length(5),
});

function errorResponse(code: string, status: number) {
  return NextResponse.json({ error: code }, { status });
}

export async function GET() {
  const admin = await auth();
  if (admin?.user?.role !== "ADMIN") return errorResponse("FORBIDDEN", 403);

  const config = await loadRoiRateConfig(prisma);
  return NextResponse.json({
    ratesBps: config.ratesBps,
    totalBps: totalRoiRateBps(config),
  });
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
    return errorResponse("Invalid request", 400);
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return errorResponse("INVALID_RATES", 400);

  try {
    const ratesBps = await saveRoiRateConfig(prisma, parsed.data.ratesBps);
    await writeAuditLog({
      actorId: admin.user.id,
      actorRole: "ADMIN",
      action: "ROI_COMMISSION_RATES_UPDATED",
      entityType: "RoiCommissionSettings",
      entityId: "roiCommission.ratesBps",
      after: {
        ratesBps: ratesBps.join(","),
        totalBps: totalRoiRateBps({ ratesBps }),
      },
    });
    return NextResponse.json({ ratesBps, totalBps: totalRoiRateBps({ ratesBps }) });
  } catch (error) {
    if (error instanceof ServiceError) return errorResponse(error.code, 400);
    console.error("ROI commission rate update failed", error);
    return errorResponse("ROI_RATES_UPDATE_FAILED", 500);
  }
}
