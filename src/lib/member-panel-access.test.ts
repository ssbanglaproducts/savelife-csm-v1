import { describe, expect, it } from "vitest";
import { isInactiveRestrictedPath, isPathOpenToInactive } from "./member-panel-access";

describe("member panel access for inactive accounts", () => {
  it("keeps account basics available", () => {
    expect(isPathOpenToInactive("/member/dashboard")).toBe(true);
    expect(isPathOpenToInactive("/member/profile")).toBe(true);
    expect(isPathOpenToInactive("/member/team")).toBe(false);
    expect(isPathOpenToInactive("/member/rank-rewards")).toBe(false);
    expect(isPathOpenToInactive("/member/investments/SL-INV-1")).toBe(false);
  });

  it("locks transactional member pages", () => {
    expect(isInactiveRestrictedPath("/member/orders")).toBe(true);
    expect(isInactiveRestrictedPath("/member/investments/abc")).toBe(true);
    expect(isInactiveRestrictedPath("/member/withdrawals")).toBe(true);
    expect(isInactiveRestrictedPath("/member/send-money")).toBe(true);
    expect(isInactiveRestrictedPath("/member/team")).toBe(true);
    expect(isInactiveRestrictedPath("/member/rank-rewards")).toBe(true);
  });

  it("allows wallet funding and history pages", () => {
    expect(isInactiveRestrictedPath("/member/wallet")).toBe(false);
    expect(isInactiveRestrictedPath("/member/transactions")).toBe(false);
    expect(isInactiveRestrictedPath("/member/top-up")).toBe(false);
    expect(isPathOpenToInactive("/member/wallet")).toBe(true);
    expect(isPathOpenToInactive("/member/top-up")).toBe(true);
  });

  it("allows basic pages, store routes and order confirmation", () => {
    expect(isInactiveRestrictedPath("/member/dashboard")).toBe(false);
    expect(isInactiveRestrictedPath("/member/profile")).toBe(false);
    expect(isInactiveRestrictedPath("/member/referrals")).toBe(false);
    expect(isInactiveRestrictedPath("/member/program")).toBe(false);
    expect(isInactiveRestrictedPath("/products")).toBe(false);
    expect(isInactiveRestrictedPath("/orders/SL-ORD-1")).toBe(false);
  });

  it("normalizes trailing slashes", () => {
    expect(isInactiveRestrictedPath("/member/orders/")).toBe(true);
    expect(isPathOpenToInactive("/member/profile/")).toBe(true);
  });
});
