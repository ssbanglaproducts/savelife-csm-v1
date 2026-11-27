import { unlink } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminApiSession } from "@/lib/admin-access";
import { verifyAdminPassword } from "@/lib/admin-password";
import { Prisma } from "@/generated/prisma/client";
import {
  AUTH_BANNER_VIDEO_SETTING_KEY,
  loadAuthBannerSetting,
  normalizeAuthBannerImageInput,
  normalizeAuthBannerVideoInput,
  type AuthBannerSetting,
} from "@/lib/auth-banner-video";
import { writeAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import {
  saveUploadedImage,
  saveUploadedVideo,
  UploadError,
} from "@/lib/upload-server";

export const dynamic = "force-dynamic";

const urlSchema = z.object({
  url: z.string().trim().max(2048),
  mediaType: z.enum(["image", "video"]).default("video"),
  adminPassword: z.string().min(1).max(200),
});
const deleteSchema = z.object({ adminPassword: z.string().min(1).max(200) });

async function requireAdmin(permission: "content.view" | "content.manage") {
  const session = await requireAdminApiSession(permission);
  return session?.user ?? null;
}

function uploadedFileName(setting: AuthBannerSetting | null): string | null {
  if (!setting) return null;
  if (setting.kind === "upload") return setting.fileName;
  if (setting.kind === "imageUpload") return setting.fileName;
  return null;
}

async function removeStoredFile(fileName: string | null) {
  if (!fileName || !/^[a-f0-9-]+\.(mp4|webm|jpg|png|webp)$/.test(fileName)) return;
  try {
    await unlink(path.join(process.cwd(), "uploads", fileName));
  } catch {
    // The setting is authoritative; a missing file is already harmless.
  }
}

function asJson(value: AuthBannerSetting): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

export async function GET() {
  if (!(await requireAdmin("content.view"))) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }
  return NextResponse.json({ video: await loadAuthBannerSetting(prisma) });
}

export async function POST(request: Request) {
  const admin = await requireAdmin("content.manage");
  if (!admin) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

  const contentType = request.headers.get("content-type") ?? "";
  let setting: AuthBannerSetting | null = null;

  try {
    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const password = formData.get("adminPassword");
      if (typeof password !== "string" || !(await verifyAdminPassword(admin.id, password))) {
        return NextResponse.json({ error: "INVALID_ADMIN_PASSWORD" }, { status: 401 });
      }
      const mediaType = formData.get("mediaType") === "image" ? "image" : "video";
      if (mediaType === "image") {
        const savedUrl = await saveUploadedImage(formData.get("file"));
        const fileName = savedUrl.split("/").pop();
        if (!fileName) throw new UploadError("Invalid image");
        const extension = fileName.split(".").pop();
        const contentTypeValue =
          extension === "png" ? "image/png" : extension === "webp" ? "image/webp" : "image/jpeg";
        setting = {
          kind: "imageUpload",
          url: savedUrl,
          fileName,
          contentType: contentTypeValue,
        };
      } else {
        const saved = await saveUploadedVideo(formData.get("file"));
        setting = {
          kind: "upload",
          url: saved.url,
          fileName: saved.fileName,
          contentType: saved.contentType,
        };
      }
    } else {
      const body: unknown = await request.json();
      const parsed = urlSchema.safeParse(body);
      if (!parsed.success) return NextResponse.json({ error: "INVALID_URL" }, { status: 400 });
      if (!(await verifyAdminPassword(admin.id, parsed.data.adminPassword))) {
        return NextResponse.json({ error: "INVALID_ADMIN_PASSWORD" }, { status: 401 });
      }
      setting =
        parsed.data.mediaType === "image"
          ? normalizeAuthBannerImageInput(parsed.data.url)
          : normalizeAuthBannerVideoInput(parsed.data.url);
    }
  } catch (error) {
    if (error instanceof UploadError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: "INVALID_URL" }, { status: 400 });
  }

  if (!setting) return NextResponse.json({ error: "INVALID_URL" }, { status: 400 });

  const previous = await loadAuthBannerSetting(prisma);
  await prisma.systemSetting.upsert({
    where: { key: AUTH_BANNER_VIDEO_SETTING_KEY },
    create: { key: AUTH_BANNER_VIDEO_SETTING_KEY, value: asJson(setting) },
    update: { value: asJson(setting) },
  });

  const previousFile = uploadedFileName(previous);
  const nextFile = uploadedFileName(setting);
  if (previousFile && previousFile !== nextFile) await removeStoredFile(previousFile);

  await writeAuditLog({
    actorId: admin.id,
    actorRole: admin.role,
    action: "AUTH_BANNER_VIDEO_UPDATED",
    entityType: "SystemSetting",
    entityId: AUTH_BANNER_VIDEO_SETTING_KEY,
    after: { kind: setting.kind },
  });

  return NextResponse.json({ video: setting });
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

  const previous = await loadAuthBannerSetting(prisma);
  await prisma.systemSetting.deleteMany({ where: { key: AUTH_BANNER_VIDEO_SETTING_KEY } });
  await removeStoredFile(uploadedFileName(previous));

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
