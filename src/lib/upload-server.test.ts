import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { compressUploadedImage, UploadError } from "./upload-server";

function noisyImage(width: number, height: number, channels: 3 | 4 = 3) {
  const raw = Buffer.alloc(width * height * channels);
  let seed = 12345;
  for (let index = 0; index < raw.length; index += 1) {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    raw[index] = (seed >>> 16) & 0xff;
  }
  return sharp(raw, { raw: { width, height, channels } }).png().toBuffer();
}

function gradientImage(width: number, height: number) {
  return sharp({ create: { width, height, channels: 3, background: "#204060" } })
    .linear(1.2, 10)
    .png()
    .toBuffer();
}

describe("compressUploadedImage", () => {
  it("encodes photo-like images as smaller, downscaled WebP", async () => {
    const input = await gradientImage(2000, 1600);
    const result = await compressUploadedImage(input);
    const metadata = await sharp(result.bytes).metadata();

    expect(result.extension).toBe("webp");
    expect(metadata.format).toBe("webp");
    expect(metadata.width).toBeLessThanOrEqual(1600);
    expect(metadata.height).toBeLessThanOrEqual(1600);
    expect(result.bytes.byteLength).toBeLessThan(input.byteLength);
  });

  it("does not upscale small images", async () => {
    const result = await compressUploadedImage(await gradientImage(120, 80));
    const metadata = await sharp(result.bytes).metadata();

    expect(metadata.width).toBe(120);
    expect(metadata.height).toBe(80);
  });

  it("keeps transparency", async () => {
    const transparent = Buffer.from([0, 0, 0, 0, 255, 255, 255, 255]);
    const input = await sharp(transparent, { raw: { width: 2, height: 1, channels: 4 } })
      .png()
      .toBuffer();

    const result = await compressUploadedImage(input);
    expect((await sharp(result.bytes).metadata()).hasAlpha).toBe(true);
  });

  it("compresses hard-to-compress images by stepping quality down", async () => {
    const input = await noisyImage(1800, 1400);
    const result = await compressUploadedImage(input);
    const metadata = await sharp(result.bytes).metadata();

    expect(result.extension).toBe("webp");
    expect(metadata.format).toBe("webp");
    expect(result.bytes.byteLength).toBeLessThan(input.byteLength);
  }, 20_000);

  it("rejects corrupt image data", async () => {
    await expect(compressUploadedImage(Buffer.from("not an image"))).rejects.toBeInstanceOf(
      UploadError,
    );
  });
});
