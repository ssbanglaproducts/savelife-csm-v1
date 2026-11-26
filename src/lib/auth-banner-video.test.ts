import { describe, expect, it } from "vitest";
import {
  normalizeAuthBannerVideoInput,
  parseAuthBannerVideo,
  toAuthBannerMedia,
} from "./auth-banner-video";

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
