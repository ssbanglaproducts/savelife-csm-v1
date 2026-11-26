import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { formatSP, spToPaisa } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import { buildDistributionPreview } from "@/lib/services/distribution";
import { ServiceError } from "@/lib/services/errors";

export const dynamic = "force-dynamic";

const schema = z.object({
  amount: z.string().trim().regex(/^\d+(\.\d{1,2})?$/),
});

function errorResponse(code: string, status: number) {
  return NextResponse.json({ error: code }, { status });
}

/** Returns the exact recipients and amounts a distribution would credit. */
export async function POST(request: Request) {
  const admin = await auth();
  if (admin?.user?.role !== "ADMIN") {
    return errorResponse("FORBIDDEN", 403);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse("Invalid request", 400);
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) return errorResponse("Invalid amount", 400);

  try {
    const distributable = spToPaisa(parsed.data.amount);
    if (distributable <= 0n) return errorResponse("Invalid amount", 400);

    const preview = await buildDistributionPreview(prisma, distributable);
    if (!preview) return errorResponse("NO_ELIGIBLE_INVESTMENTS", 400);

    return NextResponse.json({
      ok: true,
      distributable: formatSP(preview.distributablePaisa),
      totalEligible: formatSP(preview.totalEligiblePaisa),
      profitPerThousand: formatSP(preview.profitPerThousandPaisa),
      recipients: preview.recipients.map((recipient) => ({
        memberId: recipient.memberId,
        memberNo: recipient.memberNo,
        name: recipient.name,
        eligible: formatSP(recipient.investedPaisa),
        receiving: formatSP(recipient.receivingPaisa),
      })),
      totalReceiving: formatSP(
        preview.recipients.reduce((sum, recipient) => sum + recipient.receivingPaisa, 0n),
      ),
    });
  } catch (error) {
    if (error instanceof ServiceError) {
      return errorResponse(error.code === "INVALID_INPUT" ? "Invalid amount" : error.code, 400);
    }
    return errorResponse("PREVIEW_FAILED", 500);
  }
}
