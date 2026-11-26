import {
  normalizeAuthBannerVideoInput,
  parseAuthBannerVideo,
  toAuthBannerMedia,
  type AuthBannerMedia,
  type AuthBannerVideo,
} from "./auth-banner-video";

/** Product media reuses the same validated shapes as the auth banner video. */
export type ProductVideo = AuthBannerVideo;
export type ProductVideoMedia = AuthBannerMedia;

export function normalizeProductVideoInput(rawInput: string | null | undefined): ProductVideo | null {
  return normalizeAuthBannerVideoInput(rawInput ?? "");
}

export function parseProductVideo(value: unknown): ProductVideo | null {
  return parseAuthBannerVideo(value);
}

export function toProductVideoMedia(video: ProductVideo | null | undefined): ProductVideoMedia | null {
  return video ? toAuthBannerMedia(video) : null;
}
