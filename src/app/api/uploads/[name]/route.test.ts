import { randomUUID } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { parseByteRange, serveUpload } from "./route";

const DATA = Buffer.from("0123456789abcdef");

let baseDir: string;
let name: string;

function request(range?: string): Request {
  return new Request(`http://localhost/api/uploads/${name}`, {
    headers: range ? { range } : {},
  });
}

async function body(response: Response): Promise<string> {
  return new TextDecoder().decode(await response.arrayBuffer());
}

beforeEach(async () => {
  baseDir = await mkdtemp(path.join(tmpdir(), "savelife-upload-route-"));
  name = `${randomUUID()}.mp4`;
  await writeFile(path.join(baseDir, name), DATA);
});

afterEach(async () => {
  await rm(baseDir, { recursive: true, force: true });
});

describe("parseByteRange", () => {
  it("parses open-ended, explicit and suffix ranges", () => {
    expect(parseByteRange("bytes=4-", DATA.length)).toEqual({ start: 4, end: 15 });
    expect(parseByteRange("bytes=4-9", DATA.length)).toEqual({ start: 4, end: 9 });
    expect(parseByteRange("bytes=-4", DATA.length)).toEqual({ start: 12, end: 15 });
  });

  it("rejects malformed and out-of-bounds ranges", () => {
    expect(parseByteRange(null, DATA.length)).toBeNull();
    expect(parseByteRange("bytes=", DATA.length)).toBeNull();
    expect(parseByteRange("bytes=9-4", DATA.length)).toBeNull();
    expect(parseByteRange("bytes=16-", DATA.length)).toBeNull();
    expect(parseByteRange("items=0-1", DATA.length)).toBeNull();
  });
});

describe("serveUpload", () => {
  it("streams the whole file with the original headers", async () => {
    const response = await serveUpload(name, request(), baseDir);

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("video/mp4");
    expect(response.headers.get("content-length")).toBe("16");
    expect(response.headers.get("accept-ranges")).toBe("bytes");
    expect(response.headers.get("cache-control")).toBe("public, max-age=31536000, immutable");
    expect(await body(response)).toBe(DATA.toString());
  });

  it("returns only the requested byte range with Content-Range", async () => {
    const response = await serveUpload(name, request("bytes=4-9"), baseDir);

    expect(response.status).toBe(206);
    expect(response.headers.get("content-range")).toBe("bytes 4-9/16");
    expect(response.headers.get("content-length")).toBe("6");
    expect(await body(response)).toBe("456789");
  });

  it("supports suffix ranges", async () => {
    const response = await serveUpload(name, request("bytes=-4"), baseDir);

    expect(response.status).toBe(206);
    expect(response.headers.get("content-range")).toBe("bytes 12-15/16");
    expect(await body(response)).toBe("cdef");
  });

  it("returns 416 with a satisfiable range for invalid requests", async () => {
    const response = await serveUpload(name, request("bytes=20-"), baseDir);

    expect(response.status).toBe(416);
    expect(response.headers.get("content-range")).toBe("bytes */16");
  });

  it("does not serve traversal attempts or missing files", async () => {
    expect((await serveUpload("../seed.ts", request(), baseDir)).status).toBe(404);
    expect((await serveUpload(`${randomUUID()}.jpg`, request(), baseDir)).status).toBe(404);
  });
});
