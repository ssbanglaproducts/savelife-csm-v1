import { formatSP, paisaToSPInput, spToPaisa } from "./money";

export type RankPlanDefinitionDto = {
  id: string;
  rankKey: string;
  sortOrder: number;
  name: string;
  nameBn: string | null;
  directTarget: string;
  team1Target: string;
  team2Target: string;
  team3Target: string;
  rewardType: "SP" | "PHYSICAL";
  rewardSp: string;
  rewardLabel: string | null;
  rewardLabelBn: string | null;
  rewardDescription: string | null;
  rewardDescriptionBn: string | null;
  badgeImageUrl: string | null;
  rewardImageUrl: string | null;
};

export type RankPlanFormData = {
  id: string;
  version: number;
  isActive: boolean;
  effectiveFrom: string;
  note: string | null;
  ranks: RankPlanDefinitionDto[];
};

export type RankAchievementRowDto = {
  id: string;
  member: string;
  rankKey: string;
  rankName: string;
  rankNameBn: string | null;
  planVersion: number;
  achievedAt: string;
  primaryMethod: string;
  secondaryMethod: string | null;
  rewardType: "SP" | "PHYSICAL";
  rewardSpPaisa: string | null;
  rewardLabel: string | null;
  rewardLabelBn: string | null;
  badgeImageUrl: string | null;
  rewardImageUrl: string | null;
  rewardStatus: "PENDING" | "ACHIEVED";
};

export function definitionToDto(definition: {
  id: string;
  rankKey: string;
  sortOrder: number;
  name: string;
  nameBn: string | null;
  directTargetPaisa: bigint;
  team1TargetPaisa: bigint;
  team2TargetPaisa: bigint;
  team3TargetPaisa: bigint;
  rewardType: string;
  rewardSpPaisa: bigint | null;
  rewardLabel: string | null;
  rewardLabelBn: string | null;
  rewardDescription: string | null;
  rewardDescriptionBn: string | null;
  badgeImageUrl: string | null;
  rewardImageUrl: string | null;
}): RankPlanDefinitionDto {
  return {
    id: definition.id,
    rankKey: definition.rankKey,
    sortOrder: definition.sortOrder,
    name: definition.name,
    nameBn: definition.nameBn,
    ...planDefinitionInput(definition),
    rewardType: definition.rewardType === "PHYSICAL" ? "PHYSICAL" : "SP",
    rewardLabel: definition.rewardLabel,
    rewardLabelBn: definition.rewardLabelBn,
    rewardDescription: definition.rewardDescription,
    rewardDescriptionBn: definition.rewardDescriptionBn,
    badgeImageUrl: definition.badgeImageUrl,
    rewardImageUrl: definition.rewardImageUrl,
  };
}

export function planDefinitionInput(definition: {
  directTargetPaisa: bigint;
  team1TargetPaisa: bigint;
  team2TargetPaisa: bigint;
  team3TargetPaisa: bigint;
  rewardSpPaisa: bigint | null;
}): Pick<RankPlanDefinitionDto, "directTarget" | "team1Target" | "team2Target" | "team3Target" | "rewardSp"> {
  return {
    directTarget: paisaToSPInput(definition.directTargetPaisa),
    team1Target: paisaToSPInput(definition.team1TargetPaisa),
    team2Target: paisaToSPInput(definition.team2TargetPaisa),
    team3Target: paisaToSPInput(definition.team3TargetPaisa),
    rewardSp: definition.rewardSpPaisa ? paisaToSPInput(definition.rewardSpPaisa) : "",
  };
}

export function rankRewardDisplay(
  row: Pick<RankAchievementRowDto, "rewardType" | "rewardSpPaisa" | "rewardLabel" | "rewardLabelBn">,
  locale: string,
): string {
  if (row.rewardType === "SP") {
    return formatSP(BigInt(row.rewardSpPaisa ?? "0"));
  }
  return locale === "bn" && row.rewardLabelBn ? row.rewardLabelBn : row.rewardLabel ?? "—";
}

/** Form targets are plain SP strings such as "500000", never paisa. */
export function formatPlanTarget(value: string): string {
  return formatSP(spToPaisa(value || "0"));
}

export function rankDefinitionTargets(row: RankPlanDefinitionDto): string {
  return [row.directTarget, row.team1Target, row.team2Target, row.team3Target]
    .map(formatPlanTarget)
    .join(" · ");
}
