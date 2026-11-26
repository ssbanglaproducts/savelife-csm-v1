import { isUploadedImageUrl } from "./uploads";

/** Uploads one image and returns the local URL accepted by the API schemas. */
export async function uploadImage(file: File): Promise<string> {
  const body = new FormData();
  body.append("file", file);

  const response = await fetch("/api/uploads", { method: "POST", body });
  const data = (await response.json().catch(() => ({}))) as {
    url?: string;
    error?: string;
  };

  if (!response.ok || typeof data.url !== "string") {
    throw new Error(data.error ?? "Upload failed");
  }
  if (!isUploadedImageUrl(data.url)) {
    throw new Error("Invalid upload URL");
  }
  return data.url;
}
