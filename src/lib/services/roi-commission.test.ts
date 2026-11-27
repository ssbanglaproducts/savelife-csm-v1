import { describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "../../generated/prisma/client";
import { spToPaisa } from "../money";
import {
  DEFAULT_ROI_RATE_CONFIG,
  ROI_RATES_SETTING_KEY,
  StaleRoiRateVersionError,
  calculateRoiCommissions,
  loadRoiSponsorIndex,
  normalizeRoiRatesBps,
  parseRoiRatesSetting,
  resolveSponsorChain,
  saveRoiRateConfig,
  totalRoiCommissionPaisa,
  totalRoiRateBps,
  type RoiSponsorCandidate,
  type RoiSponsorNode,
} from "./roi-commission";

function node(
  id: string,
  sponsorId: string | null,
  extra: Record<string, unknown> = {},
): RoiSponsorNode {
  return {
    id,
    memberId: `SL-${id}`,
    fullName: `Member ${id}`,
    sponsorId,
    ...extra,
  } as RoiSponsorNode;
}

function fiveSponsors(): readonly RoiSponsorCandidate[] {
  return ["s1", "s2", "s3", "s4", "s5"].map((id, index) => ({
    beneficiaryId: id,
    level: index + 1,
  }));
}

describe("ROI commission rates", () => {
  it("defaults to 2.00 / 0.50 / 0.50 / 0.30 / 0.20 percent", () => {
    expect(DEFAULT_ROI_RATE_CONFIG.ratesBps).toEqual([200, 50, 50, 30, 20]);
    expect(totalRoiRateBps()).toBe(350);
  });

  it("validates exactly five independent rates in basis points", () => {
    expect(normalizeRoiRatesBps([200, 50, 50, 30, 20])).toEqual([200, 50, 50, 30, 20]);
    expect(() => normalizeRoiRatesBps([200, 50, 50, 30])).toThrow();
    expect(() => normalizeRoiRatesBps([200, 50, 50, 30, -1])).toThrow();
    expect(() => normalizeRoiRatesBps([200, 50, 50, 30, 10_001])).toThrow();
    expect(() => normalizeRoiRatesBps([200, 50, 50, 30, 1.5])).toThrow();
  });

  it("caps the combined rate at 100 percent", () => {
    expect(normalizeRoiRatesBps([2_000, 2_000, 2_000, 2_000, 2_000])).toHaveLength(5);
    expect(() => normalizeRoiRatesBps([10_000, 1, 0, 0, 0])).toThrow(/100%/);
    expect(parseRoiRatesSetting([10_000, 1, 0, 0, 0])).toBeNull();
  });

  it("falls back to defaults for an invalid stored setting", () => {
    expect(parseRoiRatesSetting([200, 50, 50, 30, 20])).toEqual([200, 50, 50, 30, 20]);
    expect(parseRoiRatesSetting({ rates: [200, 50, 50, 30, 20] })).toBeNull();
    expect(parseRoiRatesSetting([200, 50, 50, 30])).toBeNull();
  });
});

describe("ROI sponsor chain", () => {
  it("walks five sponsorId hops and ignores placement fields", () => {
    const index = new Map<string, RoiSponsorNode>([
      ["m1", node("m1", "s1", { placementParentId: "wrong" })],
      ["s1", node("s1", "s2")],
      ["s2", node("s2", "s3")],
      ["s3", node("s3", "s4")],
      ["s4", node("s4", "s5")],
      ["s5", node("s5", null)],
      ["wrong", node("wrong", null)],
    ]);

    expect(resolveSponsorChain("m1", index)).toEqual(fiveSponsors());
  });

  it("does not promote a deeper sponsor into a missing level", () => {
    const index = new Map<string, RoiSponsorNode>([
      ["m1", node("m1", "s1")],
      ["s1", node("s1", "s2")],
      ["s2", node("s2", null)],
    ]);

    expect(resolveSponsorChain("m1", index)).toEqual([
      { beneficiaryId: "s1", level: 1 },
      { beneficiaryId: "s2", level: 2 },
    ]);

    const commissions = calculateRoiCommissions(spToPaisa("10000"), resolveSponsorChain("m1", index));
    expect(commissions.map((item) => item.level)).toEqual([1, 2]);
    expect(totalRoiCommissionPaisa(commissions)).toBe(spToPaisa("250"));
  });

  it("stops on a sponsor cycle", () => {
    const index = new Map<string, RoiSponsorNode>([
      ["m1", node("m1", "a")],
      ["a", node("a", "b")],
      ["b", node("b", "a")],
    ]);

    expect(resolveSponsorChain("m1", index)).toEqual([
      { beneficiaryId: "a", level: 1 },
      { beneficiaryId: "b", level: 2 },
    ]);
  });

  it("loads only member accounts into the sponsor index", async () => {
    const rows = [node("m1", null), node("staff", null, { role: "STAFF" })];
    const client = {
      member: {
        findMany: async ({ where }: { where?: { role?: string } }) =>
          rows.filter((row) => (where?.role ?? "MEMBER") === ((row as { role?: string }).role ?? "MEMBER")),
      },
    } as unknown as Parameters<typeof loadRoiSponsorIndex>[0];

    const index = await loadRoiSponsorIndex(client);

    expect([...index.keys()]).toEqual(["m1"]);
  });
});

describe("ROI commission calculation", () => {
  it("adds 350 SP on a 10,000 SP profit without reducing that profit", () => {
    const commissions = calculateRoiCommissions(spToPaisa("10000"), fiveSponsors());

    expect(commissions.map((item) => item.amountPaisa)).toEqual([
      spToPaisa("200"),
      spToPaisa("50"),
      spToPaisa("50"),
      spToPaisa("30"),
      spToPaisa("20"),
    ]);
    expect(totalRoiCommissionPaisa(commissions)).toBe(spToPaisa("350"));
    // The original 10,000 SP remains untouched; total outflow is 10,350 SP.
    expect(spToPaisa("10000") + totalRoiCommissionPaisa(commissions)).toBe(spToPaisa("10350"));
  });

  it("floors each level to whole paisa and skips zero payments", () => {
    const commissions = calculateRoiCommissions(101n, fiveSponsors());
    expect(commissions).toHaveLength(1);
    expect(commissions[0]).toMatchObject({ level: 1, rateBps: 200, amountPaisa: 2n });

    const tiny = calculateRoiCommissions(50n, fiveSponsors(), {
      ratesBps: [1, 1, 1, 1, 1],
    });
    expect(tiny).toEqual([]);
  });

  it("supports independently changed rates", () => {
    const commissions = calculateRoiCommissions(spToPaisa("10000"), fiveSponsors(), {
      ratesBps: [100, 100, 100, 100, 100],
    });
    expect(commissions.map((item) => item.amountPaisa)).toEqual([
      spToPaisa("100"),
      spToPaisa("100"),
      spToPaisa("100"),
      spToPaisa("100"),
      spToPaisa("100"),
    ]);
  });
});

describe("ROI rate save concurrency", () => {
  const rates = [200, 50, 50, 30, 20] as const;

  function clientWithVersion(version: number | null, claimed = 1) {
    const findUnique = vi.fn(async () => (version === null ? null : { version }));
    const updateMany = vi.fn(async () => ({ count: claimed }));
    const create = vi.fn(async () => ({}));
    const client = { systemSetting: { findUnique, updateMany, create } };
    return { client: client as unknown as PrismaClient, findUnique, updateMany, create };
  }

  it("increments the version with a conditional update", async () => {
    const { client, updateMany } = clientWithVersion(4);

    await expect(saveRoiRateConfig(client, rates, 4)).resolves.toEqual([...rates]);
    expect(updateMany).toHaveBeenCalledWith({
      where: { key: ROI_RATES_SETTING_KEY, version: 4 },
      data: {
        value: [...rates],
        version: 5,
      },
    });
  });

  it("rejects a stale expected version before writing", async () => {
    const { client, updateMany } = clientWithVersion(4);

    await expect(saveRoiRateConfig(client, rates, 3)).rejects.toBeInstanceOf(
      StaleRoiRateVersionError,
    );
    expect(updateMany).not.toHaveBeenCalled();
  });

  it("rejects a concurrent winner whose conditional update claimed zero rows", async () => {
    const { client } = clientWithVersion(4, 0);

    await expect(saveRoiRateConfig(client, rates, 4)).rejects.toBeInstanceOf(
      StaleRoiRateVersionError,
    );
  });

  it("creates the missing setting at version one", async () => {
    const { client, create, updateMany } = clientWithVersion(null);

    await expect(saveRoiRateConfig(client, rates, 0)).resolves.toEqual([...rates]);
    expect(create).toHaveBeenCalledWith({
      data: {
        key: ROI_RATES_SETTING_KEY,
        value: [...rates],
        version: 1,
      },
    });
    expect(updateMany).not.toHaveBeenCalled();
  });
});
