import {
  FixedWindowLimiter,
  InMemoryKeyValueStore,
  requestIpKey,
  sharedRateLimiter,
  type WindowState,
} from "@/lib/rate-limit";

const LIMIT = 12;
const WINDOW_MS = 10 * 60_000;

/**
 * Public registration photos have no session or database identity, so they get
 * a conservative per-IP fixed window. Process-local by design; see README.
 */
const publicUploadLimiter = sharedRateLimiter(
  "public-upload-limiter",
  () =>
    new FixedWindowLimiter(
      new InMemoryKeyValueStore<WindowState>(10_000),
      { limit: LIMIT, windowMs: WINDOW_MS, maxTrackedKeys: 10_000 },
    ),
);

export async function checkPublicUploadLimit(request: Request) {
  const result = await publicUploadLimiter.consume(requestIpKey(request));
  return {
    ...result,
    retryAfterSeconds: Math.max(1, Math.ceil(result.retryAfterMs / 1000)),
  };
}

export const PUBLIC_UPLOAD_ERROR_CODE = "UPLOAD_RATE_LIMITED";
