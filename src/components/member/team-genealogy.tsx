"use client";

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { useTranslations } from "next-intl";
import { ArrowLeft, Lock, Plus, UserRound } from "lucide-react";
import { CopyableMemberId } from "@/components/member/copyable-member-id";
import { Button } from "@/components/ui/button";
import { RankBadge } from "@/components/ui/rank-badge";
import { UserAvatar } from "@/components/ui/user-avatar";
import { localizedRankName } from "@/lib/rank-label";
import { accentCardStyle, rankAccent } from "@/lib/rank-accent";
import { cn } from "@/lib/utils";
import type {
  GenealogySlot,
  GenealogyView,
  TeamPersonSummary,
} from "@/lib/services/team-performance";

const LEG_KEYS = ["teamLegA", "teamLegB", "teamLegC"] as const;

function compactDisplayName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return parts[0] ?? fullName;
  return parts.slice(0, Math.min(parts.length - 1, 2)).join(" ");
}

const LEG_TONES = [
  {
    line: "bg-amber-400/55",
    arrow: "border-t-amber-400/55",
    text: "text-amber-600 dark:text-amber-300",
    ring: "ring-amber-400/25",
  },
  {
    line: "bg-sky-400/55",
    arrow: "border-t-sky-400/55",
    text: "text-sky-600 dark:text-sky-300",
    ring: "ring-sky-400/25",
  },
  {
    line: "bg-violet-400/55",
    arrow: "border-t-violet-400/55",
    text: "text-violet-600 dark:text-violet-300",
    ring: "ring-violet-400/25",
  },
] as const;

const EMPTY_CHILD_SLOTS: GenealogySlot[] = [
  { slot: 1, occupied: false, member: null },
  { slot: 2, occupied: false, member: null },
  { slot: 3, occupied: false, member: null },
];

type ConnectorBranch = {
  center: number;
  line: string;
  arrow: string;
};

function TreeConnector({
  branches,
  className,
  trunkColorClass = "bg-primary/40",
}: {
  branches: ConnectorBranch[];
  className?: string;
  trunkColorClass?: string;
}) {
  return (
    <div className={cn("relative w-full", className)} aria-hidden="true">
      <span className={cn("absolute left-1/2 top-0 h-1/2 w-px -translate-x-1/2", trunkColorClass)} />
      {branches.slice(0, -1).map((branch, index) => {
        const next = branches[index + 1];
        return (
          <span
            key={`tree-line-${branch.center}`}
            className={cn("absolute top-1/2 h-px -translate-y-1/2", branch.line)}
            style={{ left: `${branch.center}%`, width: `${next.center - branch.center}%` }}
          />
        );
      })}
      {branches.map((branch) => (
        <span
          key={`tree-branch-${branch.center}`}
          className={cn("absolute top-1/2 h-1/2 w-px", branch.line)}
          style={{ left: `${branch.center}%` }}
        />
      ))}
      {branches.map((branch) => (
        <span
          key={`tree-arrow-${branch.center}`}
          className={cn(
            "absolute top-full size-0 -translate-x-1/2 border-x-4 border-t-4 border-x-transparent",
            branch.arrow,
          )}
          style={{ left: `${branch.center}%` }}
        />
      ))}
    </div>
  );
}

type NodeVariant = "root" | "leg" | "child";

function ProfileNode({
  member,
  locale,
  variant,
  toneIndex,
  legLabel,
  onOpen,
  onInspect,
}: {
  member: TeamPersonSummary;
  locale: string;
  variant: NodeVariant;
  toneIndex: number;
  legLabel: string;
  onOpen: () => void;
  onInspect: () => void;
}) {
  const t = useTranslations("memberPanel");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressed = useRef(false);
  const tone = LEG_TONES[toneIndex % LEG_TONES.length];
  const isRoot = variant === "root";
  const isChild = variant === "child";
  const rankStyle = member.rank ? rankAccent(member.rank.rankKey) : null;

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  function clearTimer() {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  }

  function startPress(event: ReactPointerEvent<HTMLButtonElement>) {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    longPressed.current = false;
    clearTimer();
    timer.current = setTimeout(() => {
      longPressed.current = true;
      onInspect();
    }, 550);
  }

  function handleClick() {
    if (longPressed.current) {
      longPressed.current = false;
      return;
    }
    onOpen();
  }

  return (
    <button
      type="button"
      aria-label={
        member.rank
          ? `${member.fullName} ${member.memberId} ${localizedRankName(member.rank, locale)}`
          : `${member.fullName} ${member.memberId}`
      }
      onPointerDown={startPress}
      onPointerUp={clearTimer}
      onPointerLeave={clearTimer}
      onPointerCancel={clearTimer}
      onContextMenu={(event) => {
        event.preventDefault();
        clearTimer();
        onInspect();
      }}
      onClick={handleClick}
      style={accentCardStyle(rankStyle)}
      className={cn(
        "glass glass-hover w-full rounded-2xl border px-3 text-left outline-none ring-1 transition-colors focus-visible:ring-2 focus-visible:ring-ring",
        isRoot
          ? "border-primary/35 bg-gradient-to-br from-primary/20 via-background/90 to-secondary/10 px-4 py-3"
          : isChild
            ? "border-border/60 bg-background/80 px-2 py-2"
            : "h-[4.875rem] border-border/70 bg-background/90 py-3",
        !isRoot && tone.ring,
        rankStyle?.border,
      )}
    >
      <div className="flex min-w-0 items-center gap-2.5">
        <div className="relative shrink-0">
          <UserAvatar
            name={member.fullName}
            src={member.profileImage}
            className={cn(
              "rounded-2xl ring-2 ring-background",
              isRoot ? "size-12" : isChild ? "size-8 rounded-xl" : "size-10",
              rankStyle?.avatarRing,
            )}
          />
          <span
            title={member.status === "ACTIVE" ? t("teamStatusActive") : t("teamStatusInactive")}
            className={cn(
              "absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full ring-2 ring-background",
              member.status === "ACTIVE" ? "bg-emerald-400" : "bg-amber-400",
            )}
          />
        </div>

        <div className="min-w-0 flex-1">
          <span
            className={cn(
              "block truncate text-[10px] font-bold",
              isRoot ? "text-primary" : tone.text,
            )}
          >
            {legLabel}
          </span>
          <p
            className={cn(
              "mt-0.5 truncate font-display font-bold",
              isRoot ? "text-base" : isChild ? "text-[11px]" : "text-sm",
              rankStyle?.title,
            )}
          >
            {member.fullName}
          </p>
          <CopyableMemberId
            memberId={member.memberId}
            className={cn("max-w-full", isChild ? "text-[9px]" : "text-[10px]")}
          />
        </div>

        <div className="flex shrink-0 items-center justify-end">
          {member.rank ? (
            <RankBadge
              src={member.rank.badgeImageUrl}
              rankKey={member.rank.rankKey}
              size={isRoot ? 52 : isChild ? 30 : 40}
            />
          ) : (
            <span
              className={cn(
                "inline-flex items-center rounded-full border border-border font-bold text-muted-foreground",
                isChild ? "px-1 py-0.5 text-[8px]" : "px-1.5 py-0.5 text-[9px]",
              )}
            >
              {t("noRankYet")}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

function EmptyNode({
  variant,
  legLabel,
  onOpen,
  locked = false,
}: {
  variant: NodeVariant;
  legLabel: string;
  onOpen: () => void;
  locked?: boolean;
}) {
  const t = useTranslations("memberPanel");
  const isChild = variant === "child";
  const stateLabel = locked ? t("teamLocked") : t("teamEmpty");

  return (
    <button
      type="button"
      aria-label={`${legLabel} ${stateLabel}`}
      onClick={locked ? undefined : onOpen}
      disabled={locked}
      style={
        locked
          ? {
              borderColor: "rgba(94, 234, 212, 0.28)",
              borderStyle: "dashed",
              backgroundColor: "rgba(20, 184, 166, 0.04)",
            }
          : {
              borderColor: "rgba(45, 212, 191, 0.5)",
              borderStyle: "dashed",
              backgroundColor: "rgba(20, 184, 166, 0.06)",
            }
      }
      className={cn(
        "glass flex w-full flex-col items-center justify-center rounded-2xl border border-dashed text-center outline-none ring-0 transition-opacity focus-visible:ring-2 focus-visible:ring-ring",
        isChild ? "gap-0.5 px-1 py-3" : "h-[4.875rem] gap-1 px-2",
        locked
          ? "border-teal-300/30 bg-teal-500/[0.04] text-muted-foreground/60 opacity-60 hover:opacity-60"
          : "border-teal-300/45 bg-teal-500/[0.06] text-teal-800 hover:opacity-100 dark:text-teal-100",
      )}
    >
      {locked ? (
        <Lock className="size-3.5 text-teal-500/60 dark:text-teal-200/50" aria-hidden="true" />
      ) : (
        <span className="text-sm font-semibold text-teal-600 dark:text-teal-300" aria-hidden="true">
          +
        </span>
      )}
      <span className={cn("font-display font-bold", isChild ? "text-[10px]" : "text-sm")}>
        {stateLabel}
      </span>
      <span className={cn("font-bold uppercase tracking-[0.13em]", isChild ? "text-[9px]" : "text-[10px]")}>
        {legLabel}
      </span>
    </button>
  );
}

function CompactProfileNode({
  member,
  locale,
  toneIndex,
  onOpen,
  onInspect,
}: {
  member: TeamPersonSummary;
  locale: string;
  toneIndex: number;
  onOpen: () => void;
  onInspect: () => void;
}) {
  const t = useTranslations("memberPanel");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressed = useRef(false);
  const tone = LEG_TONES[toneIndex % LEG_TONES.length];
  const rankStyle = member.rank ? rankAccent(member.rank.rankKey) : null;
  const shortName = compactDisplayName(member.fullName);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  function clearTimer() {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  }

  function startPress(event: ReactPointerEvent<HTMLButtonElement>) {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    longPressed.current = false;
    clearTimer();
    timer.current = setTimeout(() => {
      longPressed.current = true;
      onInspect();
    }, 550);
  }

  function handleClick() {
    if (longPressed.current) {
      longPressed.current = false;
      return;
    }
    onOpen();
  }

  return (
    <button
      type="button"
      aria-label={
        member.rank
          ? `${member.fullName} ${member.memberId} ${localizedRankName(member.rank, locale)}`
          : `${member.fullName} ${member.memberId}`
      }
      onPointerDown={startPress}
      onPointerUp={clearTimer}
      onPointerLeave={clearTimer}
      onPointerCancel={clearTimer}
      onContextMenu={(event) => {
        event.preventDefault();
        clearTimer();
        onInspect();
      }}
      onClick={handleClick}
      style={accentCardStyle(rankStyle)}
      className={cn(
        "glass flex aspect-square w-full flex-col items-center justify-center gap-0.5 rounded-xl border border-border/60 bg-background/80 p-1.5 text-center outline-none ring-1 transition-colors focus-visible:ring-2 focus-visible:ring-ring",
        tone.ring,
        rankStyle?.border,
      )}
    >
      <UserAvatar
        name={member.fullName}
        src={member.profileImage}
        className={cn("size-8 shrink-0 rounded-xl ring-1 ring-background", rankStyle?.avatarRing)}
        textClassName="text-[10px]"
      />
      <span
        className={cn("block w-full truncate text-[10px] font-bold", rankStyle?.title)}
        title={member.fullName}
      >
        {shortName}
      </span>
      <CopyableMemberId
        memberId={member.memberId}
        centered
        className="w-full max-w-full text-[8px]"
      />
      <span
        className={cn(
          "block w-full truncate text-[8px] font-bold",
          member.rank ? rankStyle?.title ?? "text-primary" : "text-muted-foreground",
        )}
      >
        {member.rank ? localizedRankName(member.rank, locale) : t("noRankYet")}
      </span>
    </button>
  );
}

function CompactEmptyNode({
  slot,
  onOpen,
  locked = false,
}: {
  slot: 1 | 2 | 3;
  onOpen: () => void;
  locked?: boolean;
}) {
  const t = useTranslations("memberPanel");
  const stateLabel = locked ? t("teamLocked") : t("teamEmpty");
  const slotLabel = `${t("teamSlot")} ${slot}`;

  return (
    <button
      type="button"
      aria-label={`${stateLabel} ${slotLabel}`}
      onClick={locked ? undefined : onOpen}
      disabled={locked}
      style={
        locked
          ? {
              borderColor: "rgba(94, 234, 212, 0.28)",
              borderStyle: "dashed",
              backgroundColor: "rgba(20, 184, 166, 0.04)",
            }
          : {
              borderColor: "rgba(45, 212, 191, 0.5)",
              borderStyle: "dashed",
              backgroundColor: "rgba(20, 184, 166, 0.06)",
            }
      }
      className={cn(
        "glass flex aspect-square w-full flex-col items-center justify-center gap-1 rounded-xl border border-dashed p-1.5 text-center outline-none transition-opacity focus-visible:ring-2 focus-visible:ring-ring",
        locked
          ? "border-teal-300/30 bg-teal-500/[0.04] text-muted-foreground/60 opacity-60 hover:opacity-60"
          : "border-teal-300/45 bg-teal-500/[0.06] text-teal-800 hover:opacity-100 dark:text-teal-100",
      )}
    >
      <span
        className={cn(
          "flex size-7 shrink-0 items-center justify-center rounded-lg border border-dashed bg-background/60",
          locked ? "border-teal-300/30" : "border-teal-300/45",
        )}
      >
        {locked ? (
          <Lock className="size-3.5 text-teal-500/60 dark:text-teal-200/50" aria-hidden="true" />
        ) : (
          <Plus className="size-3.5 text-teal-600 dark:text-teal-300" aria-hidden="true" />
        )}
      </span>
      <span className="block w-full truncate text-[10px] font-bold">{stateLabel}</span>
      <span className="block w-full truncate text-[8px] opacity-70">{slotLabel}</span>
    </button>
  );
}

export function TeamGenealogy({
  view,
  locale,
  canGoBack,
  loading,
  onBack,
  onOwnProfile,
  onOpenSlot,
  onDrillDown,
  onInspect,
}: {
  view: GenealogyView;
  locale: string;
  canGoBack: boolean;
  loading: boolean;
  onBack: () => void;
  onOwnProfile: () => void;
  onOpenSlot: (slot: 1 | 2 | 3, member: TeamPersonSummary) => void;
  onDrillDown: (member: TeamPersonSummary) => void;
  onInspect: (member: TeamPersonSummary) => void;
}) {
  const t = useTranslations("memberPanel");
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const [activeLeg, setActiveLeg] = useState(0);

  function carouselStride(scroller: HTMLDivElement) {
    const pages = scroller.querySelectorAll("section");
    if (pages.length > 1) {
      return (
        pages[1].getBoundingClientRect().left - pages[0].getBoundingClientRect().left ||
        scroller.clientWidth ||
        1
      );
    }
    return pages[0]?.getBoundingClientRect().width || scroller.clientWidth || 1;
  }

  function handleCarouselScroll() {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const index = Math.round(scroller.scrollLeft / carouselStride(scroller));
    setActiveLeg(Math.min(view.slots.length - 1, Math.max(0, index)));
  }

  function goToLeg(index: number) {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    scroller.scrollTo({ left: index * carouselStride(scroller), behavior: "smooth" });
    setActiveLeg(index);
  }

  function childSlotsFor(slot: GenealogySlot) {
    const existing = slot.member?.slots ?? [];
    return EMPTY_CHILD_SLOTS.map(
      (empty) => existing.find((child) => child.slot === empty.slot) ?? empty,
    );
  }

  function connectorBranches(count: number, toneIndex?: number): ConnectorBranch[] {
    return Array.from({ length: count }, (_, index) => {
      const tone = LEG_TONES[(toneIndex ?? index) % LEG_TONES.length];
      return {
        center: ((index + 0.5) / count) * 100,
        line: tone.line,
        arrow: tone.arrow,
      };
    });
  }

  function renderLegNode(slot: GenealogySlot, legIndex: number) {
    const toneIndex = legIndex % LEG_TONES.length;
    const legLabel = t(LEG_KEYS[slot.slot - 1]);

    if (!slot.member) {
      return (
        <EmptyNode
          variant="leg"
          legLabel={legLabel}
          onOpen={() => onOpenSlot(slot.slot, view.member)}
        />
      );
    }

    const member = slot.member;
    return (
      <ProfileNode
        member={member}
        locale={locale}
        variant="leg"
        toneIndex={toneIndex}
        legLabel={legLabel}
        onOpen={() => onDrillDown(member)}
        onInspect={() => onInspect(member)}
      />
    );
  }

  function renderChildSlots({
    slots,
    parent,
    legIndex,
    compact,
    emptySlotTarget,
  }: {
    slots: GenealogySlot[];
    parent: TeamPersonSummary;
    legIndex: number;
    compact: boolean;
    emptySlotTarget?: 1 | 2 | 3;
  }) {
    const tone = LEG_TONES[legIndex % LEG_TONES.length];
    const branches = connectorBranches(slots.length, legIndex);

    return (
      <>
        <TreeConnector
          className="mx-auto mb-1 h-16"
          branches={branches}
          trunkColorClass={tone.line}
        />
        <div className="grid grid-cols-3 gap-1.5">
          {slots.map((child) => {
            const legLabel = t(LEG_KEYS[child.slot - 1]);

            return (
              <div key={child.member?.id ?? `${parent.id}-child-${child.slot}`} className="relative">
                {compact ? (
                  child.member ? (
                    <CompactProfileNode
                      member={child.member}
                      locale={locale}
                      toneIndex={legIndex}
                      onOpen={() => onDrillDown(child.member!)}
                      onInspect={() => onInspect(child.member!)}
                    />
                  ) : (
                    <CompactEmptyNode
                      slot={child.slot}
                      locked={emptySlotTarget !== undefined}
                      onOpen={() => onOpenSlot(emptySlotTarget ?? child.slot, parent)}
                    />
                  )
                ) : child.member ? (
                  <ProfileNode
                    member={child.member}
                    locale={locale}
                    variant="child"
                    toneIndex={legIndex}
                    legLabel={legLabel}
                    onOpen={() => onDrillDown(child.member!)}
                    onInspect={() => onInspect(child.member!)}
                  />
                ) : (
                  <EmptyNode
                    variant="child"
                    legLabel={legLabel}
                    locked={emptySlotTarget !== undefined}
                    onOpen={() => onOpenSlot(emptySlotTarget ?? child.slot, parent)}
                  />
                )}
              </div>
            );
          })}
        </div>
      </>
    );
  }

  return (
    <div className={cn("space-y-4", loading && "opacity-70")}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={onOwnProfile} disabled={loading}>
            <UserRound className="size-3.5" aria-hidden="true" />
            {t("teamMyProfile")}
          </Button>
          {canGoBack ? (
            <Button type="button" variant="ghost" size="sm" onClick={onBack} disabled={loading}>
              <ArrowLeft className="size-3.5" aria-hidden="true" />
              {t("teamBack")}
            </Button>
          ) : null}
        </div>
      </div>

      {/* Mobile: root stays on top while legs swipe horizontally. */}
      <div className="lg:hidden">
        <div className="sticky top-0 z-30 -mx-4 border-b border-border/50 bg-background/85 px-4 py-3 backdrop-blur-xl">
          <div className="mx-auto w-full max-w-sm">
            <ProfileNode
              member={view.member}
              locale={locale}
              variant="root"
              toneIndex={0}
              legLabel={t("teamRoot")}
              onOpen={onOwnProfile}
              onInspect={() => onInspect(view.member)}
            />
          </div>
        </div>

        <div className="mt-8">
          <div
            ref={scrollerRef}
            onScroll={handleCarouselScroll}
            className="flex snap-x snap-mandatory gap-3 overflow-x-auto px-1 pb-4"
          >
            {view.slots.map((slot, legIndex) => (
              <section
                key={slot.slot}
                className="w-full shrink-0 snap-center px-1"
                aria-label={t(LEG_KEYS[slot.slot - 1])}
              >
                <div className="mx-auto w-full max-w-xs">{renderLegNode(slot, legIndex)}</div>
                <div className="relative mx-auto w-full max-w-md">
                  {renderChildSlots({
                    slots: childSlotsFor(slot),
                    parent: slot.member ?? view.member,
                    legIndex,
                    compact: true,
                    emptySlotTarget: slot.member ? undefined : slot.slot,
                  })}
                </div>
              </section>
            ))}
          </div>

          <div className="flex items-center justify-center gap-2">
            {view.slots.map((slot, index) => (
              <button
                key={slot.slot}
                type="button"
                aria-label={t(LEG_KEYS[slot.slot - 1])}
                aria-current={activeLeg === index}
                onClick={() => goToLeg(index)}
                className={cn(
                  "h-2 rounded-full transition-all",
                  activeLeg === index ? "w-6 bg-primary" : "w-2 bg-muted-foreground/30",
                )}
              />
            ))}
          </div>
          <p className="mt-2 text-center text-[11px] text-muted-foreground">{t("teamDiagramHint")}</p>
        </div>
      </div>

      {/* Desktop: every leg and its child slots are visible together. */}
      <div className="hidden lg:block">
        <div className="mx-auto max-w-6xl px-4 pb-8">
          <div className="relative mx-auto w-72">
            <ProfileNode
              member={view.member}
              locale={locale}
              variant="root"
              toneIndex={0}
              legLabel={t("teamRoot")}
              onOpen={onOwnProfile}
              onInspect={() => onInspect(view.member)}
            />
          </div>
          <TreeConnector
            className="mx-auto mb-1 mt-0 h-12"
            branches={connectorBranches(view.slots.length)}
          />

          <div className="grid grid-cols-3">
            {view.slots.map((slot, legIndex) => (
              <div key={slot.slot} className="relative flex flex-col items-center px-2">
                <div className="w-full max-w-xs">{renderLegNode(slot, legIndex)}</div>
                <div className="relative w-full max-w-sm">
                  {renderChildSlots({
                    slots: childSlotsFor(slot),
                    parent: slot.member ?? view.member,
                    legIndex,
                    compact: true,
                    emptySlotTarget: slot.member ? undefined : slot.slot,
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
