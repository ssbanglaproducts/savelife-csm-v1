"use client";

import { useRef, useState, type KeyboardEvent } from "react";
import { useLocale, useTranslations } from "next-intl";
import { GitBranch, ReceiptText } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useRouter } from "@/i18n/navigation";
import type {
  GenealogyView,
  TeamPerformanceDto,
  TeamPersonSummary,
} from "@/lib/services/team-performance";
import { TeamCloneDialog } from "./team-clone-dialog";
import { TeamGenealogy } from "./team-genealogy";
import { TeamInviteDialog } from "./team-invite-dialog";
import { TeamMemberDialog } from "./team-member-dialog";
import { TeamPerformancePanel } from "./team-performance-panel";
import { TeamSlotChoiceDialog } from "./team-slot-choice-dialog";

type Tab = "genealogy" | "performance";
type SlotDialog = { slot: 1 | 2 | 3; member: TeamPersonSummary };

export function TeamWorkspace({
  initialView,
  performance,
  viewerMemberId,
}: {
  initialView: GenealogyView;
  performance: TeamPerformanceDto;
  viewerMemberId: string;
}) {
  const t = useTranslations("memberPanel");
  const locale = useLocale();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("genealogy");
  const [drill, setDrill] = useState({
    source: initialView,
    view: initialView,
    history: [] as TeamPersonSummary[],
  });
  const [loading, setLoading] = useState(false);
  const [slotChoice, setSlotChoice] = useState<SlotDialog | null>(null);
  const [slotDialog, setSlotDialog] = useState<SlotDialog | null>(null);
  const [inspectMember, setInspectMember] = useState<TeamPersonSummary | null>(null);
  const [cloneOpen, setCloneOpen] = useState(false);
  const [clonePlacement, setClonePlacement] = useState<
    { slot: 1 | 2 | 3; memberId: string } | undefined
  >(undefined);
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  // router.refresh() re-renders Server Components but preserves client state.
  // Reset the drilled genealogy view when refreshed server data arrives.
  if (drill.source !== initialView) {
    setDrill({ source: initialView, view: initialView, history: [] });
  }
  const view = drill.source === initialView ? drill.view : initialView;
  const history = drill.source === initialView ? drill.history : [];

  const tabs = [
    { id: "genealogy" as const, label: t("teamTabGenealogy"), icon: GitBranch },
    { id: "performance" as const, label: t("teamTabPerformance"), icon: ReceiptText },
  ];

  async function loadMember(member: TeamPersonSummary, nextHistory?: TeamPersonSummary[]) {
    setLoading(true);
    try {
      const response = await fetch(
        `/api/member/team/genealogy?memberId=${encodeURIComponent(member.memberId)}`,
        { cache: "no-store" },
      );
      if (!response.ok) {
        toast.error(t("teamLoadFailed"));
        return;
      }
      const data = (await response.json()) as { view: GenealogyView };
      setDrill((current) => ({
        ...current,
        view: data.view,
        history: nextHistory ?? [],
      }));
    } finally {
      setLoading(false);
    }
  }

  function handleTabKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    const current = tabs.findIndex((item) => item.id === tab);
    let next = current;
    if (event.key === "ArrowRight") next = (current + 1) % tabs.length;
    else if (event.key === "ArrowLeft") next = (current - 1 + tabs.length) % tabs.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = tabs.length - 1;
    else return;
    event.preventDefault();
    setTab(tabs[next].id);
    tabRefs.current[next]?.focus();
  }

  return (
    <div className="animate-rise space-y-5">
      <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">{t("teamTitle")}</h1>

      <div role="tablist" aria-label={t("teamTitle")} className="glass flex gap-2 rounded-2xl p-2">
        {tabs.map((item, index) => {
          const selected = tab === item.id;
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              ref={(node) => {
                tabRefs.current[index] = node;
              }}
              type="button"
              role="tab"
              id={`team-${item.id}-tab`}
              aria-controls={`team-${item.id}-panel`}
              aria-selected={selected}
              tabIndex={selected ? 0 : -1}
              onClick={() => setTab(item.id)}
              onKeyDown={handleTabKeyDown}
              className={cn(
                "flex min-w-0 flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:flex-none",
                selected
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
              )}
            >
              <Icon className="size-4" aria-hidden="true" />
              {item.label}
            </button>
          );
        })}
      </div>

      {tab === "genealogy" ? (
        <div
          role="tabpanel"
          id="team-genealogy-panel"
          aria-labelledby="team-genealogy-tab"
          tabIndex={0}
          className="min-w-0"
        >
          <TeamGenealogy
            key={view.member.id}
            view={view}
            locale={locale}
            canGoBack={history.length > 0}
            loading={loading}
            onBack={() => {
              const previous = history.at(-1);
              if (previous) void loadMember(previous, history.slice(0, -1));
            }}
            onOwnProfile={() => {
              if (view.member.id !== initialView.member.id) {
                void loadMember(initialView.member, []);
              }
            }}
            onOpenSlot={(slot, member) => setSlotChoice({ slot, member })}
            onDrillDown={(member) => void loadMember(member, [...history, view.member])}
            onInspect={setInspectMember}
          />
        </div>
      ) : (
        <div
          role="tabpanel"
          id="team-performance-panel"
          aria-labelledby="team-performance-tab"
          tabIndex={0}
          className="min-w-0"
        >
          <TeamPerformancePanel data={performance} locale={locale} />
        </div>
      )}

      {slotChoice ? (
        <TeamSlotChoiceDialog
          slot={slotChoice.slot}
          placement={slotChoice.member}
          onClose={() => setSlotChoice(null)}
          onGenerate={() => {
            setSlotDialog(slotChoice);
            setSlotChoice(null);
          }}
          onClone={() => {
            setClonePlacement({ slot: slotChoice.slot, memberId: slotChoice.member.memberId });
            setCloneOpen(true);
            setSlotChoice(null);
          }}
        />
      ) : null}

      {slotDialog ? (
        <TeamInviteDialog
          slot={slotDialog.slot}
          placement={slotDialog.member}
          viewerMemberId={viewerMemberId}
          onClose={() => setSlotDialog(null)}
        />
      ) : null}

      {inspectMember ? (
        <TeamMemberDialog member={inspectMember} onClose={() => setInspectMember(null)} />
      ) : null}

      {cloneOpen ? (
        <TeamCloneDialog
          viewerMemberId={viewerMemberId}
          placementMemberId={clonePlacement?.memberId}
          placementSlot={clonePlacement?.slot}
          onClose={() => {
            setCloneOpen(false);
            setClonePlacement(undefined);
          }}
          onSuccess={() => router.refresh()}
        />
      ) : null}
    </div>
  );
}
