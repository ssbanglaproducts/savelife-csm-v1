import { describe, expect, it } from "vitest";
import { panelNavIcons } from "./panel-nav-icons";

/** Every link currently rendered by the admin sidebar. */
const ADMIN_SIDEBAR_HREFS = [
  "/admin/dashboard",
  "/admin/members",
  "/admin/orders",
  "/admin/products",
  "/admin/categories",
  "/admin/investments",
  "/admin/distributions",
  "/admin/affiliate-commissions",
  "/admin/roi-commission",
  "/admin/ranks",
  "/admin/salary",
  "/admin/withdrawals",
  "/admin/top-ups",
  "/admin/settings",
  "/admin/gallery",
  "/admin/announcements",
  "/admin/audit",
  "/admin/staff",
] as const;

describe("admin sidebar icons", () => {
  it("gives every rendered admin link an explicit icon", () => {
    for (const href of ADMIN_SIDEBAR_HREFS) {
      expect(panelNavIcons[href], `missing icon for ${href}`).toBeDefined();
    }
  });

  it("uses a distinct icon for every rendered admin link", () => {
    const icons = ADMIN_SIDEBAR_HREFS.map((href) => panelNavIcons[href]);
    expect(new Set(icons).size).toBe(ADMIN_SIDEBAR_HREFS.length);
  });
});
