import { unlink } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminApiSession } from "@/lib/admin-access";
import { verifyAdminPassword } from "@/lib/admin-password";
import { Prisma } from "@/generated/prisma/client";
import {
  AUTH_BANNER_VIDEO_SETTING_KEY,
  loadAuthBannerVideo,
  normalizeAuthBannerVideoInput,
  parseAuthBannerVideo,
  type AuthBannerVideo,
} from "@/lib/auth-banner-video";
import { writeAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { saveUploadedVideo, UploadError } from "@/lib/upload-server";

export const dynamic = "force-dynamic";

const urlSchema = z.object({
  url: z.string().trim().max(2048),
  adminPassword: z.string().min(1).max(200),
});
const deleteSchema = z.object({ adminPassword: z.string().min(1).max(200) });

async function requireAdmin(permission: "content.view" | "content.manage") {
  const session = await requireAdminApiSession(permission);
  return session?.user ?? null;
}

async function removeStoredFile(video: AuthBannerVideo | null) {
  if (video?.kind !== "upload" || !/^[a-f0-9-]+\.(mp4|webm)$/.test(video.fileName)) return;
  try {
    await unlink(path.join(process.cwd(), "uploads", video.fileName));
  } catch {
    // The setting is authoritative; a missing file is already harmless.
  }
}

function asJson(value: AuthBannerVideo): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

export async function GET() {
  if (!(await requireAdmin("content.view"))) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }
  return NextResponse.json({ video: await loadAuthBannerVideo(prisma) });
}

export async function POST(request: Request) {
  const admin = await requireAdmin("content.manage");
  if (!admin) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

  const contentType = request.headers.get("content-type") ?? "";
  let video: AuthBannerVideo | null = null;

  try {
    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const password = formData.get("adminPassword");
      if (typeof password !== "string" || !(await verifyAdminPassword(admin.id, password))) {
        return NextResponse.json({ error: "INVALID_ADMIN_PASSWORD" }, { status: 401 });
      }
      const saved = await saveUploadedVideo(formData.get("file"));
      video = {
        kind: "upload",
        url: saved.url,
        fileName: saved.fileName,
        contentType: saved.contentType,
      };
    } else {
      const body: unknown = await request.json();
      const parsed = urlSchema.safeParse(body);
      if (!parsed.success) return NextResponse.json({ error: "INVALID_URL" }, { status: 400 });
      if (!(await verifyAdminPassword(admin.id, parsed.data.adminPassword))) {
        return NextResponse.json({ error: "INVALID_ADMIN_PASSWORD" }, { status: 401 });
      }
      video = normalizeAuthBannerVideoInput(parsed.data.url);
    }
  } catch (error) {
    if (error instanceof UploadError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: "INVALID_URL" }, { status: 400 });
  }

  if (!video) return NextResponse.json({ error: "INVALID_URL" }, { status: 400 });

  const previous = await loadAuthBannerVideo(prisma);
  await prisma.systemSetting.upsert({
    where: { key: AUTH_BANNER_VIDEO_SETTING_KEY },
    create: { key: AUTH_BANNER_VIDEO_SETTING_KEY, value: asJson(video) },
    update: { value: asJson(video) },
  });

  if (
    previous?.kind === "upload" &&
    (video.kind !== "upload" || previous.fileName !== video.fileName)
  ) {
    await removeStoredFile(previous);
  }

  await writeAuditLog({
    actorId: admin.id,
    actorRole: admin.role,
    action: "AUTH_BANNER_VIDEO_UPDATED",
    entityType: "SystemSetting",
    entityId: AUTH_BANNER_VIDEO_SETTING_KEY,
    after: { kind: video.kind },
  });

  return NextResponse.json({ video: parseAuthBannerVideo(video) });
}

export async function DELETE(request: Request) {
  const admin = await requireAdmin("content.manage");
  if (!admin) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "INVALID_REQUEST" }, { status: 400 });
  }
  const parsed = deleteSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "INVALID_REQUEST" }, { status: 400 });
  if (!(await verifyAdminPassword(admin.id, parsed.data.adminPassword))) {
    return NextResponse.json({ error: "INVALID_ADMIN_PASSWORD" }, { status: 401 });
  }

  const previous = await loadAuthBannerVideo(prisma);
  await prisma.systemSetting.deleteMany({ where: { key: AUTH_BANNER_VIDEO_SETTING_KEY } });
  await removeStoredFile(previous);

  await writeAuditLog({
    actorId: admin.id,
    actorRole: admin.role,
    action: "AUTH_BANNER_VIDEO_REMOVED",
    entityType: "SystemSetting",
    entityId: AUTH_BANNER_VIDEO_SETTING_KEY,
    before: previous ? { kind: previous.kind } : undefined,
  });

  return NextResponse.json({ video: null });
}
