import { describe, expect, it } from "vitest";
import { spToPaisa } from "../money";
import { SALARY_RANK_CONFIG } from "../salary";
import { buildSalaryTreasuryRun } from "./salary-treasury-run";

const now = new Date("2026-11-25T12:00:00.000Z");

function entitlement(overrides: {
  id?: string;
  memberId?: string;
  displayId?: string;
  weeksPaid?: number;
  status?: string;
} = {}) {
  return {
    id: overrides.id ?? "entitlement-1",
    memberId: overrides.memberId ?? "member-1",
    weeksPaid: overrides.weeksPaid ?? 0,
    member: {
      memberId: overrides.displayId ?? "SL000001",
      fullName: "Savelife Founder",
      status: overrides.status ?? "ACTIVE",
    },
  };
}

describe("buildSalaryTreasuryRun", () => {
  it("projects the next Sunday 00:00 BDT boundary and only eligible members", () => {
    const run = buildSalaryTreasuryRun({
      config: SALARY_RANK_CONFIG.R2,
      balancePaisa: spToPaisa("30000"),
      entitlements: [
        entitlement({ id: "e1", displayId: "SL000001" }),
        entitlement({
          id: "e2",
          memberId: "member-2",
          displayId: "SL000002",
          weeksPaid: 12,
        }),
        entitlement({
          id: "e3",
          memberId: "member-3",
          displayId: "SL000003",
          status: "INACTIVE",
        }),
      ],
      now,
    });

    expect(run.nextBoundaryAt.toISOString()).toBe("2026-11-28T18:00:00.000Z");
    expect(run.periodStartAt.toISOString()).toBe("2026-11-21T18:00:00.000Z");
    expect(run.eligibleCount).toBe(1);
    expect(run.projectedTotalPaisa).toBe(spToPaisa("10000"));
    expect(run.members.map((member) => member.state)).toEqual([
      "eligible",
      "week-limit-reached",
      "member-inactive",
    ]);
    expect(run.members[0].projectedPaisa).toBe(spToPaisa("10000"));
    expect(run.members[1].projectedPaisa).toBe(0n);
  });

  it("keeps a disabled treasury's balance but projects no payout", () => {
    const run = buildSalaryTreasuryRun({
      config: SALARY_RANK_CONFIG.R1,
      balancePaisa: spToPaisa("500"),
      entitlements: [entitlement()],
      now,
    });

    expect(run.balancePaisa).toBe(spToPaisa("500"));
    expect(run.eligibleCount).toBe(0);
    expect(run.projectedTotalPaisa).toBe(0n);
    expect(run.members[0].state).toBe("rank-disabled");
  });

  it("splits an uncapped balance across all eligible members", () => {
    const run = buildSalaryTreasuryRun({
      config: SALARY_RANK_CONFIG.R9,
      balancePaisa: spToPaisa("301"),
      entitlements: [
        entitlement({ id: "e1" }),
        entitlement({ id: "e2", memberId: "member-2", displayId: "SL000002" }),
      ],
      now,
    });

    expect(run.eligibleCount).toBe(2);
    expect(run.projectedTotalPaisa).toBe(spToPaisa("301"));
    expect(run.members.map((member) => member.projectedPaisa)).toEqual([
      spToPaisa("150.5"),
      spToPaisa("150.5"),
    ]);
  });
});
