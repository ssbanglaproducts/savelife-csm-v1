import type { RankPlanDefinitionDto } from "./rank-plan-dto";

const RANK_KEYS = ["R1", "R2", "R3", "R4", "R5", "R6", "R7", "R8", "R9"] as const;

export const RANK_PLAN_DIFF_SETTINGS = [
  "badgeImageUrl",
  "name",
  "nameBn",
  "directTarget",
  "team1Target",
  "team2Target",
  "team3Target",
  "rewardType",
  "rewardSp",
  "rewardLabel",
  "rewardLabelBn",
  "rewardDescription",
  "rewardDescriptionBn",
  "rewardImageUrl",
] as const;

export type RankPlanDiffSetting = (typeof RANK_PLAN_DIFF_SETTINGS)[number];

export type RankPlanDiffEntry = {
  id: string;
  rankKey: string;
  rankLabel: string;
  rankLabelBn: string | null;
  settingKey: RankPlanDiffSetting;
  previous: string | null;
  next: string | null;
};

/** Admin-panel message key for a reviewed setting. */
export function rankPlanSettingMessageKey(settingKey: RankPlanDiffSetting): string {
  return `rankConfigSetting${settingKey.charAt(0).toUpperCase()}${settingKey.slice(1)}`;
}

/** Narrows stored JSON into reviewed change rows for immutable history views. */
export function rankPlanChangesFromJson(value: unknown): readonly RankPlanDiffEntry[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (row): row is RankPlanDiffEntry =>
      Boolean(row) &&
      typeof row === "object" &&
      "settingKey" in row &&
      "previous" in row &&
      "next" in row &&
      RANK_PLAN_DIFF_SETTINGS.includes((row as { settingKey?: string }).settingKey as RankPlanDiffSetting),
  );
}

type DiffValue = string | null | undefined;

function normalize(value: DiffValue): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function valueFor(row: RankPlanDefinitionDto | undefined, key: RankPlanDiffSetting): DiffValue {
  if (!row) return null;
  switch (key) {
    case "badgeImageUrl":
      return row.badgeImageUrl;
    case "name":
      return row.name;
    case "nameBn":
      return row.nameBn;
    case "directTarget":
      return row.directTarget;
    case "team1Target":
      return row.team1Target;
    case "team2Target":
      return row.team2Target;
    case "team3Target":
      return row.team3Target;
    case "rewardType":
      return row.rewardType;
    case "rewardSp":
      return row.rewardSp;
    case "rewardLabel":
      return row.rewardLabel;
    case "rewardLabelBn":
      return row.rewardLabelBn;
    case "rewardDescription":
      return row.rewardDescription;
    case "rewardDescriptionBn":
      return row.rewardDescriptionBn;
    case "rewardImageUrl":
      return row.rewardImageUrl;
  }
}

/** Returns only the values that actually changed, in stable R1–R9 order. */
export function buildRankPlanDiff(
  before: readonly RankPlanDefinitionDto[],
  after: readonly RankPlanDefinitionDto[],
): RankPlanDiffEntry[] {
  const changes: RankPlanDiffEntry[] = [];

  for (const rankKey of RANK_KEYS) {
    const beforeRow = before.find((row) => row.rankKey === rankKey);
    const afterRow = after.find((row) => row.rankKey === rankKey);
    if (!beforeRow && !afterRow) continue;

    for (const settingKey of RANK_PLAN_DIFF_SETTINGS) {
      const previous = normalize(valueFor(beforeRow, settingKey));
      const next = normalize(valueFor(afterRow, settingKey));
      if (previous === next) continue;

      changes.push({
        id: `${rankKey}:${settingKey}`,
        rankKey,
        rankLabel: afterRow?.name ?? beforeRow?.name ?? rankKey,
        rankLabelBn: afterRow?.nameBn ?? beforeRow?.nameBn ?? null,
        settingKey,
        previous,
        next,
      });
    }
  }

  return changes;
}
