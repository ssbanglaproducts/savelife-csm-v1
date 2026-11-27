"use client";

import { useId, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { AdminTable, EmptyState, adminInputClass } from "./admin-ui";

export type AuditRow = {
  id: string;
  actor: string;
  action: string;
  entity: string;
  createdAt: string;
  before: string;
  after: string;
};

export function AuditTable({ rows }: { rows: AuditRow[] }) {
  const t = useTranslations("adminPanel");
  const tc = useTranslations("common");
  const fieldId = useId();
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter((row) => row.action.toLowerCase().includes(needle));
  }, [query, rows]);

  return (
    <div className="space-y-4">
      <div className="glass rounded-2xl p-4">
        <label htmlFor={`${fieldId}-action`} className="block text-sm font-semibold">
          {`${tc("filter")} · ${t("action")}`}
        </label>
        <input
          id={`${fieldId}-action`}
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t("action")}
          className={`${adminInputClass} mt-2 h-12`}
        />
      </div>

      {filtered.length === 0 ? (
        <EmptyState message={rows.length === 0 ? t("noActivity") : tc("noResults")} />
      ) : (
        <AdminTable
          caption={t("auditTitle")}
          headers={[
            t("actor"),
            t("action"),
            t("entity"),
            t("createdAt"),
            t("before"),
            t("after"),
          ]}
        >
          {filtered.map((row) => (
            <tr key={row.id} className="align-top">
              <td className="min-w-[140px] px-4 py-3 font-semibold">{row.actor}</td>
              <td className="whitespace-nowrap px-4 py-3 font-mono text-xs">{row.action}</td>
              <td className="min-w-[160px] break-words px-4 py-3 text-xs">{row.entity}</td>
              <td className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground">
                {row.createdAt}
              </td>
              <td className="px-4 py-3">
                <pre className="max-w-[260px] overflow-x-auto whitespace-pre-wrap break-words font-mono text-xs text-muted-foreground">
                  {row.before}
                </pre>
              </td>
              <td className="px-4 py-3">
                <pre className="max-w-[260px] overflow-x-auto whitespace-pre-wrap break-words font-mono text-xs text-muted-foreground">
                  {row.after}
                </pre>
              </td>
            </tr>
          ))}
        </AdminTable>
      )}
    </div>
  );
}
