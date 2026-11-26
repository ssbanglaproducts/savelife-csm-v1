import { ActivateButton } from "@/components/member/activation-guidance";
import { CopyableMemberId } from "@/components/ui/copyable-member-id";
import { RankBadge } from "@/components/ui/rank-badge";
import { UserAvatar } from "@/components/ui/user-avatar";
import { cn } from "@/lib/utils";

export function DashboardHeader({
  name,
  memberId,
  image,
  rankBadge,
  inactive,
  availablePaisa,
  welcomeLabel,
  memberIdLabel,
}: {
  name: string;
  memberId: string;
  image: string | null;
  rankBadge: { src: string | null | undefined; rankKey: string } | null;
  inactive: boolean;
  availablePaisa: string;
  welcomeLabel: string;
  memberIdLabel: string;
}) {
  const firstName = name.trim().split(/\s+/)[0] ?? name;

  return (
    <section
      className={cn(
        "glass flex min-w-0 items-center gap-3 rounded-2xl border border-border/60 px-4 py-3 sm:gap-4 sm:px-5 sm:py-4",
        inactive && "accent-inactive",
      )}
    >
      <UserAvatar
        name={name}
        src={image}
        className={cn(
          "size-11 rounded-xl sm:size-12",
          inactive
            ? "ring-2 ring-rose-400/70 ring-offset-2 ring-offset-background"
            : "ring-0",
        )}
        textClassName="text-sm"
      />

      <div className="min-w-0 flex-1">
        <p
          className={cn(
            "text-[10px] font-bold uppercase tracking-[0.12em]",
            inactive ? "text-rose-600 dark:text-rose-300" : "text-primary",
          )}
        >
          {welcomeLabel}
        </p>
        <h1
          title={name}
          className="mt-0.5 truncate font-display text-xl font-bold tracking-tight sm:text-2xl"
        >
          <span className="sm:hidden">{firstName}</span>
          <span className="hidden sm:inline">{name}</span>
        </h1>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-muted-foreground">{memberIdLabel}</span>
          <CopyableMemberId memberId={memberId} compact />
        </div>
      </div>

      <div className="ml-auto flex shrink-0 items-center gap-3">
        {rankBadge ? (
          <RankBadge
            src={rankBadge.src}
            rankKey={rankBadge.rankKey}
            size={48}
            className="drop-shadow-sm"
          />
        ) : null}
        {inactive ? <ActivateButton availablePaisa={availablePaisa} /> : null}
      </div>
    </section>
  );
}
