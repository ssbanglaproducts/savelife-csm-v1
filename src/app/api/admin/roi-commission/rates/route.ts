import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminApiSession } from "@/lib/admin-access";
import { verifyAdminPassword } from "@/lib/admin-password";
import { writeAuditLog } from "@/lib/audit";
import { ServiceError } from "@/lib/services/errors";
import {
  MAX_TOTAL_ROI_RATES_BPS,
  StaleRoiRateVersionError,
  loadRoiRateConfig,
  saveRoiRateConfig,
  totalRoiRateBps,
} from "@/lib/services/roi-commission";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const schema = z.object({
  ratesBps: z.array(z.number().int().min(0).max(10_000)).length(5),
  adminPassword: z.string().min(1).max(200),
  // Optional optimistic lock. When supplied, the save is rejected with
  // STALE_VERSION unless the stored rates still have this version.
  expectedVersion: z.number().int().min(0).optional(),
});

function errorResponse(code: string, status: number) {
  return NextResponse.json({ error: code }, { status });
}

export async function GET() {
  const admin = await requireAdminApiSession("roiCommission.view");
  if (!admin) return errorResponse("FORBIDDEN", 403);

  const config = await loadRoiRateConfig(prisma);
  return NextResponse.json({
    ratesBps: config.ratesBps,
    totalBps: totalRoiRateBps(config),
  });
}

export async function POST(request: Request) {
  const admin = await requireAdminApiSession("roiCommission.manage");
  if (!admin) {
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
  const totalBps = parsed.data.ratesBps.reduce((sum, rate) => sum + rate, 0);
  if (totalBps > MAX_TOTAL_ROI_RATES_BPS) return errorResponse("INVALID_RATES", 400);

  if (!(await verifyAdminPassword(admin.user.id, parsed.data.adminPassword))) {
    return errorResponse("INVALID_ADMIN_PASSWORD", 401);
  }

  try {
    const ratesBps = await saveRoiRateConfig(
      prisma,
      parsed.data.ratesBps,
      parsed.data.expectedVersion,
    );
    await writeAuditLog({
      actorId: admin.user.id,
      actorRole: admin.user.role,
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
    if (error instanceof StaleRoiRateVersionError) return errorResponse("STALE_VERSION", 409);
    if (error instanceof ServiceError) return errorResponse(error.code, 400);
    console.error("ROI commission rate update failed", error);
    return errorResponse("ROI_RATES_UPDATE_FAILED", 500);
  }
}
