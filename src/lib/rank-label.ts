export type RankName = {
  name: string;
  nameBn: string | null;
};

export function localizedRankName(rank: RankName, locale: string): string {
  return locale === "bn" && rank.nameBn ? rank.nameBn : rank.name;
}
