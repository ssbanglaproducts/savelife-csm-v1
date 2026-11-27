import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminApiSession } from "@/lib/admin-access";
import { writeAuditLog } from "@/lib/audit";
import { NotificationKind } from "@/generated/prisma/enums";
import {
  createNotification,
  formatNotificationDate,
  getBroadcasts,
  localizedText,
  safeNotificationHref,
} from "@/lib/services/notifications";

export const dynamic = "force-dynamic";

const localized = z.object({
  en: z.string().trim().min(1).max(180),
  bn: z.string().trim().min(1).max(180),
});

const schema = z.object({
  kind: z.enum([
    NotificationKind.ANNOUNCEMENT,
    NotificationKind.NOTICE,
    NotificationKind.ALERT,
  ]),
  title: localized,
  body: z.object({
    en: z.string().trim().min(1).max(500),
    bn: z.string().trim().min(1).max(500),
  }),
  href: z.string().trim().max(200).optional().nullable(),
});

function error(code: string, status: number) {
  return NextResponse.json({ error: code }, { status });
}

export async function GET(request: Request) {
  const session = await requireAdminApiSession("content.view");
  if (!session) return error("FORBIDDEN", 403);

  const locale = new URL(request.url).searchParams.get("locale") === "bn" ? "bn" : "en";
  const broadcasts = await getBroadcasts();
  return NextResponse.json({
    broadcasts: broadcasts.map((item) => ({
      id: item.id,
      kind: item.kind,
      title: localizedText(item.title, locale),
      body: localizedText(item.body, locale),
      href: item.href,
      readCount: item._count.reads,
      timeLabel: formatNotificationDate(item.createdAt, locale),
    })),
  });
}

export async function POST(request: Request) {
  const session = await requireAdminApiSession("content.manage");
  if (!session) return error("FORBIDDEN", 403);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return error("INVALID_REQUEST", 400);
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) return error("INVALID_NOTIFICATION", 400);

  const data = parsed.data;
  await createNotification({
    kind: data.kind,
    title: data.title,
    body: data.body,
    href: safeNotificationHref(data.href),
  });

  await writeAuditLog({
    actorId: session.user.id,
    actorRole: session.user.role,
    action: "NOTIFICATION_BROADCAST_CREATED",
    entityType: "Notification",
    after: { kind: data.kind, title: data.title.en },
  });

  return NextResponse.json({ ok: true }, { status: 201 });
}
