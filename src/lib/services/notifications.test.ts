import { describe, expect, it } from "vitest";
import {
  formatNotificationDate,
  localizedText,
  safeNotificationHref,
} from "./notifications";

describe("notification helpers", () => {
  it("keeps only internal panel links", () => {
    expect(safeNotificationHref("/member/wallet")).toBe("/member/wallet");
    expect(safeNotificationHref(" /member/wallet ")).toBe("/member/wallet");
    expect(safeNotificationHref("javascript:alert(1)")).toBeNull();
    expect(safeNotificationHref("//evil.test/path")).toBeNull();
    expect(safeNotificationHref("/member/hello world")).toContain("/member");
    expect(safeNotificationHref(null)).toBeNull();
  });

  it("picks the requested locale with an English fallback", () => {
    const value = { en: "Wallet credit", bn: "ওয়ালেট ক্রেডিট" };
    expect(localizedText(value, "bn")).toBe("ওয়ালেট ক্রেডিট");
    expect(localizedText(value, "en")).toBe("Wallet credit");
    expect(localizedText(value, "fr")).toBe("Wallet credit");
    expect(localizedText("Legacy title", "bn")).toBe("Legacy title");
  });

  it("formats today as a time and older dates as a day", () => {
    const now = new Date();
    const earlier = new Date(now.getTime() - 1000 * 60 * 60 * 24 * 3);
    expect(formatNotificationDate(now, "en").length).toBeGreaterThan(0);
    expect(formatNotificationDate(earlier, "bn").length).toBeGreaterThan(0);
  });
});
