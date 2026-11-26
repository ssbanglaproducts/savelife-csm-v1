"use client";

import { useId, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Ban, CheckCircle2, Copy, Eye, Info, MoreVertical, RotateCcw, Wallet } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { copyText } from "@/lib/clipboard";
import {
  AdminTable,
  EmptyState,
  StatusBadge,
  adminInputClass,
  memberStatusKey,
  statusTone,
} from "./admin-ui";
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
  const [query, setQuery] = useState("");
  const [menuRowId, setMenuRowId] = useState<string | null>(null);
  const [dialog, setDialog] = useState<MemberActionState | null>(null);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter((row) =>
      [row.memberId, row.name, row.email, row.phone, row.status].some((value) =>
        value.toLowerCase().includes(needle),
      ),
    );
  }, [query, rows]);

  async function copy(value: string, label: string) {
    if (!(await copyText(value))) {
      toast.error(tc("error"));
      return;
    }
    toast.success(`${label}: ${value}`);
  }

  return (
    <div className="space-y-4">
      <div className="glass rounded-2xl p-4">
        <label htmlFor={`${fieldId}-search`} className="block text-sm font-semibold">
          {tc("search")}
        </label>
        <input
          id={`${fieldId}-search`}
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={tc("search")}
          className={`${adminInputClass} mt-2 h-12`}
        />
      </div>

      {filtered.length === 0 ? (
        <EmptyState message={tc("noResults")} />
      ) : (
        <AdminTable
          caption={t("membersTitle")}
          headers={[
            "Member ID",
            t("profile"),
            t("name"),
            t("email"),
            t("level1"),
            t("teamSize"),
            t("actions"),
          ]}
        >
          {filtered.map((row) => {
            const l1 = row.levels.find((level) => level.level === 1);
            const l2 = row.levels.find((level) => level.level === 2);
            const l3 = row.levels.find((level) => level.level === 3);
            const tooltip = [
              `${t("level1")}: ${l1?.count ?? 0} ${t("teamMembers")} · ${t("earned")} ${l1?.earned ?? "0 SP"} · ${t("invested")} ${l1?.invested ?? "0 SP"}`,
              `${t("level2")}: ${l2?.count ?? 0} ${t("teamMembers")} · ${t("earned")} ${l2?.earned ?? "0 SP"} · ${t("invested")} ${l2?.invested ?? "0 SP"}`,
              `${t("level3")}: ${l3?.count ?? 0} ${t("teamMembers")} · ${t("earned")} ${l3?.earned ?? "0 SP"} · ${t("invested")} ${l3?.invested ?? "0 SP"}`,
            ].join("\n");
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
                  <span className="mt-1.5 block">
                    <StatusBadge
                      tone={statusTone(row.status)}
                      label={tm(memberStatusKey(row.status))}
                    />
                  </span>
                </td>

                <td className="px-4 py-3">
                  <MemberAvatar name={row.name} src={row.profileImage} />
                </td>

                <td className="min-w-[140px] px-4 py-3 font-semibold">
                  <Link
                    href={detailHref}
                    className="hover:text-primary focus-visible:rounded focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {row.name}
                  </Link>
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

                <td className="whitespace-nowrap px-4 py-3 text-center">
                  <span title={tooltip} className="inline-flex cursor-help items-center gap-1">
                    <span className="text-sm font-bold tabular-nums">{l1?.count ?? 0}</span>
                    <span className="text-xs text-muted-foreground">({l1?.earned ?? "0 SP"})</span>
                    <Info className="size-3 text-muted-foreground" aria-hidden="true" />
                  </span>
                </td>

                <td className="px-4 py-3 text-center text-sm font-bold tabular-nums">
                  {row.teamSize}
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
