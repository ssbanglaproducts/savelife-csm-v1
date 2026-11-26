import type { NotificationKind } from "../../generated/prisma/client";
import { NotificationKind as Kind } from "../../generated/prisma/enums";
import { prisma } from "@/lib/prisma";

export type LocalizedText = { en: string; bn: string };

export type NotificationDTO = {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string;
  href: string | null;
  read: boolean;
  createdAt: string;
  timeLabel: string;
};

export type CreateNotificationInput = {
  title: LocalizedText;
  body: LocalizedText;
  kind?: NotificationKind;
  href?: string | null;
  /** Omit for a broadcast visible to every member. */
  memberId?: string | null;
};

/** Only internal panel paths are accepted; never hand a user string to a router. */
export function safeNotificationHref(href?: string | null): string | null {
  if (!href) return null;
  const value = href.trim();
  if (!value.startsWith("/") || value.startsWith("//")) return null;
  if (/[\\\u0000-\u001f]/.test(value)) return null;
  return value;
}

export function localizedText(value: unknown, locale: string): string {
  if (typeof value === "string") return value;
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    const preferred = record[locale];
    if (typeof preferred === "string" && preferred.trim()) return preferred;
    if (typeof record.en === "string" && record.en.trim()) return record.en;
    const first = Object.values(record).find((item) => typeof item === "string" && item.trim());
    if (typeof first === "string") return first;
  }
  return "";
}

export function formatNotificationDate(date: Date, locale: string): string {
  const sameDay =
    date.getFullYear() === new Date().getFullYear() &&
    date.getMonth() === new Date().getMonth() &&
    date.getDate() === new Date().getDate();
  return new Intl.DateTimeFormat(locale === "bn" ? "bn-BD" : "en-GB", {
    ...(sameDay ? { hour: "2-digit", minute: "2-digit" } : { day: "numeric", month: "short" }),
  }).format(date);
}

/**
 * Notifications are written after the primary mutation commits, using a
 * standalone client. A notification failure is logged but never rolls back a
 * wallet, order or investment operation.
 */
export async function createNotification(input: CreateNotificationInput): Promise<void> {
  try {
    await prisma.notification.create({
      data: {
        memberId: input.memberId ?? null,
        kind: input.kind ?? Kind.ANNOUNCEMENT,
        title: input.title,
        body: input.body,
        href: safeNotificationHref(input.href),
      },
    });
  } catch (error) {
    console.error("Unable to create notification", input.kind, error);
  }
}

export async function getNotificationsForMember(
  memberId: string,
  locale: string,
  limit = 20,
): Promise<{ notifications: NotificationDTO[]; unreadCount: number }> {
  const visible = {
    OR: [{ memberId }, { memberId: null }],
  };

  const [rows, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where: visible,
      orderBy: { createdAt: "desc" },
      take: limit,
      include: { reads: { where: { memberId }, select: { readAt: true } } },
    }),
    prisma.notification.count({
      where: {
        ...visible,
        reads: { none: { memberId } },
      },
    }),
  ]);

  return {
    notifications: rows.map((row) => ({
      id: row.id,
      kind: row.kind,
      title: localizedText(row.title, locale),
      body: localizedText(row.body, locale),
      href: row.href,
      read: row.reads.length > 0,
      createdAt: row.createdAt.toISOString(),
      timeLabel: formatNotificationDate(row.createdAt, locale),
    })),
    unreadCount,
  };
}

/** Marks the supplied visible notifications read, or every visible one. */
export async function markNotificationsRead(memberId: string, ids?: string[]): Promise<void> {
  try {
    const result = await prisma.notification.findMany({
      where: {
        OR: [{ memberId }, { memberId: null }],
        ...(ids ? { id: { in: ids } } : {}),
        reads: { none: { memberId } },
      },
      select: { id: true },
    });
    if (result.length === 0) return;
    await prisma.notificationRead.createMany({
      data: result.map((item) => ({ notificationId: item.id, memberId })),
      skipDuplicates: true,
    });
  } catch (error) {
    console.error("Unable to mark notifications read", error);
  }
}

export async function getBroadcasts(limit = 20) {
  return prisma.notification.findMany({
    where: { memberId: null },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      kind: true,
      title: true,
      body: true,
      href: true,
      createdAt: true,
      _count: { select: { reads: true } },
    },
  });
}
