import { describe, expect, it } from "vitest";
import { spToPaisa } from "../money";
import { DEFAULT_SALARY_PLAN, type SalaryPlan } from "../salary";
import { serializeSalaryPlan } from "./salary-plan";

describe("salary plan serialization", () => {
  it("serializes the default plan as plain JSON with R1 disabled", () => {
    const dto = serializeSalaryPlan({ ...DEFAULT_SALARY_PLAN, version: 1 });

    expect(dto.version).toBe(1);
    expect(dto.totalAllocationBps).toBe(950);
    expect(dto.enabledRanks).not.toContain("R1");
    expect(dto.ranks).toHaveLength(9);
    expect(dto.ranks[0]).toMatchObject({
      rankKey: "R1",
      allocationPercent: "0",
      maxWeeklySalary: "0",
      maxWeeks: null,
      enabled: false,
    });
    expect(dto.ranks[1]).toMatchObject({
      rankKey: "R2",
      allocationPercent: "2",
      maxWeeklySalary: "10000",
      maxWeeks: "12",
      enabled: true,
    });
    expect(() => JSON.stringify(dto)).not.toThrow();
  });

  it("serializes an active plan override including an enabled R1", () => {
    const plan: SalaryPlan = {
      version: 2,
      versionId: "salary-plan-version:2",
      configs: {
        ...DEFAULT_SALARY_PLAN.configs,
        R1: {
          ...DEFAULT_SALARY_PLAN.configs.R1,
          isEnabled: true,
          allocationBps: 75,
          maxWeeklySalaryPaisa: spToPaisa("1500"),
          maxWeeks: 8,
        },
        R2: { ...DEFAULT_SALARY_PLAN.configs.R2, allocationBps: 0 },
      },
    };
    const dto = serializeSalaryPlan(plan);

    expect(dto.enabledRanks).toContain("R1");
    expect(dto.enabledRanks).not.toContain("R2");
    expect(dto.ranks[0]).toMatchObject({
      allocationPercent: "0.75",
      maxWeeklySalary: "1500",
      maxWeeks: "8",
      enabled: true,
    });
    expect(dto.ranks[1]).toMatchObject({ allocationPercent: "0", enabled: false });
    expect(dto.totalAllocationBps).toBe(825);
  });
});
