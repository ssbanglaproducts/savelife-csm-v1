import { getLocale, getTranslations } from "next-intl/server";
import { RankBadge } from "@/components/ui/rank-badge";
import { Link } from "@/i18n/navigation";
import { formatSP } from "@/lib/money";
import { resolveRankBadgeImageUrl } from "@/lib/rank-art";
import type { SalaryRankKey } from "@/lib/salary";
import type { SalaryPlanRankDto } from "@/lib/services/salary-plan";
import {
  salaryTreasuryAccent,
  salaryTreasuryCardStyle,
} from "@/lib/salary-treasury-accent";
import { cn } from "@/lib/utils";

type TreasuryRow = {
  readonly rankKey: string;
  readonly balancePaisa: bigint;
};

type BadgeRow = {
  readonly rankKey: string;
  readonly badgeImageUrl: string | null;
};

type Projection = {
  readonly eligibleCount: number;
  readonly averagePaisa: bigint;
};

const EMPTY_TREASURY: TreasuryRow = {
  rankKey: "",
  balancePaisa: 0n,
};

const EMPTY_PROJECTION: Projection = {
  eligibleCount: 0,
  averagePaisa: 0n,
};

function Stat({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-1 font-display text-xl font-bold tabular-nums">{value}</dd>
    </div>
  );
}

export async function SalaryTreasuryCards({
  ranks,
  treasuries,
  badges,
  projections,
}: {
  ranks: readonly SalaryPlanRankDto[];
  treasuries: readonly TreasuryRow[];
  badges: readonly BadgeRow[];
  projections: Readonly<Record<SalaryRankKey, Projection>>;
}) {
  const [locale, ta] = await Promise.all([getLocale(), getTranslations("adminPanel")]);
  const treasuryByRank = new Map(treasuries.map((row) => [row.rankKey, row]));
  const badgeByRank = new Map(badges.map((row) => [row.rankKey, row.badgeImageUrl]));

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {ranks.map((rank) => {
        const rankKey = rank.rankKey as SalaryRankKey;
        const treasury = treasuryByRank.get(rankKey) ?? EMPTY_TREASURY;
        const projection = projections[rankKey] ?? EMPTY_PROJECTION;
        const accent = salaryTreasuryAccent(rankKey);
        const badgeSrc = resolveRankBadgeImageUrl(
          badgeByRank.get(rankKey) ?? null,
          rankKey,
        );
        const name = locale === "bn" ? rank.defaultNameBn : rank.defaultName;

        return (
          <Link
            key={rankKey}
            href={`/admin/rank-salary/rank-treasuries/${rankKey}`}
            aria-label={`${name} — ${ta("salaryTreasuryView")}`}
            className="group glass relative flex min-h-[15rem] flex-col overflow-hidden rounded-2xl p-5 outline-none transition-shadow hover:shadow-lg focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            style={salaryTreasuryCardStyle(rankKey)}
          >
            <div className="flex min-w-0 items-center gap-3">
              <div
                className={cn(
                  "flex size-14 shrink-0 items-center justify-center rounded-2xl ring-1 ring-inset",
                  accent.badgeClass,
                )}
              >
                <RankBadge src={badgeSrc} rankKey={rankKey} size={44} />
              </div>
              <h3 className={cn("truncate text-lg font-semibold", accent.nameClass)}>
                {name}
              </h3>
            </div>

            <p className="mt-6 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {ta("salaryRemaining")}
            </p>
            <p className={cn("font-display text-3xl font-bold tabular-nums", accent.amountClass)}>
              {formatSP(treasury.balancePaisa)}
            </p>

            <dl className="mt-auto grid grid-cols-2 gap-3 border-t border-border/70 pt-4">
              <Stat
                label={ta("salaryTreasuryEligibleMembers")}
                value={String(projection.eligibleCount)}
              />
              <Stat
                label={ta("salaryTreasuryAverageMember")}
                value={formatSP(projection.averagePaisa)}
              />
            </dl>
          </Link>
        );
      })}
    </div>
  );
}
