import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  loadRoiOverview,
  loadRoiSponsorHistory,
} from "@/lib/services/roi-commission-history";

export const dynamic = "force-dynamic";

function firstParam(params: URLSearchParams, key: string): string | undefined {
  const value = params.get(key);
  return value?.trim() ? value.trim() : undefined;
}

function integerParam(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export async function GET(request: Request) {
  const admin = await auth();
  if (admin?.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  try {
    const params = new URL(request.url).searchParams;
    const [overview, history] = await Promise.all([
      loadRoiOverview(prisma),
      loadRoiSponsorHistory(prisma, {
        q: firstParam(params, "q"),
        level: integerParam(firstParam(params, "level")),
        month: firstParam(params, "month"),
        page: integerParam(firstParam(params, "page")),
      }),
    ]);

    return NextResponse.json({
      overview: overview.map((row) => ({
        ...row,
        postedAt: row.postedAt.toISOString(),
        ratesBps: [...row.ratesBps],
        totalBasisPaisa: row.totalBasisPaisa.toString(),
        totalCommissionPaisa: row.totalCommissionPaisa.toString(),
        originalProfitPaisa: row.originalProfitPaisa.toString(),
      })),
      history: {
        ...history,
        rows: history.rows.map((row) => ({
          ...row,
          createdAt: row.createdAt.toISOString(),
          basisPaisa: row.basisPaisa.toString(),
          amountPaisa: row.amountPaisa.toString(),
        })),
      },
    });
  } catch (error) {
    console.error(
      "ROI history load failed",
      {
        route: "/api/admin/roi-commission/history",
        adminId: admin.user.id,
        query: Object.fromEntries(new URL(request.url).searchParams),
      },
      error,
    );
    return NextResponse.json({ error: "ROI_HISTORY_FAILED" }, { status: 500 });
  }
}
