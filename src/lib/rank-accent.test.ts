import { describe, expect, it } from "vitest";
import { rankAccent, rankAccentTier, rankProgressGradient } from "./rank-accent";

describe("rank accents", () => {
  it("keeps the first three ranks on the default palette", () => {
    expect(rankAccentTier("R1")).toBe("default");
    expect(rankAccentTier("R2")).toBe("default");
    expect(rankAccentTier("R3")).toBe("default");
    expect(rankAccent("R3").border).toBe("");
  });

  it("adds restrained royal, gold, and purple tiers", () => {
    expect(rankAccentTier("R4")).toBe("royal");
    expect(rankAccentTier("R6")).toBe("royal");
    expect(rankAccentTier("R7")).toBe("gold");
    expect(rankAccentTier("R8")).toBe("gold");
    expect(rankAccentTier("R9")).toBe("purple");
    expect(rankAccent("R5").border).toContain("blue");
    expect(rankAccent("R5").progress).toContain("blue");
    expect(rankAccent("R8").border).toContain("amber");
    expect(rankAccent("R8").progress).toContain("amber");
    expect(rankAccent("R9").border).toContain("purple");
    expect(rankAccent("R9").progress).toContain("purple");
  });

  it("uses a gradient salary fill only for ranks 7 through 9", () => {
    expect(rankProgressGradient("R6")).toBeNull();
    expect(rankProgressGradient("R7")).toContain("bg-gradient-to-r");
    expect(rankProgressGradient("R8")).toContain("bg-gradient-to-r");
    expect(rankProgressGradient("R9")).toContain("bg-gradient-to-r");
    expect(rankProgressGradient(null)).toBeNull();
  });

  it("treats unknown rank keys as default", () => {
    expect(rankAccentTier(null)).toBe("default");
    expect(rankAccentTier("unknown")).toBe("default");
  });
});
