import { describe, expect, it } from "vitest";
import {
  categoryAuditValues,
  categoryParentId,
  categoryWriteSchema,
  normalizeCategoryImageUrl,
  slugifyCategoryName,
} from "./category-admin";

describe("category admin input", () => {
  it("accepts both main categories and subcategories", () => {
    const main = categoryWriteSchema.parse({ name: "Health", slug: "health" });
    const child = categoryWriteSchema.parse({
      name: "Vitamins",
      slug: "vitamins",
      parentId: "cat_123",
    });

    expect(categoryParentId(main)).toBeNull();
    expect(categoryParentId(child)).toBe("cat_123");
    expect(categoryAuditValues(child).parentId).toBe("cat_123");
  });

  it("rejects blank or malformed parent ids", () => {
    expect(
      categoryWriteSchema.safeParse({ name: "Child", slug: "child", parentId: "   " }).success,
    ).toBe(false);
    expect(
      categoryWriteSchema.safeParse({ name: "Child", slug: "child", parentId: 42 }).success,
    ).toBe(false);
  });

  it("keeps slug and image normalization unchanged", () => {
    expect(slugifyCategoryName("Health & Wellness")).toBe("health-wellness");
    expect(normalizeCategoryImageUrl("/api/uploads/a.webp")).toBe("/api/uploads/a.webp");
    expect(normalizeCategoryImageUrl("javascript:alert(1)")).toBeNull();
  });
});
