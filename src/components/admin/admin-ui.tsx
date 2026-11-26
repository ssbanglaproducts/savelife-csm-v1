import type { ReactNode } from "react";

export const adminInputClass =
  "h-10 w-full min-w-0 rounded-xl border border-border bg-[var(--glass-strong)] px-3 text-sm outline-none transition-colors placeholder:text-muted-foreground/60 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";
export const adminLabelClass = "block text-sm font-semibold";

export function AdminPageIntro({
  eyebrow,
  title,
  intro,
  icon,
  actions,
}: {
  eyebrow: string;
  title: string;
  intro?: string;
  icon?: ReactNode;
  actions?: ReactNode;
}) {
  const actionRow = actions ? (
    <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
  ) : null;
  const mobileActionRow = actions ? (
    <div className="flex flex-wrap items-center gap-2 sm:hidden">{actions}</div>
  ) : null;

  return (
    <>
      <h1 className="sr-only sm:hidden">{title}</h1>
      <div className={actions ? undefined : "hidden sm:block"}>
        <section className="mesh glass relative hidden overflow-hidden rounded-3xl p-6 sm:block sm:p-8">
          <div
            className="pointer-events-none absolute -right-20 -top-24 size-64 rounded-full bg-primary/10 blur-3xl"
            aria-hidden="true"
          />
          <div className="relative flex min-w-0 flex-col gap-5 sm:flex-row sm:items-end sm:justify-between sm:gap-8">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-xs font-bold tracking-[0.12em] text-primary">
                {icon}
                {eyebrow}
              </div>
              <h1 className="mt-3 font-display text-balance text-3xl font-bold leading-tight tracking-tight sm:text-4xl">
                {title}
              </h1>
              {intro ? (
                <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
                  {intro}
                </p>
              ) : null}
            </div>
            {actionRow}
          </div>
        </section>
        {mobileActionRow}
      </div>
    </>
  );
}

export function AdminSection({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section aria-labelledby={`${id}-heading`} className="space-y-4">
      <div className="flex items-center gap-3">
        <h2 id={`${id}-heading`} className="font-display text-xl font-bold tracking-tight sm:text-2xl">
          {title}
        </h2>
        <span className="h-px flex-1 bg-border" aria-hidden="true" />
      </div>
      {children}
    </section>
  );
}

export function AdminTable({
  headers,
  children,
  caption,
}: {
  headers: string[];
  children: ReactNode;
  caption?: string;
}) {
  return (
    <div className="glass min-w-0 overflow-hidden rounded-2xl">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] border-collapse text-left text-sm">
          {caption ? <caption className="sr-only">{caption}</caption> : null}
          <thead>
            <tr className="border-b border-border text-xs font-bold uppercase tracking-wider text-muted-foreground">
              {headers.map((header, index) => (
                <th key={`${header}-${index}`} scope="col" className="whitespace-nowrap px-4 py-3">
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">{children}</tbody>
        </table>
      </div>
    </div>
  );
}

export function EmptyState({ message }: { message: string }) {
  return (
    <p className="glass rounded-2xl px-5 py-10 text-center text-sm text-muted-foreground">
      {message}
    </p>
  );
}

export type StatusTone = "success" | "warning" | "danger" | "neutral";
export type AdminStatusKey =
  | "pending"
  | "approved"
  | "rejected"
  | "paid"
  | "completed"
  | "processing"
  | "cancelled"
  | "returned";
export type MemberStatusKey = "active" | "inactive" | "suspended";

export function adminStatusKey(status: string): AdminStatusKey {
  switch (status) {
    case "PENDING":
    case "DRAFT":
      return "pending";
    case "CONFIRMED":
    case "APPROVED":
      return "approved";
    case "PROCESSING":
    case "SHIPPED":
    case "OUT_FOR_DELIVERY":
      return "processing";
    case "DELIVERED":
    case "PICKED_UP":
    case "MATURED":
    case "CLOSED":
    case "POSTED":
      return "completed";
    case "CANCELLED":
      return "cancelled";
    case "RETURNED":
      return "returned";
    case "REJECTED":
    case "REVERSED":
      return "rejected";
    case "PAID":
      return "paid";
    default:
      return "pending";
  }
}

export function memberStatusKey(status: string): MemberStatusKey {
  if (status === "ACTIVE") return "active";
  if (status === "SUSPENDED") return "suspended";
  return "inactive";
}

export function statusTone(status: string): StatusTone {
  if (["ACTIVE", "APPROVED", "PAID", "DELIVERED", "PICKED_UP", "POSTED", "MATURED"].includes(status)) {
    return "success";
  }
  if (["PENDING", "CONFIRMED", "PROCESSING", "SHIPPED", "OUT_FOR_DELIVERY", "DRAFT"].includes(status)) {
    return "warning";
  }
  if (["REJECTED", "CANCELLED", "RETURNED", "REVERSED", "SUSPENDED"].includes(status)) {
    return "danger";
  }
  return "neutral";
}

export function StatusBadge({ tone, label }: { tone: StatusTone; label: string }) {
  const toneClass = {
    success: "bg-primary/15 text-primary ring-primary/30",
    warning: "bg-amber-500/15 text-amber-700 ring-amber-500/30 dark:text-amber-300",
    danger: "bg-red-500/15 text-red-600 ring-red-500/30 dark:text-red-300",
    neutral: "bg-muted text-muted-foreground ring-border",
  }[tone];

  return (
    <span
      className={`inline-flex items-center self-center whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${toneClass}`}
    >
      {label}
    </span>
  );
}

export function formatDate(value: Date, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value);
}

export function prettyJson(value: unknown): string {
  if (value === null || value === undefined) return "—";
  try {
    return JSON.stringify(value, null, 2) ?? "—";
  } catch {
    return String(value);
  }
}
