import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";

export const dynamic = "force-dynamic";

const contentTypes: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
};

type ByteRange = { start: number; end: number };

export function parseByteRange(header: string | null, size: number): ByteRange | null {
  if (!header) return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!match || (!match[1] && !match[2])) return null;

  const suffix = !match[1];
  const start = suffix ? Math.max(0, size - Number(match[2])) : Number(match[1]);
  const requestedEnd = suffix ? size - 1 : match[2] ? Number(match[2]) : size - 1;
  const end = Math.min(requestedEnd, size - 1);

  if (!Number.isFinite(start) || !Number.isFinite(end) || start > end || start >= size) {
    return null;
  }
  return { start, end };
}

function badRange(size: number) {
  return new Response(null, {
    status: 416,
    headers: { "Content-Range": `bytes */${size}`, "Accept-Ranges": "bytes" },
  });
}

function webStream(filePath: string, start?: number, end?: number): ReadableStream<Uint8Array> {
  const stream =
    start === undefined || end === undefined
      ? createReadStream(filePath)
      : createReadStream(filePath, { start, end });
  return Readable.toWeb(stream) as ReadableStream<Uint8Array>;
}

/**
 * Stream from disk instead of reading the whole upload into memory. The public
 * response contract (status codes, Content-Range and headers) is unchanged.
 */
export async function serveUpload(
  name: string,
  request: Request,
  baseDir = path.join(process.cwd(), "uploads"),
): Promise<Response> {
  if (!/^[a-f0-9-]+\.(jpg|png|webp|mp4|webm)$/.test(name)) {
    return new Response("Not found", { status: 404 });
  }

  try {
    const filePath = path.join(/*turbopackIgnore: true*/ baseDir, name);
    const { size } = await stat(/*turbopackIgnore: true*/ filePath);
    const extension = path.extname(name);
    const contentType = contentTypes[extension] ?? "application/octet-stream";
    const cacheControl = "public, max-age=31536000, immutable";

    const header = request.headers.get("range");
    const range = parseByteRange(header, size);
    if (header && !range) return badRange(size);

    if (range) {
      return new Response(webStream(filePath, range.start, range.end), {
        status: 206,
        headers: {
          "Content-Type": contentType,
          "Content-Range": `bytes ${range.start}-${range.end}/${size}`,
          "Content-Length": String(range.end - range.start + 1),
          "Accept-Ranges": "bytes",
          "Cache-Control": cacheControl,
        },
      });
    }

    return new Response(webStream(filePath), {
      headers: {
        "Content-Type": contentType,
        "Content-Length": String(size),
        "Accept-Ranges": "bytes",
        "Cache-Control": cacheControl,
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}

export async function GET(request: Request, context: { params: Promise<{ name: string }> }) {
  const { name } = await context.params;
  return serveUpload(name, request);
}
