/** Path pattern for files produced by POST /api/uploads. */
export const uploadedImageUrlSource = String.raw`\/api\/uploads\/[0-9a-f-]+\.(jpg|png|webp)`;

/** Full validation pattern. Rejects arbitrary external image URLs. */
export const uploadedImageUrlPattern = new RegExp(`^${uploadedImageUrlSource}$`);

export function isUploadedImageUrl(value: string): boolean {
  return uploadedImageUrlPattern.test(value);
}
