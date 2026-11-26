import { describe, expect, it } from "vitest";
import { bpsToPercent, formatPercent, percentToBps } from "./rates";

describe("rate conversion", () => {
  it("converts basis points to percentages", () => {
    expect(bpsToPercent(20000)).toBe(200);
    expect(bpsToPercent(1000)).toBe(10);
    expect(bpsToPercent(1050)).toBe(10.5);
  });

  it("converts percentages to basis points without floating point drift", () => {
    expect(percentToBps(200)).toBe(20000);
    expect(percentToBps(10)).toBe(1000);
    expect(percentToBps(2.5)).toBe(250);
    expect(percentToBps(10.01)).toBe(1001);
  });

  it("formats basis points for display", () => {
    expect(formatPercent(20000)).toBe("200%");
    expect(formatPercent(1000)).toBe("10%");
    expect(formatPercent(1050)).toBe("10.5%");
    expect(formatPercent(1)).toBe("0.01%");
  });
});
