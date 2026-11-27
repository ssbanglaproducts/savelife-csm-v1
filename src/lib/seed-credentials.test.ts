import { describe, expect, it } from "vitest";
import { resolveSeedPasswords } from "./seed-credentials";

function env(values: Record<string, string | undefined>): NodeJS.ProcessEnv {
  return { ...process.env, ...values };
}

describe("resolveSeedPasswords", () => {
  it("keeps the documented development defaults unchanged", () => {
    expect(resolveSeedPasswords(env({}), "development")).toEqual({
      adminPassword: "Admin@123456",
      founderPassword: "Founder@123456",
    });
  });

  it("allows explicit development overrides", () => {
    expect(
      resolveSeedPasswords(
        env({ SEED_ADMIN_PASSWORD: "DevAdmin!", SEED_FOUNDER_PASSWORD: "DevFounder!" }),
        "development",
      ),
    ).toEqual({ adminPassword: "DevAdmin!", founderPassword: "DevFounder!" });
  });

  it("requires both bootstrap passwords in production", () => {
    expect(() => resolveSeedPasswords(env({}), "production")).toThrow(/SEED_ADMIN_PASSWORD/);
    expect(() =>
      resolveSeedPasswords(env({ SEED_ADMIN_PASSWORD: "long-enough-admin" }), "production"),
    ).toThrow(/SEED_FOUNDER_PASSWORD/);
  });

  it("rejects short or whitespace-only production passwords", () => {
    expect(() =>
      resolveSeedPasswords(
        env({ SEED_ADMIN_PASSWORD: "short", SEED_FOUNDER_PASSWORD: "long-enough-founder" }),
        "production",
      ),
    ).toThrow(/SEED_ADMIN_PASSWORD/);
    expect(() =>
      resolveSeedPasswords(
        env({ SEED_ADMIN_PASSWORD: "   ", SEED_FOUNDER_PASSWORD: "long-enough-founder" }),
        "production",
      ),
    ).toThrow(/SEED_ADMIN_PASSWORD/);
  });

  it("uses trimmed production values", () => {
    expect(
      resolveSeedPasswords(
        env({
          SEED_ADMIN_PASSWORD: "  long-enough-admin  ",
          SEED_FOUNDER_PASSWORD: "  long-enough-founder  ",
        }),
        "production",
      ),
    ).toEqual({ adminPassword: "long-enough-admin", founderPassword: "long-enough-founder" });
  });
});
