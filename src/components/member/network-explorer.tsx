"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import {
  ChevronDown,
  ChevronRight,
  Loader2,
  Network,
  Plus,
  Search,
  Users,
} from "lucide-react";
import { PageHeader } from "@/components/member/page-header";
import { statusLabelKey } from "@/components/member/status-labels";
import { Button } from "@/components/ui/button";
import { RankBadge } from "@/components/ui/rank-badge";
import { UserAvatar } from "@/components/ui/user-avatar";
import { localizedRankName } from "@/lib/rank-label";
import { accentCardStyle, rankAccent } from "@/lib/rank-accent";
import { cn } from "@/lib/utils";
import type { MemberRankSummary } from "@/lib/services/member-rank-summary";

type NetworkView = "placement" | "sponsor";
type Slot = 1 | 2 | 3;

type NetworkNode = {
  id: string;
  memberId: string;
  fullName: string;
  profileImage: string | null;
  status: string;
  slot: Slot | null;
  placementChildren: number;
  directReferrals: number;
  rank: MemberRankSummary | null;
};

type SlotEntry = { slot: Slot; node: NetworkNode | null };
type TreeSlotEntry = { slot: Slot; node: TreeNode | null };

type TreeNode = NetworkNode & {
  loaded: boolean;
  expanded: boolean;
  loading: boolean;
  children: TreeNode[];
  slots: TreeSlotEntry[];
};

type ChildrenResponse = { nodes: NetworkNode[]; slots: SlotEntry[] };

type NetworkDetails = {
  id: string;
  memberId: string;
  fullName: string;
  status: string;
  rank: MemberRankSummary | null;
  joinedAt: string;
  placementSlot: number | null;
  occupiedSlots: number;
  directReferrals: number;
  directPlacements: number;
  sponsor: { memberId: string; fullName: string } | null;
  placementParent: { memberId: string; fullName: string } | null;
};

const depthOptions = [1, 2, 3, 5, 10, 20];

function makeNode(node: NetworkNode): TreeNode {
  return { ...node, loaded: false, expanded: false, loading: false, children: [], slots: [] };
}

function findNode(node: TreeNode, id: string): TreeNode | null {
  if (node.id === id) return node;
  for (const child of node.children) {
    const found = findNode(child, id);
    if (found) return found;
  }
  for (const entry of node.slots) {
    if (!entry.node) continue;
    const found = findNode(entry.node, id);
    if (found) return found;
  }
  return null;
}

function updateNode(node: TreeNode, id: string, updater: (current: TreeNode) => TreeNode): TreeNode {
  if (node.id === id) return updater(node);

  let changed = false;
  const children = node.children.map((child) => {
    const next = updateNode(child, id, updater);
    if (next !== child) changed = true;
    return next;
  });
  const slots = node.slots.map((entry) => {
    if (!entry.node) return entry;
    const next = updateNode(entry.node, id, updater);
    if (next === entry.node) return entry;
    changed = true;
    return { ...entry, node: next };
  });

  return changed ? { ...node, children, slots } : node;
}

function childNodes(node: TreeNode, view: NetworkView): TreeNode[] {
  return view === "placement"
    ? node.slots.flatMap((entry) => (entry.node ? [entry.node] : []))
    : node.children;
}

function setChildren(node: TreeNode, view: NetworkView, data: ChildrenResponse): TreeNode {
  if (view === "placement") {
    return {
      ...node,
      slots: data.slots.map((entry) => ({
        slot: entry.slot,
        node: entry.node ? makeNode(entry.node) : null,
      })),
    };
  }
  return { ...node, children: data.nodes.map(makeNode) };
}

function collapseAll(node: TreeNode): TreeNode {
  return {
    ...node,
    expanded: false,
    children: node.children.map(collapseAll),
    slots: node.slots.map((entry) =>
      entry.node ? { ...entry, node: collapseAll(entry.node) } : entry,
    ),
  };
}

async function fetchChildren(node: NetworkNode, view: NetworkView): Promise<TreeNode> {
  const response = await fetch(
    `/api/member/network/children?view=${view}&nodeId=${encodeURIComponent(node.id)}`,
    { cache: "no-store" },
  );
  if (!response.ok) throw new Error("Unable to load network children");
  const data = (await response.json()) as ChildrenResponse;
  const base = setChildren(makeNode(node), view, data);
  return { ...base, loaded: true, expanded: true };
}

export function NetworkExplorer({
  root,
  title,
  intro,
  locale,
}: {
  root: NetworkNode;
  title: string;
  intro: string;
  locale: string;
}) {
  const t = useTranslations("memberPanel");
  const [view, setView] = useState<NetworkView>("placement");
  const [tree, setTree] = useState<TreeNode>(() => makeNode(root));
  const [depth, setDepth] = useState(3);
  const [loadingRoot, setLoadingRoot] = useState(true);
  const [expanding, setExpanding] = useState(false);
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<NetworkNode[] | null>(null);
  const [details, setDetails] = useState<NetworkDetails | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);

  const loadRoot = useCallback(async () => {
    setLoadingRoot(true);
    try {
      const loaded = await fetchChildren(root, view);
      setTree(loaded);
    } finally {
      setLoadingRoot(false);
    }
  }, [root, view]);

  useEffect(() => {
    let active = true;
    // Defer the first fetch so effects only subscribe/schedule, never set state
    // synchronously during render commit.
    const handle = window.setTimeout(() => {
      if (active) void loadRoot();
    }, 0);
    return () => {
      active = false;
      window.clearTimeout(handle);
    };
  }, [loadRoot]);

  function changeView(next: NetworkView) {
    if (next === view) return;
    setView(next);
    setSearchResults(null);
    setDetails(null);
  }

  function toggleNode(id: string) {
    const current = findNode(tree, id);
    if (!current) return;

    if (current.loaded && current.expanded) {
      setTree((previous) => updateNode(previous, id, (node) => ({ ...node, expanded: false })));
      return;
    }
    if (current.loaded) {
      setTree((previous) => updateNode(previous, id, (node) => ({ ...node, expanded: true })));
      return;
    }

    setTree((previous) => updateNode(previous, id, (node) => ({ ...node, loading: true })));
    void fetchChildren(current, view)
      .then((loaded) => {
        setTree((previous) => updateNode(previous, id, () => loaded));
      })
      .finally(() => {
        setTree((previous) =>
          updateNode(previous, id, (node) => ({ ...node, loading: false })),
        );
      });
  }

  async function handleExpandAll() {
    setExpanding(true);
    try {
      async function walk(node: TreeNode, level: number): Promise<TreeNode> {
        let current = node;
        if (!current.loaded) current = await fetchChildren(current, view);
        current = { ...current, expanded: true };
        if (level + 1 >= depth) return current;

        const children = childNodes(current, view);
        const updated: TreeNode[] = [];
        for (const child of children) {
          updated.push(await walk(child, level + 1));
        }
        let index = 0;
        if (view === "placement") {
          current = {
            ...current,
            slots: current.slots.map((entry) =>
              entry.node ? { ...entry, node: updated[index++] } : entry,
            ),
          };
        } else {
          current = { ...current, children: updated };
        }
        return current;
      }

      setTree(await walk(tree, 0));
    } finally {
      setExpanding(false);
    }
  }

  async function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const term = query.trim();
    if (!term) {
      setSearchResults(null);
      return;
    }

    setSearching(true);
    try {
      const response = await fetch(
        `/api/member/network/search?view=${view}&query=${encodeURIComponent(term)}`,
        { cache: "no-store" },
      );
      if (!response.ok) throw new Error("Search failed");
      const data = (await response.json()) as { nodes: NetworkNode[] };
      setSearchResults(data.nodes);
    } finally {
      setSearching(false);
    }
  }

  async function openDetails(node: NetworkNode) {
    setDetailsLoading(true);
    try {
      const response = await fetch(
        `/api/member/network/details?view=${view}&memberId=${encodeURIComponent(node.id)}`,
        { cache: "no-store" },
      );
      if (!response.ok) throw new Error("Details failed");
      setDetails((await response.json()) as NetworkDetails);
    } finally {
      setDetailsLoading(false);
    }
  }

  const viewLabel = view === "placement" ? t("placementNetwork") : t("sponsorNetwork");

  return (
    <div className="space-y-8 animate-rise">
      <PageHeader
        eyebrow={t("networkIntro")}
        title={title}
        intro={intro}
        icon={<Network className="size-3.5" aria-hidden="true" />}
      />

      <div className="glass rounded-3xl p-4 sm:p-6">
        <div className="flex flex-wrap items-center gap-2">
          {(["placement", "sponsor"] as const).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => changeView(value)}
              aria-pressed={view === value}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-ring ${
                view === value
                  ? "bg-primary text-primary-foreground"
                  : "border border-border text-muted-foreground hover:bg-primary/10 hover:text-primary"
              }`}
            >
              {value === "placement" ? t("placementNetwork") : t("sponsorNetwork")}
            </button>
          ))}
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-[minmax(0,1fr)_auto_auto] md:items-end">
          <form onSubmit={(event) => void handleSearch(event)} className="min-w-0">
            <label htmlFor="network-search" className="text-xs font-semibold text-muted-foreground">
              {t("searchNetwork")}
            </label>
            <div className="mt-1.5 flex gap-2">
              <input
                id="network-search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={t("searchNetwork")}
                className="h-11 min-w-0 flex-1 rounded-xl border border-border bg-[var(--glass-strong)] px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
              <Button type="submit" size="icon" aria-label={t("searchNetwork")} disabled={searching}>
                {searching ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
              </Button>
            </div>
          </form>

          <label className="block text-xs font-semibold text-muted-foreground">
            {t("depth")}
            <select
              value={depth}
              onChange={(event) => setDepth(Number(event.target.value))}
              className="mt-1.5 h-11 w-full rounded-xl border border-border bg-[var(--glass-strong)] px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring md:w-28"
            >
              {depthOptions.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>

          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => void handleExpandAll()} disabled={expanding}>
              {expanding ? <Loader2 className="size-4 animate-spin" /> : null}
              {t("expandAll")}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setTree(collapseAll(tree))}>
              {t("collapseAll")}
            </Button>
          </div>
        </div>
      </div>

      {searchResults ? (
        <section className="glass rounded-3xl p-5 sm:p-6" aria-label={t("searchNetwork")}>
          <h2 className="text-sm font-bold">{viewLabel}</h2>
          {searchResults.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">{t("noResults")}</p>
          ) : (
            <ul className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {searchResults.map((node) => {
                const accent = node.rank ? rankAccent(node.rank.rankKey) : null;
                return (
                  <li
                    key={node.id}
                    style={accentCardStyle(accent)}
                    className={cn("rounded-2xl border border-border p-4", accent?.border)}
                  >
                    <MemberIdentity node={node} locale={locale} t={t} />
                    <Button
                      type="button"
                      variant="ghost"
                      className="mt-2 h-auto p-0 text-xs text-primary hover:bg-transparent hover:underline"
                      onClick={() => void openDetails(node)}
                    >
                      {t("viewDetails")}
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section className="glass min-w-0 rounded-3xl p-5 sm:p-6" aria-label={viewLabel}>
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-display text-lg font-bold tracking-tight">{viewLabel}</h2>
            {loadingRoot ? <Loader2 className="size-4 animate-spin text-primary" aria-hidden="true" /> : null}
          </div>

          <div className="mt-5 overflow-x-auto pb-2">
            <div className="min-w-[280px]">
              <TreeNodeCard
                node={tree}
                view={view}
                level={0}
                locale={locale}
                t={t}
                onToggle={toggleNode}
                onDetails={(node) => void openDetails(node)}
              />
            </div>
          </div>
        </section>

        <aside className="glass h-fit rounded-3xl p-5 sm:p-6" aria-live="polite">
          <h2 className="font-display text-lg font-bold tracking-tight">{t("viewDetails")}</h2>
          {detailsLoading ? (
            <Loader2 className="mt-5 size-5 animate-spin text-primary" aria-hidden="true" />
          ) : !details ? (
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">{t("noNetworkMembers")}</p>
          ) : (
            <div className="mt-5 space-y-4">
              <MemberIdentity
                node={{
                  id: details.id,
                  memberId: details.memberId,
                  fullName: details.fullName,
                  profileImage: null,
                  status: details.status,
                  slot: details.placementSlot as Slot | null,
                  placementChildren: details.directPlacements,
                  directReferrals: details.directReferrals,
                  rank: details.rank,
                }}
                locale={locale}
                t={t}
              />
              <dl className="space-y-3 border-t border-border pt-4 text-sm">
                <Detail label={t("directReferrals")} value={String(details.directReferrals)} />
                <Detail label={t("directPlacements")} value={String(details.directPlacements)} />
                <Detail label={t("placementSlots")} value={`${details.occupiedSlots}/3`} />
                <Detail
                  label={t("sponsor")}
                  value={
                    details.sponsor
                      ? `${details.sponsor.memberId} — ${details.sponsor.fullName}`
                      : "—"
                  }
                />
                <Detail
                  label={t("placementParent")}
                  value={
                    details.placementParent
                      ? `${details.placementParent.memberId} — ${details.placementParent.fullName}`
                      : "—"
                  }
                />
                <Detail
                  label={t("joiningDate")}
                  value={new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(new Date(details.joinedAt))}
                />
                <Detail
                  label={t("rank")}
                  value={
                    details.rank ? localizedRankName(details.rank, locale) : t("noRankYet")
                  }
                />
                <Detail label={t("placementRewards")} value={t("placementRewardsComingSoon")} />
              </dl>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

function TreeNodeCard({
  node,
  view,
  level,
  locale,
  t,
  onToggle,
  onDetails,
}: {
  node: TreeNode;
  view: NetworkView;
  level: number;
  locale: string;
  t: ReturnType<typeof useTranslations>;
  onToggle: (id: string) => void;
  onDetails: (node: NetworkNode) => void;
}) {
  const children = childNodes(node, view);
  const hasChildren = view === "placement" || node.directReferrals > 0;
  const rankStyle = node.rank ? rankAccent(node.rank.rankKey) : null;
  const compact = level > 0;

  function expandedChildren() {
    if (!node.expanded || children.length === 0) return null;

    return (
      <div className={cn("pl-1", compact ? "mt-2 space-y-2" : "mt-3 space-y-3")}>
        {view === "placement"
          ? node.slots.map((entry) => (
              <div key={entry.slot} className="min-w-0">
                {entry.node ? (
                  <TreeNodeCard
                    node={entry.node}
                    view={view}
                    level={level + 1}
                    locale={locale}
                    t={t}
                    onToggle={onToggle}
                    onDetails={onDetails}
                  />
                ) : (
                  <div className="glass flex w-full items-center gap-2 rounded-xl border border-dashed border-border/70 px-2 py-2 text-left text-muted-foreground">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-xl border border-dashed border-border bg-background/60">
                      <Plus className="size-3.5" aria-hidden="true" />
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[11px] font-bold">
                      {t("available")}
                    </span>
                  </div>
                )}
              </div>
            ))
          : children.map((child) => (
              <TreeNodeCard
                key={child.id}
                node={child}
                view={view}
                level={level + 1}
                locale={locale}
                t={t}
                onToggle={onToggle}
                onDetails={onDetails}
              />
            ))}
      </div>
    );
  }

  if (compact) {
    return (
      <div className="border-l border-border/80 pl-2">
        <div
          style={accentCardStyle(rankStyle)}
          className={cn("glass rounded-xl border border-border/70 p-2", rankStyle?.border)}
        >
          <div className="flex min-w-0 items-center gap-2">
            <UserAvatar
              name={node.fullName}
              src={node.profileImage}
              className={cn("size-8 shrink-0 rounded-xl", rankStyle?.avatarRing)}
              textClassName="text-[10px]"
            />
            <div className="min-w-0 flex-1">
              <p className={cn("truncate text-[11px] font-bold", rankStyle?.title)}>{node.fullName}</p>
              <p className="truncate font-mono text-[8px] text-muted-foreground" translate="no">
                {node.memberId}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              {node.rank ? (
                <RankBadge
                  src={node.rank.badgeImageUrl}
                  rankKey={node.rank.rankKey}
                  size={26}
                />
              ) : (
                <span className="max-w-[86px] rounded-full border border-border px-1.5 py-0.5 text-[8px] font-bold text-muted-foreground">
                  {t("noRankYet")}
                </span>
              )}
              {hasChildren ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-7"
                  aria-label={node.expanded ? t("collapse") : t("expand")}
                  aria-expanded={node.expanded}
                  onClick={() => onToggle(node.id)}
                  disabled={node.loading}
                >
                  {node.loading ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : node.expanded ? (
                    <ChevronDown className="size-3.5" />
                  ) : (
                    <ChevronRight className="size-3.5" />
                  )}
                </Button>
              ) : null}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-7 text-primary"
                aria-label={t("viewDetails")}
                onClick={() => onDetails(node)}
              >
                <Users className="size-3.5" aria-hidden="true" />
              </Button>
            </div>
          </div>
        </div>
        {expandedChildren()}
      </div>
    );
  }

  return (
    <div>
      <div
        style={accentCardStyle(rankStyle)}
        className={cn(
          "glass rounded-2xl border border-border/70 p-4",
          rankStyle?.border,
        )}
      >
        <div className="flex flex-wrap items-center gap-3">
          <UserAvatar
            name={node.fullName}
            src={node.profileImage}
            className={cn("size-11 rounded-2xl", rankStyle?.avatarRing)}
          />

          <div className="min-w-0 flex-1">
            <p className={cn("truncate text-sm font-bold", rankStyle?.title)}>{node.fullName}</p>
            <p className="mt-0.5 truncate font-mono text-[11px] text-muted-foreground" translate="no">
              {node.memberId}
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
                {t(statusLabelKey(node.status))}
              </span>
            </div>
          </div>

          <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
            {node.rank ? (
              <RankBadge
                src={node.rank.badgeImageUrl}
                rankKey={node.rank.rankKey}
                size={36}
              />
            ) : (
              <span className="max-w-[110px] rounded-full border border-border px-2 py-1 text-[10px] font-bold text-muted-foreground">
                {t("noRankYet")}
              </span>
            )}
            {hasChildren ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 gap-1 px-2 text-xs"
                aria-expanded={node.expanded}
                onClick={() => onToggle(node.id)}
                disabled={node.loading}
              >
                {node.loading ? (
                  <Loader2 className="size-3 animate-spin" />
                ) : node.expanded ? (
                  <ChevronDown className="size-3" />
                ) : (
                  <ChevronRight className="size-3" />
                )}
                {node.expanded ? t("collapse") : t("expand")}
              </Button>
            ) : null}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 px-1 text-xs text-primary hover:bg-transparent hover:underline"
              onClick={() => onDetails(node)}
            >
              {t("viewDetails")}
            </Button>
          </div>
        </div>
      </div>
      {expandedChildren()}
    </div>
  );
}

function MemberIdentity({
  node,
  locale,
  t,
}: {
  node: NetworkNode;
  locale: string;
  t: ReturnType<typeof useTranslations>;
}) {
  const rankStyle = node.rank ? rankAccent(node.rank.rankKey) : null;

  return (
    <div
      aria-label={
        node.rank
          ? `${node.fullName} ${node.memberId} ${localizedRankName(node.rank, locale)}`
          : `${node.fullName} ${node.memberId}`
      }
      style={accentCardStyle(rankStyle)}
      className={cn(
        "flex min-w-0 items-center gap-3 rounded-xl border border-transparent p-1",
        rankStyle?.border,
      )}
    >
      <UserAvatar
        name={node.fullName}
        src={node.profileImage}
        className={cn("size-11 rounded-2xl", rankStyle?.avatarRing)}
      />
      <div className="min-w-0 flex-1">
        <p className={cn("truncate text-sm font-bold", rankStyle?.title)}>{node.fullName}</p>
        <p className="truncate font-mono text-[11px] text-muted-foreground" translate="no">
          {node.memberId}
        </p>
        <span className="mt-1 inline-flex items-center gap-1 text-[10px] font-bold text-primary">
          <Users className="size-3" aria-hidden="true" />
          {t(statusLabelKey(node.status))}
        </span>
      </div>
      {node.rank ? (
        <RankBadge src={node.rank.badgeImageUrl} rankKey={node.rank.rankKey} size={36} />
      ) : (
        <span className="max-w-[110px] rounded-full border border-border px-2 py-1 text-[10px] font-bold text-muted-foreground">
          {t("noRankYet")}
        </span>
      )}
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-1 break-words text-sm font-semibold" translate="no">
        {value}
      </dd>
    </div>
  );
}
