import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const maxBytes = 5 * 1024 * 1024;
const maxDimension = 1600;
const maxInputPixels = 40_000_000;

const allowedVideoTypes = new Set(["video/mp4", "video/webm"]);
const maxVideoBytes = 25 * 1024 * 1024;

export class UploadError extends Error {}

function isUploadFile(value: FormDataEntryValue | null): value is File {
  return value !== null && typeof value !== "string";
}

function hasImageSignature(bytes: Buffer, type: string): boolean {
  if (type === "image/jpeg") {
    return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  }
  if (type === "image/png") {
    return (
      bytes[0] === 0x89 &&
      bytes[1] === 0x50 &&
      bytes[2] === 0x4e &&
      bytes[3] === 0x47 &&
      bytes[4] === 0x0d &&
      bytes[5] === 0x0a &&
      bytes[6] === 0x1a &&
      bytes[7] === 0x0a
    );
  }
  return (
    bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP"
  );
}

export type CompressedImage = { bytes: Buffer; extension: "jpg" | "png" | "webp" };

/**
 * Every accepted upload is decoded, auto-rotated, downscaled and re-encoded as
 * WebP. Quality steps down until the result is smaller than the source, so
 * even unusually noisy images are compressed rather than stored unchanged.
 */
export async function compressUploadedImage(bytes: Buffer): Promise<CompressedImage> {
  try {
    const options = { failOn: "error" as const, limitInputPixels: maxInputPixels };
    const metadata = await sharp(bytes, options).metadata();
    const originalExtension: CompressedImage["extension"] =
      metadata.format === "png" ? "png" : metadata.format === "webp" ? "webp" : "jpg";
    let best: CompressedImage = { bytes, extension: originalExtension };

    const resized = sharp(bytes, options)
      .rotate()
      .resize({
        width: maxDimension,
        height: maxDimension,
        fit: "inside",
        withoutEnlargement: true,
      });

    for (const quality of [80, 65, 50, 40, 25, 10, 1]) {
      const candidate = await resized.clone().webp({ quality, effort: 3 }).toBuffer();
      if (candidate.byteLength < best.bytes.byteLength) {
        best = { bytes: candidate, extension: "webp" };
      }
      // Keep the highest quality that actually reduces the file size.
      if (candidate.byteLength < bytes.byteLength) {
        return { bytes: candidate, extension: "webp" };
      }
    }
    return best;
  } catch {
    throw new UploadError("Invalid image");
  }
}

/** Validate, compress and persist an image, returning its local API URL. */
export async function saveUploadedImage(file: FormDataEntryValue | null): Promise<string> {
  if (!isUploadFile(file)) throw new UploadError("Missing file");
  if (!allowedTypes.has(file.type)) throw new UploadError("Unsupported file type");
  if (file.size > maxBytes) throw new UploadError("File too large");

  const bytes = Buffer.from(await file.arrayBuffer());
  if (!hasImageSignature(bytes, file.type)) {
    throw new UploadError("File contents do not match the type");
  }

  const compressed = await compressUploadedImage(bytes);
  const fileName = `${randomUUID()}.${compressed.extension}`;
  const uploadDir = path.join(process.cwd(), "uploads");

  await mkdir(uploadDir, { recursive: true });
  await writeFile(path.join(uploadDir, fileName), compressed.bytes);
  return `/api/uploads/${fileName}`;
}

function hasVideoSignature(bytes: Buffer, type: string): boolean {
  if (type === "video/mp4") {
    return bytes.length > 12 && bytes.toString("ascii", 4, 8) === "ftyp";
  }
  return (
    bytes.length >= 4 &&
    bytes[0] === 0x1a &&
    bytes[1] === 0x45 &&
    bytes[2] === 0xdf &&
    bytes[3] === 0xa3
  );
}

export type SavedVideo = {
  url: string;
  fileName: string;
  contentType: "video/mp4" | "video/webm";
};

/** Persist a small background video without transcoding it. */
export async function saveUploadedVideo(file: FormDataEntryValue | null): Promise<SavedVideo> {
  if (!isUploadFile(file)) throw new UploadError("Missing file");
  if (!allowedVideoTypes.has(file.type)) throw new UploadError("Unsupported file type");
  if (file.size > maxVideoBytes) throw new UploadError("File too large");

  const bytes = Buffer.from(await file.arrayBuffer());
  if (!hasVideoSignature(bytes, file.type)) {
    throw new UploadError("File contents do not match the type");
  }

  const fileName = `${randomUUID()}.${file.type === "video/webm" ? "webm" : "mp4"}`;
  const uploadDir = path.join(process.cwd(), "uploads");
  await mkdir(uploadDir, { recursive: true });
  await writeFile(path.join(uploadDir, fileName), bytes);

  return {
    url: `/api/uploads/${fileName}`,
    fileName,
    contentType: file.type === "video/webm" ? "video/webm" : "video/mp4",
  };
}
