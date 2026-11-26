"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import {
  AdminTable,
  EmptyState,
  StatusBadge,
  adminInputClass,
  type StatusTone,
} from "@/components/admin/admin-ui";
import { MemberAvatar } from "@/components/admin/member-actions";
import { Link } from "@/i18n/navigation";
import { SALARY_RANK_KEYS, type SalaryRankKey } from "@/lib/salary";
import { cn } from "@/lib/utils";

export type SalaryPaymentRecordView = {
  readonly id: string;
  readonly memberDisplayId: string;
  readonly memberName: string;
  readonly profileImageUrl: string | null;
  readonly rankKey: string;
  readonly rankName: string;
  readonly amountLabel: string;
  readonly weekLabel: string;
  readonly weekDateKey: string;
  readonly weekNumberLabel: string;
  readonly paidLabel: string;
  readonly paidDateKey: string;
  readonly status: "SUCCESS" | "FAILED";
  readonly statusLabel: string;
  readonly statusTone: StatusTone;
  readonly distributionHref: string;
  readonly distributionLabel: string;
};

type RankFilter = "ALL" | SalaryRankKey;
type StatusFilter = "ALL" | "SUCCESS" | "FAILED";

export function SalaryPaymentRecordsList({
  records,
  labels,
}: {
  records: readonly SalaryPaymentRecordView[];
  labels: {
    readonly search: string;
    readonly rank: string;
    readonly allRanks: string;
    readonly status: string;
    readonly allStatuses: string;
    readonly statusSuccess: string;
    readonly statusFailed: string;
    readonly weekEnding: string;
    readonly paidDate: string;
    readonly member: string;
    readonly amount: string;
    readonly weekNumber: string;
    readonly distribution: string;
    readonly viewDistribution: string;
    readonly noMatches: string;
    readonly empty: string;
  };
}) {
  const [query, setQuery] = useState("");
  const [rankFilter, setRankFilter] = useState<RankFilter>("ALL");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [weekDate, setWeekDate] = useState("");
  const [paidDate, setPaidDate] = useState("");

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return records.filter((record) => {
      if (rankFilter !== "ALL" && record.rankKey !== rankFilter) return false;
      if (statusFilter !== "ALL" && record.status !== statusFilter) return false;
      if (weekDate && record.weekDateKey !== weekDate) return false;
      if (paidDate && record.paidDateKey !== paidDate) return false;
      if (!needle) return true;
      return [
        record.memberDisplayId,
        record.memberName,
        record.rankName,
        record.amountLabel,
        record.weekLabel,
        record.weekNumberLabel,
        record.paidLabel,
        record.statusLabel,
      ].some((value) => value.toLowerCase().includes(needle));
    });
  }, [records, query, rankFilter, statusFilter, weekDate, paidDate]);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="relative sm:col-span-2 xl:col-span-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={labels.search}
            aria-label={labels.search}
            className={cn(adminInputClass, "pl-9")}
          />
        </div>
        <select
          value={rankFilter}
          onChange={(event) => setRankFilter(event.target.value as RankFilter)}
          aria-label={labels.rank}
          className={adminInputClass}
        >
          <option value="ALL">{labels.allRanks}</option>
          {SALARY_RANK_KEYS.map((rankKey) => (
            <option key={rankKey} value={rankKey}>
              {rankKey}
            </option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
          aria-label={labels.status}
          className={adminInputClass}
        >
          <option value="ALL">{labels.allStatuses}</option>
          <option value="SUCCESS">{labels.statusSuccess}</option>
          <option value="FAILED">{labels.statusFailed}</option>
        </select>
        <div className="grid grid-cols-2 gap-3 xl:col-span-1">
          <input
            type="date"
            value={weekDate}
            onChange={(event) => setWeekDate(event.target.value)}
            aria-label={labels.weekEnding}
            className={cn(adminInputClass, "px-2 text-xs")}
          />
          <input
            type="date"
            value={paidDate}
            onChange={(event) => setPaidDate(event.target.value)}
            aria-label={labels.paidDate}
            className={cn(adminInputClass, "px-2 text-xs")}
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState message={records.length === 0 ? labels.empty : labels.noMatches} />
      ) : (
        <AdminTable
          caption={labels.member}
          headers={[
            labels.member,
            labels.rank,
            labels.amount,
            labels.weekEnding,
            labels.weekNumber,
            labels.paidDate,
            labels.status,
            labels.distribution,
          ]}
        >
          {filtered.map((record) => (
            <tr key={record.id} className="align-top">
              <td className="px-4 py-3">
                <div className="flex items-center gap-3">
                  <span aria-hidden="true" className="flex shrink-0">
                    <MemberAvatar
                      name={record.memberName}
                      src={record.profileImageUrl}
                      size="sm"
                    />
                  </span>
                  <div className="min-w-0">
                    <Link
                      href={`/admin/members/${record.memberDisplayId}`}
                      className="font-semibold text-primary hover:underline"
                    >
                      {record.memberDisplayId}
                    </Link>
                    <p className="truncate text-xs text-muted-foreground">{record.memberName}</p>
                  </div>
                </div>
              </td>
              <td className="whitespace-nowrap px-4 py-3 font-semibold">{record.rankName}</td>
              <td className="whitespace-nowrap px-4 py-3 font-semibold tabular-nums">
                {record.amountLabel}
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground">
                {record.weekLabel}
              </td>
              <td className="whitespace-nowrap px-4 py-3 tabular-nums">
                {record.weekNumberLabel}
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground">
                {record.paidLabel}
              </td>
              <td className="whitespace-nowrap px-4 py-3">
                <StatusBadge tone={record.statusTone} label={record.statusLabel} />
              </td>
              <td className="whitespace-nowrap px-4 py-3">
                <Link
                  href={record.distributionHref}
                  className="text-xs font-semibold text-primary hover:underline"
                  aria-label={labels.viewDistribution}
                >
                  {record.distributionLabel}
                </Link>
              </td>
            </tr>
          ))}
        </AdminTable>
      )}
    </div>
  );
}
