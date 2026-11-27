import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { UploadError, saveUploadedVideo } from "@/lib/upload-server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid upload" }, { status: 400 });
  }

  try {
    const video = await saveUploadedVideo(formData.get("file"));
    return NextResponse.json({ url: video.url, contentType: video.contentType }, { status: 201 });
  } catch (error) {
    if (error instanceof UploadError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }
}
