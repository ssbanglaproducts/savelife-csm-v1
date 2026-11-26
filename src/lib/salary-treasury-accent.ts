import type { SalaryRankKey } from "./salary";

/**
 * Distinct treasury colours. The badge art is transparent, so colour lives on
 * the surrounding card and its labels rather than on the badge itself.
 */
export type SalaryTreasuryAccent = {
  readonly borderColor: string;
  readonly backgroundImage: string;
  readonly badgeClass: string;
  readonly chipClass: string;
  readonly nameClass: string;
  readonly amountClass: string;
  readonly dotClass: string;
};

const ACCENTS: Readonly<Record<SalaryRankKey, SalaryTreasuryAccent>> = {
  R1: {
    borderColor: "rgba(148, 163, 184, 0.55)",
    backgroundImage: "linear-gradient(135deg, rgba(148,163,184,0.22), transparent 72%)",
    badgeClass: "bg-slate-500/15 ring-slate-400/40",
    chipClass: "bg-slate-500/15 text-slate-700 dark:text-slate-200",
    nameClass: "text-slate-800 dark:text-slate-100",
    amountClass: "text-slate-950 dark:text-white",
    dotClass: "bg-slate-500",
  },
  R2: {
    borderColor: "rgba(56, 189, 248, 0.55)",
    backgroundImage: "linear-gradient(135deg, rgba(14,165,233,0.22), transparent 72%)",
    badgeClass: "bg-sky-500/15 ring-sky-400/40",
    chipClass: "bg-sky-500/15 text-sky-700 dark:text-sky-200",
    nameClass: "text-sky-900 dark:text-sky-100",
    amountClass: "text-sky-950 dark:text-white",
    dotClass: "bg-sky-500",
  },
  R3: {
    borderColor: "rgba(52, 211, 153, 0.55)",
    backgroundImage: "linear-gradient(135deg, rgba(16,185,129,0.22), transparent 72%)",
    badgeClass: "bg-emerald-500/15 ring-emerald-400/40",
    chipClass: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-200",
    nameClass: "text-emerald-900 dark:text-emerald-100",
    amountClass: "text-emerald-950 dark:text-white",
    dotClass: "bg-emerald-500",
  },
  R4: {
    borderColor: "rgba(250, 204, 21, 0.6)",
    backgroundImage: "linear-gradient(135deg, rgba(234,179,8,0.22), transparent 72%)",
    badgeClass: "bg-amber-500/15 ring-amber-400/50",
    chipClass: "bg-amber-500/15 text-amber-800 dark:text-amber-200",
    nameClass: "text-amber-900 dark:text-amber-100",
    amountClass: "text-amber-950 dark:text-white",
    dotClass: "bg-amber-500",
  },
  R5: {
    borderColor: "rgba(251, 146, 60, 0.6)",
    backgroundImage: "linear-gradient(135deg, rgba(249,115,22,0.22), transparent 72%)",
    badgeClass: "bg-orange-500/15 ring-orange-400/50",
    chipClass: "bg-orange-500/15 text-orange-800 dark:text-orange-200",
    nameClass: "text-orange-900 dark:text-orange-100",
    amountClass: "text-orange-950 dark:text-white",
    dotClass: "bg-orange-500",
  },
  R6: {
    borderColor: "rgba(251, 113, 133, 0.6)",
    backgroundImage: "linear-gradient(135deg, rgba(244,63,94,0.22), transparent 72%)",
    badgeClass: "bg-rose-500/15 ring-rose-400/50",
    chipClass: "bg-rose-500/15 text-rose-700 dark:text-rose-200",
    nameClass: "text-rose-900 dark:text-rose-100",
    amountClass: "text-rose-950 dark:text-white",
    dotClass: "bg-rose-500",
  },
  R7: {
    borderColor: "rgba(167, 139, 250, 0.6)",
    backgroundImage: "linear-gradient(135deg, rgba(139,92,246,0.24), transparent 72%)",
    badgeClass: "bg-violet-500/15 ring-violet-400/50",
    chipClass: "bg-violet-500/15 text-violet-700 dark:text-violet-200",
    nameClass: "text-violet-900 dark:text-violet-100",
    amountClass: "text-violet-950 dark:text-white",
    dotClass: "bg-violet-500",
  },
  R8: {
    borderColor: "rgba(96, 165, 250, 0.6)",
    backgroundImage: "linear-gradient(135deg, rgba(79,70,229,0.24), transparent 72%)",
    badgeClass: "bg-indigo-500/15 ring-indigo-400/50",
    chipClass: "bg-indigo-500/15 text-indigo-700 dark:text-indigo-200",
    nameClass: "text-indigo-900 dark:text-indigo-100",
    amountClass: "text-indigo-950 dark:text-white",
    dotClass: "bg-indigo-500",
  },
  R9: {
    borderColor: "rgba(232, 121, 249, 0.6)",
    backgroundImage: "linear-gradient(135deg, rgba(217,70,239,0.24), transparent 72%)",
    badgeClass: "bg-fuchsia-500/15 ring-fuchsia-400/50",
    chipClass: "bg-fuchsia-500/15 text-fuchsia-700 dark:text-fuchsia-200",
    nameClass: "text-fuchsia-900 dark:text-fuchsia-100",
    amountClass: "text-fuchsia-950 dark:text-white",
    dotClass: "bg-fuchsia-500",
  },
};

export function salaryTreasuryAccent(rankKey: string): SalaryTreasuryAccent {
  return ACCENTS[rankKey as SalaryRankKey] ?? ACCENTS.R1;
}

/** Inline style wins over the `.glass` shorthand for a coloured treasury card. */
export function salaryTreasuryCardStyle(
  rankKey: string,
): { backgroundImage: string; borderColor: string } {
  const accent = salaryTreasuryAccent(rankKey);
  return {
    backgroundImage: accent.backgroundImage,
    borderColor: accent.borderColor,
  };
}
