import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { getNotificationsForMember, markNotificationsRead } from "@/lib/services/notifications";

export const dynamic = "force-dynamic";

const readSchema = z.object({
  all: z.boolean().optional(),
  ids: z.array(z.string().min(1)).max(100).optional(),
});

function error(code: string, status: number) {
  return NextResponse.json({ error: code }, { status });
}

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return error("LOGIN_REQUIRED", 401);

  const locale = new URL(request.url).searchParams.get("locale") === "bn" ? "bn" : "en";
  const data = await getNotificationsForMember(session.user.id, locale);
  return NextResponse.json(data);
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return error("LOGIN_REQUIRED", 401);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return error("INVALID_REQUEST", 400);
  }

  const parsed = readSchema.safeParse(body);
  if (!parsed.success) return error("INVALID_REQUEST", 400);

  const ids = parsed.data.all ? undefined : parsed.data.ids;
  if (!ids && !parsed.data.all) return error("INVALID_REQUEST", 400);

  await markNotificationsRead(session.user.id, ids);
  return NextResponse.json({ ok: true });
}
