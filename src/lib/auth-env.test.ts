import { afterEach, describe, expect, it, vi } from "vitest";
import { appOrigin, appUrl, assertSafeAuthSecret, resolveAuthTrustHost } from "./auth-env";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("assertSafeAuthSecret", () => {
  it("rejects the documented placeholder in production", () => {
    expect(() =>
      assertSafeAuthSecret({
        NODE_ENV: "production",
        AUTH_SECRET: "replace-with-a-long-random-secret",
      }),
    ).toThrow(/AUTH_SECRET/);
  });

  it("allows an explicit local-only production opt-out", () => {
    expect(() =>
      assertSafeAuthSecret({
        NODE_ENV: "production",
        AUTH_SECRET: "replace-with-a-long-random-secret",
        ALLOW_DEV_SECRET: "1",
      }),
    ).not.toThrow();
  });

  it("allows a real secret in production and placeholders outside production", () => {
    expect(() =>
      assertSafeAuthSecret({
        NODE_ENV: "production",
        AUTH_SECRET: "a-generated-random-secret",
      }),
    ).not.toThrow();
    expect(() =>
      assertSafeAuthSecret({
        NODE_ENV: "development",
        AUTH_SECRET: "replace-with-a-long-random-secret",
      }),
    ).not.toThrow();
  });
});

describe("resolveAuthTrustHost", () => {
  it("only enables Host trust for explicit opt-ins", () => {
    expect(resolveAuthTrustHost("true")).toBe(true);
    expect(resolveAuthTrustHost(" TRUE ")).toBe(true);
    expect(resolveAuthTrustHost("false")).toBe(false);
    expect(resolveAuthTrustHost(undefined)).toBe(false);
  });
});

describe("appOrigin / appUrl", () => {
  it("prefers the configured canonical origin over the request URL", () => {
    vi.stubEnv("APP_URL", "https://app.example.test");
    vi.stubEnv("AUTH_URL", "https://auth.example.test");
    expect(appOrigin("https://untrusted.example.test/en/login")).toBe("https://app.example.test");
    expect(appUrl("/en/member/dashboard", "https://untrusted.example.test/x").toString()).toBe(
      "https://app.example.test/en/member/dashboard",
    );
  });

  it("falls back to the request origin so localhost verification keeps working", () => {
    vi.stubEnv("APP_URL", "");
    vi.stubEnv("AUTH_URL", "");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "");
    expect(appOrigin("http://localhost:3000/en/login")).toBe("http://localhost:3000");
    expect(appUrl("/en/login", "http://localhost:3000/en/login").toString()).toBe(
      "http://localhost:3000/en/login",
    );
  });
});
