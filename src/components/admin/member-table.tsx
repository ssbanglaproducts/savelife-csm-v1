"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  Ban,
  CheckCircle2,
  Copy,
  Eye,
  Info,
  MoreVertical,
  RotateCcw,
  Search,
  SlidersHorizontal,
  Wallet,
} from "lucide-react";
import { Link } from "@/i18n/navigation";
import { copyText } from "@/lib/clipboard";
import {
  AdminRecordField,
  AdminTable,
  EmptyState,
  StatusBadge,
  adminInputClass,
  memberStatusKey,
  statusTone,
} from "./admin-ui";
import { Button, buttonVariants } from "@/components/ui/button";
import { RankBadge } from "@/components/ui/rank-badge";
import { cn } from "@/lib/utils";
import {
  MemberActionDialog,
  MemberAvatar,
  type MemberActionMember,
  type MemberActionState,
} from "./member-actions";

export type MemberLevelCell = {
  level: number;
  count: number;
  earned: string;
  invested: string;
};

export type MemberRow = MemberActionMember & {
  email: string;
  phone: string;
  profileImage: string | null;
  rankKey: string | null;
  rankName: string;
  rankBadge: string | null;
  invested: string;
  earned: string;
  walletBalance: string;
  walletTooltip: string;
  joined: string;
  note: string | null;
  levels: MemberLevelCell[];
  teamSize: number;
};

export function MemberTable({ rows }: { rows: MemberRow[] }) {
  const t = useTranslations("adminPanel");
  const tc = useTranslations("common");
  const tm = useTranslations("memberPanel");
  const fieldId = useId();
  const filterRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [rankFilter, setRankFilter] = useState("ALL");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [menuRowId, setMenuRowId] = useState<string | null>(null);
  const [dialog, setDialog] = useState<MemberActionState | null>(null);

  const statusOptions = useMemo(
    () => ["ACTIVE", "INACTIVE", "SUSPENDED"].filter((status) => rows.some((row) => row.status === status)),
    [rows],
  );
  const rankOptions = useMemo(
    () =>
      Array.from(new Set(rows.map((row) => row.rankName))).sort((a, b) => a.localeCompare(b)),
    [rows],
  );

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return rows.filter((row) => {
      if (statusFilter !== "ALL" && row.status !== statusFilter) return false;
      if (rankFilter !== "ALL" && row.rankName !== rankFilter) return false;
      if (!needle) return true;
      return [row.memberId, row.name, row.rankName, row.email, row.phone, row.status].some((value) =>
        value.toLowerCase().includes(needle),
      );
    });
  }, [query, rankFilter, rows, statusFilter]);

  const activeFilterCount =
    (statusFilter === "ALL" ? 0 : 1) + (rankFilter === "ALL" ? 0 : 1);

  useEffect(() => {
    if (!filtersOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!filterRef.current?.contains(event.target as Node)) setFiltersOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setFiltersOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [filtersOpen]);

  function resetFilters() {
    setStatusFilter("ALL");
    setRankFilter("ALL");
    setFiltersOpen(false);
  }

  function teamTooltip(row: MemberRow): string {
    const leg1 = row.levels.find((level) => level.level === 1);
    const leg2 = row.levels.find((level) => level.level === 2);
    const leg3 = row.levels.find((level) => level.level === 3);
    return [
      `${t("legA")}: ${leg1?.count ?? 0} ${t("teamMembers")} · ${t("invested")} ${leg1?.invested ?? "0 SP"}`,
      `${t("legB")}: ${leg2?.count ?? 0} ${t("teamMembers")} · ${t("invested")} ${leg2?.invested ?? "0 SP"}`,
      `${t("legC")}: ${leg3?.count ?? 0} ${t("teamMembers")} · ${t("invested")} ${leg3?.invested ?? "0 SP"}`,
    ].join("\n");
  }

  async function copy(value: string, label: string) {
    if (!(await copyText(value))) {
      toast.error(tc("error"));
      return;
    }
    toast.success(`${label}: ${value}`);
  }

  function openStatusDialog(row: MemberRow) {
    const kind =
      row.status === "SUSPENDED"
        ? "reactivate"
        : row.status === "INACTIVE"
          ? "activate"
          : "deactivate";
    setDialog({ kind, member: row });
  }

  const statusLabel = (row: MemberRow) => tm(memberStatusKey(row.status));

  const memberCards = (
    <div className="grid gap-3">
      {filtered.map((row) => {
        const detailHref = `/admin/members/${row.memberId}`;
        const statusAction =
          row.status === "SUSPENDED"
            ? t("reactivate")
            : row.status === "INACTIVE"
              ? t("activate")
              : t("deactivate");

        return (
          <article key={row.id} className="glass min-w-0 rounded-2xl p-4">
            <div className="flex items-start gap-3">
              <MemberAvatar name={row.name} src={row.profileImage} />
              <div className="min-w-0 flex-1">
                <Link
                  href={detailHref}
                  className="font-display text-base font-semibold hover:text-primary focus-visible:rounded focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {row.name}
                </Link>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  {row.memberId} · {t("joined")} {row.joined}
                </p>
                <div className="mt-2">
                  <StatusBadge tone={statusTone(row.status)} label={statusLabel(row)} />
                </div>
              </div>
            </div>

            <dl className="mt-4 grid grid-cols-2 gap-x-3 gap-y-3 text-xs">
              <AdminRecordField
                label={tm("rank")}
                value={
                  <span className="flex items-center gap-2">
                    {row.rankKey ? (
                      <RankBadge src={row.rankBadge} rankKey={row.rankKey} size={28} />
                    ) : null}
                    {row.rankName}
                  </span>
                }
              />
              <AdminRecordField label={t("invested")} value={row.invested} />
              <AdminRecordField label={t("earned")} value={row.earned} />
              <AdminRecordField
                label={t("walletBalances")}
                value={
                  <span title={row.walletTooltip} className="inline-flex cursor-help items-center gap-1">
                    {row.walletBalance}
                    <Info className="size-3 text-muted-foreground" aria-hidden="true" />
                  </span>
                }
              />
              <AdminRecordField
                label={t("teamSize")}
                value={
                  <span title={teamTooltip(row)} className="inline-flex cursor-help items-center gap-1">
                    {row.teamSize}
                    <Info className="size-3 text-muted-foreground" aria-hidden="true" />
                  </span>
                }
              />
              <AdminRecordField label={t("email")} value={row.email} wide />
            </dl>

            <div className="mt-4 flex flex-wrap gap-2">
              <Link
                href={detailHref}
                className={`${buttonVariants({ variant: "ghost", size: "sm" })} min-h-10`}
              >
                {t("viewDetails")}
              </Link>
              <button
                type="button"
                onClick={() => setDialog({ kind: "topup", member: row })}
                className={`${buttonVariants({ variant: "outline", size: "sm" })} min-h-10`}
              >
                {t("topUp")}
              </button>
              <button
                type="button"
                onClick={() => openStatusDialog(row)}
                className={`${buttonVariants({ variant: "outline", size: "sm" })} min-h-10`}
              >
                {statusAction}
              </button>
            </div>
          </article>
        );
      })}
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="glass rounded-xl p-2">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <label className="relative min-w-0 flex-1">
            <span className="sr-only">{tc("search")}</span>
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <input
              id={`${fieldId}-search`}
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={tc("search")}
              className={cn(adminInputClass, "pl-10")}
            />
          </label>

          <div ref={filterRef} className="relative shrink-0">
            <button
              type="button"
              aria-expanded={filtersOpen}
              aria-controls={`${fieldId}-filters`}
              onClick={() => setFiltersOpen((open) => !open)}
              className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-border bg-[var(--glass)] px-4 text-sm font-semibold transition-colors hover:border-primary/50 hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:w-auto"
            >
              <SlidersHorizontal className="size-4" aria-hidden="true" />
              {tc("filter")}
              {activeFilterCount > 0 ? (
                <span className="grid size-5 place-items-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                  {activeFilterCount}
                </span>
              ) : null}
            </button>

            {filtersOpen ? (
              <div
                id={`${fieldId}-filters`}
                role="group"
                aria-label={tc("filter")}
                className="absolute right-0 z-20 mt-2 w-[min(20rem,calc(100vw-2rem))] rounded-xl border border-border bg-[var(--glass-strong)] p-3 shadow-xl backdrop-blur-xl"
              >
                <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  {t("memberStatusFilter")}
                  <select
                    value={statusFilter}
                    onChange={(event) => setStatusFilter(event.target.value)}
                    className={cn(adminInputClass, "mt-1 h-9 text-xs normal-case tracking-normal")}
                  >
                    <option value="ALL">{t("allStatuses")}</option>
                    {statusOptions.map((status) => (
                      <option key={status} value={status}>
                        {tm(memberStatusKey(status))}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="mt-3 block text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  {t("memberRankFilter")}
                  <select
                    value={rankFilter}
                    onChange={(event) => setRankFilter(event.target.value)}
                    className={cn(adminInputClass, "mt-1 h-9 text-xs normal-case tracking-normal")}
                  >
                    <option value="ALL">{t("allRanks")}</option>
                    {rankOptions.map((rank) => (
                      <option key={rank} value={rank}>
                        {rank}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="mt-3 flex justify-end gap-2">
                  <Button type="button" variant="ghost" size="sm" onClick={resetFilters}>
                    {t("filterReset")}
                  </Button>
                  <Button type="button" size="sm" onClick={() => setFiltersOpen(false)}>
                    {t("filterApply")}
                  </Button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState message={tc("noResults")} />
      ) : (
        <AdminTable
          caption={t("membersTitle")}
          headers={[
            "Member ID",
            t("name"),
            tm("rank"),
            t("email"),
            t("invested"),
            t("earned"),
            t("walletBalances"),
            t("teamSize"),
            t("actions"),
          ]}
          mobile={memberCards}
        >
          {filtered.map((row) => {
            const detailHref = `/admin/members/${row.memberId}`;

            return (
              <tr key={row.id} className="align-top">
                <td className="whitespace-nowrap px-4 py-3">
                  <Link
                    href={detailHref}
                    title={`${t("joined")}: ${row.joined}`}
                    className="block font-mono text-xs underline decoration-dotted decoration-muted-foreground/50 underline-offset-4 hover:text-primary focus-visible:rounded focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {row.memberId}
                  </Link>
                  <span className="mt-1 block">
                    <StatusBadge tone={statusTone(row.status)} label={statusLabel(row)} />
                  </span>
                </td>

                <td className="min-w-[150px] px-4 py-3">
                  <div className="flex items-center gap-2">
                    <MemberAvatar name={row.name} src={row.profileImage} />
                    <div className="min-w-0">
                      <Link
                        href={detailHref}
                        className="block font-semibold hover:text-primary focus-visible:rounded focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        {row.name}
                      </Link>
                    </div>
                  </div>
                </td>

                <td className="whitespace-nowrap px-4 py-3">
                  {row.rankKey ? (
                    <div className="flex items-center gap-2">
                      <RankBadge src={row.rankBadge} rankKey={row.rankKey} size={36} />
                      <span className="text-xs font-semibold">{row.rankName}</span>
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground">{row.rankName}</span>
                  )}
                </td>

                <td className="min-w-[180px] px-4 py-3 text-xs">
                  <button
                    type="button"
                    onClick={() => copy(row.email, t("email"))}
                    title={t("copyEmail")}
                    className="group flex w-full items-center gap-1 break-all text-left hover:text-primary"
                  >
                    {row.email}
                    <Copy
                      className="size-3 shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
                      aria-hidden="true"
                    />
                  </button>
                  <button
                    type="button"
                    onClick={() => copy(row.phone, t("phone"))}
                    title={t("copyPhone")}
                    className="group mt-1 flex items-center gap-1 whitespace-nowrap text-left text-muted-foreground hover:text-primary"
                  >
                    {row.phone}
                    <Copy
                      className="size-3 shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
                      aria-hidden="true"
                    />
                  </button>
                </td>

                <td className="whitespace-nowrap px-4 py-3 font-semibold tabular-nums">
                  {row.invested}
                </td>

                <td className="whitespace-nowrap px-4 py-3 font-semibold tabular-nums">
                  {row.earned}
                </td>

                <td className="whitespace-nowrap px-4 py-3">
                  <span
                    title={row.walletTooltip}
                    className="inline-flex cursor-help items-center gap-1 font-semibold tabular-nums"
                  >
                    {row.walletBalance}
                    <Info className="size-3 text-muted-foreground" aria-hidden="true" />
                  </span>
                </td>

                <td className="whitespace-nowrap px-4 py-3">
                  <span
                    title={teamTooltip(row)}
                    className="inline-flex cursor-help items-center gap-1 text-sm font-bold tabular-nums"
                  >
                    {row.teamSize}
                    <Info className="size-3 text-muted-foreground" aria-hidden="true" />
                  </span>
                </td>

                <td className="relative px-4 py-3 text-right">
                  <button
                    type="button"
                    aria-label={t("actions")}
                    aria-expanded={menuRowId === row.id}
                    onClick={() => setMenuRowId((current) => (current === row.id ? null : row.id))}
                    className="inline-flex size-9 items-center justify-center rounded-xl border border-border bg-[var(--glass)] transition-colors hover:border-primary/50 hover:text-primary"
                  >
                    <MoreVertical className="size-4" aria-hidden="true" />
                  </button>
                  {menuRowId === row.id ? (
                    <div className="absolute right-4 top-14 z-20 w-44 overflow-hidden rounded-xl border border-border bg-[var(--card-solid)] shadow-xl">
                      <Link
                        href={detailHref}
                        onClick={() => setMenuRowId(null)}
                        className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm hover:bg-accent"
                      >
                        <Eye className="size-4" aria-hidden="true" />
                        {t("viewDetails")}
                      </Link>
                      <button
                        type="button"
                        onClick={() => {
                          setMenuRowId(null);
                          setDialog({ kind: "topup", member: row });
                        }}
                        className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm hover:bg-accent"
                      >
                        <Wallet className="size-4" aria-hidden="true" />
                        {t("topUp")}
                      </button>
                      {row.status === "SUSPENDED" ? (
                        <button
                          type="button"
                          onClick={() => {
                            setMenuRowId(null);
                            setDialog({ kind: "reactivate", member: row });
                          }}
                          className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm hover:bg-accent"
                        >
                          <RotateCcw className="size-4" aria-hidden="true" />
                          {t("reactivate")}
                        </button>
                      ) : row.status === "INACTIVE" ? (
                        <button
                          type="button"
                          onClick={() => {
                            setMenuRowId(null);
                            setDialog({ kind: "activate", member: row });
                          }}
                          className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm hover:bg-accent"
                        >
                          <CheckCircle2 className="size-4" aria-hidden="true" />
                          {t("activate")}
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setMenuRowId(null);
                            setDialog({ kind: "deactivate", member: row });
                          }}
                          className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-red-500 hover:bg-red-500/10"
                        >
                          <Ban className="size-4" aria-hidden="true" />
                          {t("deactivate")}
                        </button>
                      )}
                    </div>
                  ) : null}
                </td>
              </tr>
            );
          })}
        </AdminTable>
      )}

      {dialog ? (
        <MemberActionDialog
          key={`${dialog.member.id}-${dialog.kind}`}
          state={dialog}
          onClose={() => setDialog(null)}
        />
      ) : null}
    </div>
  );
}
