import { describe, expect, it } from "vitest";
import { rankProgressPercent } from "./rank-progress";

describe("rankProgressPercent", () => {
  it("averages direct and team qualification paths", () => {
    expect(
      rankProgressPercent({
        bestDirectPaisa: "50",
        nextRank: {
          directTargetPaisa: "100",
          teamTargetsPaisa: ["30", "20", "10"],
          teamTotalsPaisa: ["15", "20", "30"],
        },
      }),
    ).toBe(88);
  });

  it("pairs sorted team totals with sorted targets", () => {
    // Direct 25%, teams 100% + 50% + 0% => 43.75% rounded to 44%.
    expect(
      rankProgressPercent({
        bestDirectPaisa: "25",
        nextRank: {
          directTargetPaisa: "100",
          teamTargetsPaisa: ["30", "20", "10"],
          teamTotalsPaisa: ["10", "30", "0"],
        },
      }),
    ).toBe(44);
  });

  it("caps each path at 100 percent", () => {
    expect(
      rankProgressPercent({
        bestDirectPaisa: "500",
        nextRank: {
          directTargetPaisa: "100",
          teamTargetsPaisa: ["10", "10", "10"],
          teamTotalsPaisa: ["10", "10", "10"],
        },
      }),
    ).toBe(100);
  });

  it("shows a full bar when every rank is achieved", () => {
    expect(rankProgressPercent({ nextRank: null, bestDirectPaisa: "0" })).toBe(100);
  });

  it("ignores zero targets instead of diluting the average", () => {
    expect(
      rankProgressPercent({
        bestDirectPaisa: "10",
        nextRank: {
          directTargetPaisa: "20",
          teamTargetsPaisa: ["0", "0", "0"],
          teamTotalsPaisa: ["0", "0", "0"],
        },
      }),
    ).toBe(50);
  });
});
