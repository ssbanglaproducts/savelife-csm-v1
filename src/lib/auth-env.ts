/**
 * Edge-safe helpers for auth environment setup and canonical app URLs.
 * Keep these functions free of Node-only imports so `auth.config.ts` can be
 * loaded by the Next.js proxy as well as the Node auth instance.
 */

const PLACEHOLDER_AUTH_SECRETS = new Set([
  // Exact value shipped in .env.example; deliberately narrow so an existing
  // local production build with an intentionally dev-only secret still runs.
  "replace-with-a-long-random-secret",
]);

export type AuthEnv = {
  NODE_ENV?: string;
  AUTH_SECRET?: string;
  ALLOW_DEV_SECRET?: string;
};

export function isExplicitlyEnabled(value: string | undefined): boolean {
  return /^(1|true|yes|on)$/i.test(value?.trim() ?? "");
}

/**
 * Fail fast when the documented example secret reaches production. Operators
 * who intentionally use a local stand-in can opt out with ALLOW_DEV_SECRET=1;
 * this flag is never set in the shipped compose configuration.
 */
export function assertSafeAuthSecret(env: AuthEnv): void {
  if (env.NODE_ENV !== "production" || isExplicitlyEnabled(env.ALLOW_DEV_SECRET)) return;

  const secret = env.AUTH_SECRET?.trim();
  if (secret && PLACEHOLDER_AUTH_SECRETS.has(secret)) {
    throw new Error(
      "AUTH_SECRET is still the .env.example placeholder. Generate a strong random secret before deploying, or set ALLOW_DEV_SECRET=1 for an intentional local-only build.",
    );
  }
}

/** Auth.js should trust Host only when an operator explicitly asks for it. */
export function resolveAuthTrustHost(value: string | undefined): boolean {
  return isExplicitlyEnabled(value);
}

function originFrom(value: string | undefined): URL | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url;
  } catch {
    return null;
  }
}

/**
 * Canonical redirect origin: explicit configuration wins, then the incoming
 * request URL (which keeps bare localhost verification working). Never derive
 * it from an unvalidated Host header separately.
 */
export function appOrigin(requestUrl?: string): string {
  const configured =
    originFrom(process.env.APP_URL) ??
    originFrom(process.env.AUTH_URL) ??
    originFrom(process.env.NEXT_PUBLIC_APP_URL);
  if (configured) return configured.origin;

  const requestOrigin = originFrom(requestUrl);
  if (requestOrigin) return requestOrigin.origin;
  return "http://localhost:3000";
}

export function appUrl(pathname: string, requestUrl?: string): URL {
  return new URL(pathname, appOrigin(requestUrl));
}
