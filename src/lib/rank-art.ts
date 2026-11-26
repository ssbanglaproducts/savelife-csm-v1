import { isUploadedImageUrl } from "./uploads";

/** Official transparent cutouts shipped with the app for physical rewards. */
export const DEFAULT_RANK_REWARD_IMAGES: Record<string, string> = {
  R4: "/images/rank-rewards/motorcycle.png",
  R6: "/images/rank-rewards/luxury-car.png",
  R7: "/images/rank-rewards/world-tour.png",
  R8: "/images/rank-rewards/flat.png",
  R9: "/images/rank-rewards/duplex-house.png",
};

const bundledImagePattern = /^\/images\/rank-rewards\/[a-z0-9-]+\.png$/;
const bundledBadgePattern = /^\/images\/ranks\/r[1-9]\.(?:png|svg)$/;
const legacyBundledBadgePattern = /^\/images\/ranks\/r[1-9]\.svg$/;

/**
 * Physical reward art must be either a bundled transparent PNG or an image
 * produced by the local upload endpoint. External URLs are never accepted.
 */
export function normalizeRankRewardImageUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const url = value.trim();
  if (!url) return null;
  if (isUploadedImageUrl(url) || bundledImagePattern.test(url)) return url;
  return null;
}

/** Rank badges may be an official cutout or a local admin upload. */
export function normalizeRankBadgeImageUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const url = value.trim();
  if (!url) return null;
  if (isUploadedImageUrl(url) || bundledBadgePattern.test(url)) return url;
  return null;
}

/** Rejects external or hand-typed paths while accepting bundled/local images. */
export function isAllowedRankBadgeImageUrl(value: unknown): boolean {
  return normalizeRankBadgeImageUrl(value) !== null;
}

/** Uses stored art, upgrading legacy bundled SVGs to the official cutouts. */
export function resolveRankBadgeImageUrl(value: unknown, rankKey: string): string {
  const normalized = normalizeRankBadgeImageUrl(value);
  if (normalized && !legacyBundledBadgePattern.test(normalized)) return normalized;
  return rankBadgeSrc(rankKey);
}

/** Falls back to the official cutout when a physical rank has no custom art. */
export function defaultRankRewardImage(rankKey: string): string | null {
  return DEFAULT_RANK_REWARD_IMAGES[rankKey] ?? null;
}

/** Rejects external or hand-typed paths while accepting bundled/local images. */
export function isAllowedRankRewardImageUrl(value: unknown): boolean {
  return normalizeRankRewardImageUrl(value) !== null;
}

/** Official transparent rank cutouts are keyed by stable rank level. */
export function rankBadgeSrc(rankKey: string): string {
  const match = /^R([1-9])$/.exec(rankKey);
  return `/images/ranks/r${match ? match[1] : "1"}.png`;
}
