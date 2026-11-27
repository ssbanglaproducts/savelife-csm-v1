import { NextResponse } from "next/server";
import { checkPublicUploadLimit, PUBLIC_UPLOAD_ERROR_CODE } from "@/lib/upload-rate-limit";
import { UploadError, saveUploadedImage } from "@/lib/upload-server";

export const dynamic = "force-dynamic";

/** Public upload used only for the optional Step 1 profile picture. */
export async function POST(request: Request) {
  const limit = await checkPublicUploadLimit(request);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: PUBLIC_UPLOAD_ERROR_CODE },
      {
        status: 429,
        headers: { "Retry-After": String(limit.retryAfterSeconds), "Cache-Control": "no-store" },
      },
    );
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid upload" }, { status: 400 });
  }

  try {
    const url = await saveUploadedImage(formData.get("file"));
    return NextResponse.json({ url }, { status: 201 });
  } catch (error) {
    if (error instanceof UploadError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }
}
