import { describe, expect, it } from "vitest";
import {
  defaultRankRewardImage,
  isAllowedRankBadgeImageUrl,
  isAllowedRankRewardImageUrl,
  normalizeRankRewardImageUrl,
  rankBadgeSrc,
  resolveRankBadgeImageUrl,
} from "./rank-art";

describe("rank artwork", () => {
  it("uses the official transparent cutouts for physical rewards", () => {
    expect(defaultRankRewardImage("R4")).toBe("/images/rank-rewards/motorcycle.png");
    expect(defaultRankRewardImage("R6")).toBe("/images/rank-rewards/luxury-car.png");
    expect(defaultRankRewardImage("R7")).toBe("/images/rank-rewards/world-tour.png");
    expect(defaultRankRewardImage("R8")).toBe("/images/rank-rewards/flat.png");
    expect(defaultRankRewardImage("R9")).toBe("/images/rank-rewards/duplex-house.png");
    expect(defaultRankRewardImage("R1")).toBeNull();
  });

  it("accepts bundled art and local uploads but rejects external URLs", () => {
    expect(isAllowedRankRewardImageUrl("/images/rank-rewards/flat.png")).toBe(true);
    expect(
      isAllowedRankRewardImageUrl("/api/uploads/123e4567-e89b-12d3-a456-426614174000.png"),
    ).toBe(true);
    expect(isAllowedRankRewardImageUrl("https://example.com/car.png")).toBe(false);
    expect(normalizeRankRewardImageUrl("  /images/rank-rewards/flat.png  ")).toBe(
      "/images/rank-rewards/flat.png",
    );
  });

  it("maps each rank key to its own transparent badge cutout", () => {
    expect(rankBadgeSrc("R1")).toBe("/images/ranks/r1.png");
    expect(rankBadgeSrc("R9")).toBe("/images/ranks/r9.png");
    expect(rankBadgeSrc("unknown")).toBe("/images/ranks/r1.png");
  });

  it("accepts local badge uploads and official cutouts but rejects external URLs", () => {
    const uploaded = "/api/uploads/123e4567-e89b-12d3-a456-426614174000.png";
    expect(isAllowedRankBadgeImageUrl(uploaded)).toBe(true);
    expect(isAllowedRankBadgeImageUrl("/images/ranks/r4.png")).toBe(true);
    expect(isAllowedRankBadgeImageUrl("https://example.com/badge.png")).toBe(false);
    expect(resolveRankBadgeImageUrl(uploaded, "R4")).toBe(uploaded);
    expect(resolveRankBadgeImageUrl(null, "R4")).toBe("/images/ranks/r4.png");
    expect(resolveRankBadgeImageUrl("https://example.com/badge.png", "R4")).toBe(
      "/images/ranks/r4.png",
    );
  });

  it("upgrades legacy bundled svg badges to the current cutouts", () => {
    const legacy = "/images/ranks/r4.svg";
    expect(isAllowedRankBadgeImageUrl(legacy)).toBe(true);
    expect(resolveRankBadgeImageUrl(legacy, "R4")).toBe("/images/ranks/r4.png");
    expect(resolveRankBadgeImageUrl("/images/ranks/r7.svg", "R9")).toBe("/images/ranks/r9.png");
  });
});
