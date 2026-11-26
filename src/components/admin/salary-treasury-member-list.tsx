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
import { InfinityText } from "@/components/ui/infinity-text";
import { MemberAvatar } from "./member-actions";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

export type SalaryTreasuryMemberView = {
  readonly entitlementId: string;
  readonly memberRecordId: string;
  readonly memberDisplayId: string;
  readonly memberName: string;
  readonly profileImageUrl: string | null;
  readonly weeksLabel: string;
  readonly amountLabel: string;
  readonly stateLabel: string;
  readonly stateTone: StatusTone;
};

export function SalaryTreasuryMemberList({
  members,
  labels,
}: {
  members: readonly SalaryTreasuryMemberView[];
  labels: {
    readonly search: string;
    readonly memberId: string;
    readonly memberName: string;
    readonly weeksPaid: string;
    readonly projected: string;
    readonly status: string;
    readonly noMatches: string;
    readonly empty: string;
  };
}) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return members;
    return members.filter((member) =>
      [
        member.memberName,
        member.memberDisplayId,
        member.weeksLabel,
        member.amountLabel,
        member.stateLabel,
      ].some((value) => value.toLowerCase().includes(needle)),
    );
  }, [members, query]);

  return (
    <div className="space-y-4">
      <div className="relative max-w-md">
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

      {filtered.length === 0 ? (
        <EmptyState
          message={members.length === 0 ? labels.empty : labels.noMatches}
        />
      ) : (
        <AdminTable
          caption={labels.memberName}
          headers={[
            labels.memberId,
            labels.memberName,
            labels.weeksPaid,
            labels.projected,
            labels.status,
          ]}
        >
          {filtered.map((member) => (
            <tr key={member.entitlementId} className="align-top">
              <td className="whitespace-nowrap px-4 py-3">
                <Link
                  href={`/admin/members/${member.memberDisplayId}`}
                  className="font-semibold text-primary hover:underline"
                >
                  {member.memberDisplayId}
                </Link>
              </td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-3">
                  <span aria-hidden="true" className="flex shrink-0">
                    <MemberAvatar
                      name={member.memberName}
                      src={member.profileImageUrl}
                      size="sm"
                    />
                  </span>
                  <span className="font-medium">{member.memberName}</span>
                </div>
              </td>
              <td className="whitespace-nowrap px-4 py-3 tabular-nums">
                <InfinityText value={member.weeksLabel} />
              </td>
              <td className="whitespace-nowrap px-4 py-3 font-semibold tabular-nums">
                {member.amountLabel}
              </td>
              <td className="whitespace-nowrap px-4 py-3">
                <StatusBadge tone={member.stateTone} label={member.stateLabel} />
              </td>
            </tr>
          ))}
        </AdminTable>
      )}
    </div>
  );
}
