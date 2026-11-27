import { NextResponse } from "next/server";
import { activeMemberErrorResponse, requireActivePrincipalApi } from "@/lib/member-access";
import { UploadError, saveUploadedImage } from "@/lib/upload-server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const access = await requireActivePrincipalApi();
  if (!access.ok) return activeMemberErrorResponse(access);

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
