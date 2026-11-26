import { describe, expect, it } from "vitest";
import { serializeSalaryAutomationResult } from "./salary-automation";

describe("salary automation response", () => {
  it("serializes paid paisa as a string for JSON responses", () => {
    const serialized = serializeSalaryAutomationResult({
      ok: true,
      ranAt: "2026-11-29T12:00:00.000Z",
      distribution: {
        applied: true,
        distributionId: "distribution-1",
        weekEndAt: "2026-11-28T18:00:00.000Z",
        totalPaidPaisa: 1250000n,
        recipientCount: 2,
        failedCount: 0,
      },
    });

    expect(serialized.distribution?.totalPaidPaisa).toBe("1250000");
    expect(() => JSON.stringify(serialized)).not.toThrow();
  });

  it("keeps a failed automation result JSON-safe", () => {
    const serialized = serializeSalaryAutomationResult({
      ok: false,
      ranAt: "2026-11-29T12:00:00.000Z",
      distribution: null,
      error: "BOOM",
    });

    expect(serialized).toEqual({
      ok: false,
      ranAt: "2026-11-29T12:00:00.000Z",
      distribution: null,
      error: "BOOM",
    });
  });
});
