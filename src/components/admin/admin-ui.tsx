import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

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
  return (
    <section className="mesh glass relative hidden overflow-hidden rounded-2xl p-4 sm:block sm:rounded-3xl sm:p-8">
      <div
        className="pointer-events-none absolute -right-20 -top-24 size-64 rounded-full bg-primary/10 blur-3xl"
        aria-hidden="true"
      />
      <div className="relative min-w-0">
        <div className="flex items-center gap-2 text-[11px] font-bold tracking-[0.12em] text-primary sm:text-xs">
          {icon}
          {eyebrow}
        </div>
        <div className="mt-2 flex min-w-0 flex-col gap-3 sm:mt-3 sm:flex-row sm:items-center sm:justify-between sm:gap-8">
          <h1 className="font-display text-balance text-2xl font-bold leading-tight tracking-tight sm:text-4xl">
            {title}
          </h1>
          {actions ? (
            <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
          ) : null}
        </div>
        {intro ? (
          <p className="mt-2 max-w-2xl text-xs leading-relaxed text-muted-foreground sm:mt-3 sm:text-base">
            {intro}
          </p>
        ) : null}
      </div>
    </section>
  );
}

export function AdminSection({
  id,
  title,
  actions,
  children,
}: {
  id: string;
  title: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section aria-labelledby={`${id}-heading`} className="scroll-mt-24 space-y-3 sm:space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h2
          id={`${id}-heading`}
          className="font-display text-lg font-bold tracking-tight sm:text-2xl"
        >
          {title}
        </h2>
        <span className="h-px min-w-4 flex-1 bg-border" aria-hidden="true" />
        {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
      </div>
      {children}
    </section>
  );
}

/** Desktop table with an optional mobile card replacement supplied by the page. */
export function AdminTable({
  headers,
  children,
  caption,
  mobile,
}: {
  headers: string[];
  children: ReactNode;
  caption?: string;
  mobile?: ReactNode;
}) {
  return (
    <>
      <div className={cn("glass min-w-0 overflow-hidden rounded-2xl", mobile && "hidden md:block")}>
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
      {mobile ? <div className="min-w-0 md:hidden">{mobile}</div> : null}
    </>
  );
}

/** Compact mobile record card used as the counterpart to AdminTable. */
export function AdminRecordCard({
  title,
  subtitle,
  status,
  children,
  footer,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  status?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <article className="glass relative min-w-0 overflow-hidden rounded-2xl p-4">
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate font-display text-base font-semibold">{title}</div>
          {subtitle ? (
            <div className="mt-1 truncate text-xs text-muted-foreground">{subtitle}</div>
          ) : null}
        </div>
        {status ? <div className="shrink-0">{status}</div> : null}
      </div>
      {children ? (
        <dl className="mt-4 grid grid-cols-2 gap-x-3 gap-y-3 text-xs">{children}</dl>
      ) : null}
      {footer ? <div className="mt-4 border-t border-border pt-3">{footer}</div> : null}
    </article>
  );
}

export function AdminRecordField({
  label,
  value,
  wide = false,
}: {
  label: string;
  value: ReactNode;
  wide?: boolean;
}) {
  return (
    <div className={cn("min-w-0", wide && "col-span-2")}>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 break-words font-semibold tabular-nums">{value}</dd>
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
