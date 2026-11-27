import type { PrismaClient } from "@/generated/prisma/client";

export const AUTH_BANNER_VIDEO_SETTING_KEY = "auth.bannerVideo";

const UPLOAD_PATTERN = /^\/api\/uploads\/([a-f0-9-]+\.(mp4|webm))$/;
const IMAGE_UPLOAD_PATTERN = /^\/api\/uploads\/([a-f0-9-]+\.(jpg|png|webp))$/;
const YOUTUBE_HOSTS = new Set(["youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be"]);
const VIMEO_HOSTS = new Set(["vimeo.com", "www.vimeo.com", "player.vimeo.com"]);

export type AuthBannerVideo =
  | { kind: "upload"; url: string; fileName: string; contentType: "video/mp4" | "video/webm" }
  | { kind: "direct"; url: string }
  | { kind: "youtube"; videoId: string }
  | { kind: "vimeo"; videoId: string };

export type AuthBannerImage =
  | { kind: "imageUpload"; url: string; fileName: string; contentType: "image/jpeg" | "image/png" | "image/webp" }
  | { kind: "imageDirect"; url: string };

export type AuthBannerSetting = AuthBannerVideo | AuthBannerImage;

export type AuthBannerMedia =
  | { kind: "video"; src: string; type: string }
  | { kind: "iframe"; src: string }
  | { kind: "image"; src: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isSafeHttpUrl(value: string): URL | null {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  if (url.protocol === "http:") {
    // Local HTTP is a development convenience only. It must never be rendered
    // by a deployed auth page, including via a stored admin-configured URL.
    if (process.env.NODE_ENV === "production") return null;
    if (!["localhost", "127.0.0.1"].includes(url.hostname)) return null;
  }
  return url;
}

function parseUpload(value: Record<string, unknown>): AuthBannerVideo | null {
  if (typeof value.url !== "string") return null;
  const match = UPLOAD_PATTERN.exec(value.url);
  if (!match) return null;
  const contentType = match[1].endsWith(".webm") ? "video/webm" : "video/mp4";
  return { kind: "upload", url: value.url, fileName: match[1], contentType };
}

function parseImageUpload(value: Record<string, unknown>): AuthBannerImage | null {
  if (typeof value.url !== "string") return null;
  const match = IMAGE_UPLOAD_PATTERN.exec(value.url);
  if (!match) return null;
  const extension = match[1].split(".").pop();
  const contentType =
    extension === "png" ? "image/png" : extension === "webp" ? "image/webp" : "image/jpeg";
  return { kind: "imageUpload", url: value.url, fileName: match[1], contentType };
}

function parseImageDirect(url: URL): AuthBannerImage | null {
  if (!/\.(jpe?g|png|webp)(?:[?#]|$)/i.test(url.pathname)) return null;
  return { kind: "imageDirect", url: url.toString() };
}

function parseHostedVideo(url: URL): AuthBannerVideo | null {
  const host = url.hostname.toLowerCase();

  if (YOUTUBE_HOSTS.has(host)) {
    const candidate =
      host === "youtu.be" ? url.pathname.split("/").filter(Boolean)[0] : url.searchParams.get("v");
    if (candidate && /^[A-Za-z0-9_-]{11}$/.test(candidate)) {
      return { kind: "youtube", videoId: candidate };
    }
    return null;
  }

  if (VIMEO_HOSTS.has(host)) {
    const candidate = url.pathname.split("/").filter(Boolean)[0];
    if (candidate && /^\d+$/.test(candidate)) return { kind: "vimeo", videoId: candidate };
  }

  return null;
}

/** Validate a stored setting before it reaches the public auth pages. */
export function parseAuthBannerVideo(value: unknown): AuthBannerVideo | null {
  if (!isRecord(value) || typeof value.kind !== "string") return null;

  switch (value.kind) {
    case "upload":
      return parseUpload(value);
    case "direct": {
      if (typeof value.url !== "string") return null;
      const url = isSafeHttpUrl(value.url);
      if (!url || !/\.(mp4|webm)(?:[?#]|$)/i.test(url.pathname)) return null;
      return { kind: "direct", url: url.toString() };
    }
    case "youtube": {
      if (typeof value.videoId !== "string" || !/^[A-Za-z0-9_-]{11}$/.test(value.videoId)) {
        return null;
      }
      return { kind: "youtube", videoId: value.videoId };
    }
    case "vimeo": {
      if (typeof value.videoId !== "string" || !/^\d+$/.test(value.videoId)) return null;
      return { kind: "vimeo", videoId: value.videoId };
    }
    default:
      return null;
  }
}

/** Validate a stored image setting before it reaches the public auth pages. */
export function parseAuthBannerImage(value: unknown): AuthBannerImage | null {
  if (!isRecord(value) || typeof value.kind !== "string") return null;

  if (value.kind === "imageUpload") return parseImageUpload(value);
  if (value.kind === "imageDirect") {
    if (typeof value.url !== "string") return null;
    const url = isSafeHttpUrl(value.url);
    return url ? parseImageDirect(url) : null;
  }
  return null;
}

export function parseAuthBannerSetting(value: unknown): AuthBannerSetting | null {
  return parseAuthBannerVideo(value) ?? parseAuthBannerImage(value);
}

/** Convert an admin-entered URL into a validated, renderable setting value. */
export function normalizeAuthBannerVideoInput(rawInput: string): AuthBannerVideo | null {
  const value = rawInput.trim();
  if (!value) return null;

  if (value.startsWith("/")) {
    return parseAuthBannerVideo({ kind: "upload", url: value });
  }

  const url = isSafeHttpUrl(value);
  if (!url) return null;

  const hosted = parseHostedVideo(url);
  if (hosted) return hosted;

  if (/\.(mp4|webm)(?:[?#]|$)/i.test(url.pathname)) {
    return { kind: "direct", url: url.toString() };
  }
  return null;
}

export function normalizeAuthBannerImageInput(rawInput: string): AuthBannerImage | null {
  const value = rawInput.trim();
  if (!value) return null;

  if (value.startsWith("/")) return parseImageUpload({ kind: "imageUpload", url: value });

  const url = isSafeHttpUrl(value);
  return url ? parseImageDirect(url) : null;
}

export function toAuthBannerMedia(setting: AuthBannerSetting): AuthBannerMedia | null {
  const image = parseAuthBannerImage(setting);
  if (image) return { kind: "image", src: image.url };

  const parsed = parseAuthBannerVideo(setting);
  if (!parsed) return null;

  if (parsed.kind === "upload") {
    return { kind: "video", src: parsed.url, type: parsed.contentType };
  }
  if (parsed.kind === "direct") {
    return {
      kind: "video",
      src: parsed.url,
      type: parsed.url.toLowerCase().includes(".webm") ? "video/webm" : "video/mp4",
    };
  }
  if (parsed.kind === "youtube") {
    const id = parsed.videoId;
    const params = new URLSearchParams({
      autoplay: "1",
      mute: "1",
      loop: "1",
      playlist: id,
      controls: "0",
      modestbranding: "1",
      playsinline: "1",
      rel: "0",
      disablekb: "1",
      fs: "0",
      iv_load_policy: "3",
    });
    return { kind: "iframe", src: `https://www.youtube-nocookie.com/embed/${id}?${params}` };
  }

  const params = new URLSearchParams({
    autoplay: "1",
    muted: "1",
    loop: "1",
    background: "1",
    controls: "0",
    dnt: "1",
  });
  return { kind: "iframe", src: `https://player.vimeo.com/video/${parsed.videoId}?${params}` };
}

export async function loadAuthBannerVideo(
  client: PrismaClient,
): Promise<AuthBannerVideo | null> {
  try {
    const setting = await client.systemSetting.findUnique({
      where: { key: AUTH_BANNER_VIDEO_SETTING_KEY },
    });
    return setting ? parseAuthBannerVideo(setting.value) : null;
  } catch (error) {
    console.error("Unable to load auth banner video setting", error);
    return null;
  }
}

export async function loadAuthBannerSetting(
  client: PrismaClient,
): Promise<AuthBannerSetting | null> {
  try {
    const setting = await client.systemSetting.findUnique({
      where: { key: AUTH_BANNER_VIDEO_SETTING_KEY },
    });
    return setting ? parseAuthBannerSetting(setting.value) : null;
  } catch (error) {
    console.error("Unable to load auth banner setting", error);
    return null;
  }
}
