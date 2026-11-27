import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  saveUploadedImage: vi.fn(),
}));

vi.mock("@/lib/upload-server", () => ({
  UploadError: class UploadError extends Error {},
  saveUploadedImage: mocks.saveUploadedImage,
}));

import { POST } from "./route";

function uploadRequest(ip: string): Request {
  const formData = new FormData();
  formData.append("file", new File(["image"], "avatar.jpg", { type: "image/jpeg" }));
  return new Request("http://localhost/api/registration/upload", {
    method: "POST",
    headers: { "x-forwarded-for": ip },
    body: formData,
  });
}

describe("public registration upload limiter", () => {
  beforeEach(() => {
    mocks.saveUploadedImage.mockReset();
    mocks.saveUploadedImage.mockResolvedValue("/uploads/avatar.jpg");
  });

  it("allows twelve uploads per IP then returns a stable 429", async () => {
    const ip = "203.0.113.81";

    for (let attempt = 0; attempt < 12; attempt += 1) {
      const response = await POST(uploadRequest(ip));
      expect(response.status).toBe(201);
    }

    const blocked = await POST(uploadRequest(ip));
    expect(blocked.status).toBe(429);
    expect(await blocked.json()).toEqual({ error: "UPLOAD_RATE_LIMITED" });
    expect(Number(blocked.headers.get("retry-after"))).toBeGreaterThan(0);
    expect(blocked.headers.get("cache-control")).toBe("no-store");
    expect(mocks.saveUploadedImage).toHaveBeenCalledTimes(12);
  });

  it("keeps separate buckets for separate IPs", async () => {
    await POST(uploadRequest("203.0.113.82"));

    const other = await POST(uploadRequest("203.0.113.83"));
    expect(other.status).toBe(201);
    expect(mocks.saveUploadedImage).toHaveBeenCalledTimes(2);
  });
});
