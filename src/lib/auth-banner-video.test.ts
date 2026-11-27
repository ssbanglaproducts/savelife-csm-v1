import { afterEach, describe, expect, it, vi } from "vitest";
import {
  normalizeAuthBannerImageInput,
  normalizeAuthBannerVideoInput,
  parseAuthBannerImage,
  parseAuthBannerSetting,
  parseAuthBannerVideo,
  toAuthBannerMedia,
} from "./auth-banner-video";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("auth banner video", () => {
  it("accepts local uploads", () => {
    expect(normalizeAuthBannerVideoInput("/api/uploads/abc-123.webm")).toEqual({
      kind: "upload",
      url: "/api/uploads/abc-123.webm",
      fileName: "abc-123.webm",
      contentType: "video/webm",
    });
  });

  it("accepts direct media URLs but rejects other schemes and pages", () => {
    expect(normalizeAuthBannerVideoInput("https://cdn.example.test/banner.mp4?v=2")).toEqual({
      kind: "direct",
      url: "https://cdn.example.test/banner.mp4?v=2",
    });
    expect(normalizeAuthBannerVideoInput("javascript:alert(1)")).toBeNull();
    expect(normalizeAuthBannerVideoInput("https://example.test/banner")).toBeNull();
  });

  it("recognizes YouTube and Vimeo links", () => {
    expect(normalizeAuthBannerVideoInput("https://youtu.be/dQw4w9WgXcQ")).toEqual({
      kind: "youtube",
      videoId: "dQw4w9WgXcQ",
    });
    expect(normalizeAuthBannerVideoInput("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toEqual({
      kind: "youtube",
      videoId: "dQw4w9WgXcQ",
    });
    expect(normalizeAuthBannerVideoInput("https://vimeo.com/123456789")).toEqual({
      kind: "vimeo",
      videoId: "123456789",
    });
  });

  it("builds muted looping embed URLs", () => {
    const media = toAuthBannerMedia({ kind: "youtube", videoId: "dQw4w9WgXcQ" });
    expect(media?.kind).toBe("iframe");
    if (media?.kind === "iframe") {
      expect(media.src).toContain("autoplay=1");
      expect(media.src).toContain("mute=1");
      expect(media.src).toContain("loop=1");
    }
  });

  it("rejects malformed stored settings", () => {
    expect(parseAuthBannerVideo({ kind: "youtube", videoId: "short" })).toBeNull();
    expect(parseAuthBannerVideo({ kind: "direct", url: "file:///tmp/video.mp4" })).toBeNull();
  });
});

describe("auth banner image", () => {
  it("accepts local and direct image URLs", () => {
    expect(normalizeAuthBannerImageInput("/api/uploads/abc-123.webp")).toEqual({
      kind: "imageUpload",
      url: "/api/uploads/abc-123.webp",
      fileName: "abc-123.webp",
      contentType: "image/webp",
    });
    expect(normalizeAuthBannerImageInput("https://cdn.example.test/banner.jpg?v=2")).toEqual({
      kind: "imageDirect",
      url: "https://cdn.example.test/banner.jpg?v=2",
    });
  });

  it("rejects unsupported image URLs", () => {
    expect(normalizeAuthBannerImageInput("javascript:alert(1)")).toBeNull();
    expect(normalizeAuthBannerImageInput("https://cdn.example.test/banner.svg")).toBeNull();
    expect(parseAuthBannerImage({ kind: "imageDirect", url: "http://cdn.example.test/a.png" })).toBeNull();
  });

  it("renders image settings as image media", () => {
    const setting = { kind: "imageUpload" as const, url: "/api/uploads/a.png", fileName: "a.png", contentType: "image/png" as const };
    expect(parseAuthBannerSetting(setting)).toEqual(setting);
    expect(toAuthBannerMedia(setting)).toEqual({ kind: "image", src: "/api/uploads/a.png" });
    expect(normalizeAuthBannerVideoInput("https://cdn.example.test/a.png")).toBeNull();
  });
});

describe("auth banner external media validation", () => {
  it("allows loopback HTTP only outside production", () => {
    vi.stubEnv("NODE_ENV", "development");
    expect(normalizeAuthBannerVideoInput("http://localhost:3000/clip.mp4")).toMatchObject({
      kind: "direct",
    });
    expect(normalizeAuthBannerImageInput("http://127.0.0.1:3000/poster.jpg")).toMatchObject({
      kind: "imageDirect",
    });
  });

  it("rejects loopback and plain HTTP URLs in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(normalizeAuthBannerVideoInput("http://localhost:3000/clip.mp4")).toBeNull();
    expect(normalizeAuthBannerVideoInput("http://127.0.0.1:3000/clip.webm")).toBeNull();
    expect(normalizeAuthBannerVideoInput("http://cdn.example.test/clip.mp4")).toBeNull();
    expect(normalizeAuthBannerImageInput("http://localhost:3000/poster.png")).toBeNull();
    expect(normalizeAuthBannerVideoInput("https://cdn.example.test/clip.mp4")).toMatchObject({
      kind: "direct",
    });
  });
});
