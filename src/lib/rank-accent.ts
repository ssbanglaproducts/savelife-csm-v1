/**
 * Premium accent tiers for rank presentation. R1–R3 keep the default look;
 * higher ranks add a restrained colour that lives on the surrounding card,
 * never on the transparent badge art itself.
 */
export type RankAccentTier = "default" | "royal" | "gold" | "purple";

export type RankAccent = {
  tier: RankAccentTier;
  border: string;
  /** Inline border colour for glass cards whose utility classes are overridden by `.glass`. */
  borderColor: string;
  backgroundImage: string;
  gradient: string;
  progress: string;
  glow: string;
  eyebrow: string;
  title: string;
  value: string;
  divider: string;
  avatarRing: string;
  softChip: string;
};

const DEFAULT_ACCENT: RankAccent = {
  tier: "default",
  border: "",
  borderColor: "",
  backgroundImage: "",
  gradient: "",
  progress: "bg-primary",
  glow: "",
  eyebrow: "",
  title: "",
  value: "",
  divider: "",
  avatarRing: "",
  softChip: "",
};

const ROYAL_ACCENT: RankAccent = {
  tier: "royal",
  border: "border-blue-400/40 dark:border-blue-300/25",
  borderColor: "rgba(96, 165, 250, 0.55)",
  backgroundImage:
    "linear-gradient(110deg, rgba(59,130,246,0.18) 0%, rgba(59,130,246,0.07) 45%, transparent 78%)",
  gradient: "from-blue-400/20 via-blue-500/10 to-transparent",
  progress: "bg-blue-500 dark:bg-blue-400",
  glow: "bg-blue-400/20",
  eyebrow: "text-blue-700 dark:text-blue-300",
  title: "text-blue-950 dark:text-blue-100",
  value: "text-blue-700 dark:text-blue-300",
  divider: "bg-blue-400/40",
  avatarRing: "ring-blue-400/60",
  softChip: "bg-blue-500/10 text-blue-700 dark:text-blue-200",
};

const GOLD_ACCENT: RankAccent = {
  tier: "gold",
  border: "border-amber-400/50 dark:border-amber-300/30",
  borderColor: "rgba(251, 191, 36, 0.6)",
  backgroundImage:
    "linear-gradient(110deg, rgba(245,158,11,0.20) 0%, rgba(234,179,8,0.10) 45%, transparent 78%)",
  gradient: "from-amber-300/25 via-yellow-400/15 to-transparent",
  progress: "bg-amber-500 dark:bg-amber-400",
  glow: "bg-amber-400/20",
  eyebrow: "text-amber-700 dark:text-amber-200",
  title: "text-amber-950 dark:text-amber-50",
  value: "text-amber-700 dark:text-amber-200",
  divider: "bg-amber-400/45",
  avatarRing: "ring-amber-400/70",
  softChip: "bg-amber-500/15 text-amber-800 dark:text-amber-100",
};

const PURPLE_ACCENT: RankAccent = {
  tier: "purple",
  border: "border-purple-400/50 dark:border-purple-300/30",
  borderColor: "rgba(192, 132, 252, 0.6)",
  backgroundImage:
    "linear-gradient(110deg, rgba(147,51,234,0.22) 0%, rgba(217,70,239,0.10) 48%, transparent 80%)",
  gradient: "from-purple-400/25 via-fuchsia-500/15 to-transparent",
  progress: "bg-purple-500 dark:bg-purple-400",
  glow: "bg-purple-400/20",
  eyebrow: "text-purple-700 dark:text-purple-200",
  title: "text-purple-950 dark:text-purple-50",
  value: "text-purple-700 dark:text-purple-200",
  divider: "bg-purple-400/45",
  avatarRing: "ring-purple-400/70",
  softChip: "bg-purple-500/15 text-purple-800 dark:text-purple-100",
};

export function rankAccentTier(rankKey: string | null | undefined): RankAccentTier {
  const match = /^R([1-9])$/.exec(rankKey ?? "");
  if (!match) return "default";
  const level = Number(match[1]);
  if (level <= 3) return "default";
  if (level <= 6) return "royal";
  if (level <= 8) return "gold";
  return "purple";
}

export function rankAccent(rankKey: string | null | undefined): RankAccent {
  switch (rankAccentTier(rankKey)) {
    case "royal":
      return ROYAL_ACCENT;
    case "gold":
      return GOLD_ACCENT;
    case "purple":
      return PURPLE_ACCENT;
    default:
      return DEFAULT_ACCENT;
  }
}

/** Style object that wins over the `.glass` shorthand for ranked cards. */
export function accentCardStyle(
  accent: RankAccent | null | undefined,
): { backgroundImage?: string; borderColor?: string } | undefined {
  if (!accent || accent.tier === "default") return undefined;
  return {
    ...(accent.backgroundImage ? { backgroundImage: accent.backgroundImage } : {}),
    ...(accent.borderColor ? { borderColor: accent.borderColor } : {}),
  };
}

/** R7–R9 get a gradient salary bar; lower ranks keep a solid accent fill. */
export function rankProgressGradient(rankKey: string | null | undefined): string | null {
  switch (rankAccentTier(rankKey)) {
    case "gold":
      return "bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-300 dark:from-amber-400 dark:via-yellow-300 dark:to-amber-200";
    case "purple":
      return "bg-gradient-to-r from-purple-600 via-fuchsia-500 to-purple-400 dark:from-purple-400 dark:via-fuchsia-400 dark:to-purple-300";
    default:
      return null;
  }
}
