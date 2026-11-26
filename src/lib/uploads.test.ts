import { describe, expect, it } from "vitest";
import { isUploadedImageUrl } from "./uploads";

describe("uploaded image URLs", () => {
  it("accepts local upload URLs", () => {
    expect(isUploadedImageUrl("/api/uploads/123e4567-e89b-12d3-a456-426614174000.jpg")).toBe(true);
    expect(isUploadedImageUrl("/api/uploads/123e4567-e89b-12d3-a456-426614174000.png")).toBe(true);
    expect(isUploadedImageUrl("/api/uploads/123e4567-e89b-12d3-a456-426614174000.webp")).toBe(true);
  });

  it("rejects external or malformed URLs", () => {
    expect(isUploadedImageUrl("https://example.com/proof.jpg")).toBe(false);
    expect(isUploadedImageUrl("/api/uploads/../secret.jpg")).toBe(false);
    expect(isUploadedImageUrl("/api/uploads/file.gif")).toBe(false);
    expect(isUploadedImageUrl("")).toBe(false);
  });
});
