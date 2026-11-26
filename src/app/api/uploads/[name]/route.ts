import { readFile } from "node:fs/promises";
import path from "node:path";

export const dynamic = "force-dynamic";

const contentTypes: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
};

function badRange(size: number) {
  return new Response(null, {
    status: 416,
    headers: { "Content-Range": `bytes */${size}`, "Accept-Ranges": "bytes" },
  });
}

export async function GET(request: Request, context: { params: Promise<{ name: string }> }) {
  const { name } = await context.params;
  if (!/^[a-f0-9-]+\.(jpg|png|webp|mp4|webm)$/.test(name)) {
    return new Response("Not found", { status: 404 });
  }

  try {
    const bytes = await readFile(path.join(process.cwd(), "uploads", name));
    const extension = path.extname(name);
    const contentType = contentTypes[extension] ?? "application/octet-stream";
    const cacheControl = "public, max-age=31536000, immutable";

    const range = request.headers.get("range");
    if (range) {
      const match = /^bytes=(\d*)-(\d*)$/.exec(range.trim());
      if (!match || (!match[1] && !match[2])) return badRange(bytes.length);

      const suffix = !match[1];
      const start = suffix
        ? Math.max(0, bytes.length - Number(match[2]))
        : Number(match[1]);
      const requestedEnd = suffix ? bytes.length - 1 : match[2] ? Number(match[2]) : bytes.length - 1;
      const end = Math.min(requestedEnd, bytes.length - 1);

      if (
        !Number.isFinite(start) ||
        !Number.isFinite(end) ||
        start > end ||
        start >= bytes.length
      ) {
        return badRange(bytes.length);
      }

      const chunk = bytes.subarray(start, end + 1);
      return new Response(new Uint8Array(chunk), {
        status: 206,
        headers: {
          "Content-Type": contentType,
          "Content-Range": `bytes ${start}-${end}/${bytes.length}`,
          "Content-Length": String(chunk.byteLength),
          "Accept-Ranges": "bytes",
          "Cache-Control": cacheControl,
        },
      });
    }

    return new Response(new Uint8Array(bytes), {
      headers: {
        "Content-Type": contentType,
        "Content-Length": String(bytes.byteLength),
        "Accept-Ranges": "bytes",
        "Cache-Control": cacheControl,
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
