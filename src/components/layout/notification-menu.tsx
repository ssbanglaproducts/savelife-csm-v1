"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import {
  Bell,
  BellRing,
  Check,
  CircleAlert,
  Info,
  Megaphone,
  Package,
  ShieldCheck,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { buttonVariants } from "@/components/ui/button";
import type { NotificationDTO } from "@/lib/services/notifications";
import { cn } from "@/lib/utils";

type NotificationResponse = {
  notifications: NotificationDTO[];
  unreadCount: number;
};

async function loadNotifications(locale: string): Promise<NotificationResponse> {
  const response = await fetch(`/api/notifications?locale=${locale}`, {
    credentials: "same-origin",
  });
  if (!response.ok) throw new Error("Unable to load notifications");
  return response.json();
}

async function markRead(ids?: string[]): Promise<void> {
  const response = await fetch("/api/notifications", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify(ids ? { ids } : { all: true }),
  });
  if (!response.ok) throw new Error("Unable to update notifications");
}

function kindIcon(kind: NotificationDTO["kind"]) {
  switch (kind) {
    case "ALERT":
      return CircleAlert;
    case "WALLET":
      return Wallet;
    case "ORDER":
      return Package;
    case "INVESTMENT":
      return TrendingUp;
    case "SECURITY":
      return ShieldCheck;
    case "NOTICE":
      return Info;
    default:
      return Megaphone;
  }
}

function kindTone(kind: NotificationDTO["kind"]) {
  switch (kind) {
    case "ALERT":
      return "bg-destructive/10 text-destructive";
    case "WALLET":
      return "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400";
    case "ORDER":
      return "bg-sky-500/10 text-sky-600 dark:text-sky-400";
    case "INVESTMENT":
      return "bg-violet-500/10 text-violet-600 dark:text-violet-400";
    case "SECURITY":
      return "bg-amber-500/10 text-amber-600 dark:text-amber-400";
    default:
      return "bg-primary/10 text-primary";
  }
}

export function NotificationMenu() {
  const t = useTranslations("notifications");
  const locale = useLocale();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();

  const { data } = useQuery({
    queryKey: ["notifications", locale],
    queryFn: () => loadNotifications(locale),
    refetchInterval: 60_000,
  });

  const markMutation = useMutation({
    mutationFn: markRead,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["notifications", locale] });
      router.refresh();
    },
  });

  const close = useCallback(() => {
    setOpen(false);
    triggerRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, close]);

  const unreadCount = data?.unreadCount ?? 0;
  const label =
    unreadCount > 0
      ? t("openUnread", { count: unreadCount })
      : t("open");

  function handleItemClick(item: NotificationDTO) {
    markMutation.mutate([item.id]);
    setOpen(false);
    if (item.href) router.push(item.href);
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-label={label}
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        title={label}
        className={cn(
          buttonVariants({ variant: "ghost", size: "icon" }),
          "relative size-10 shrink-0 rounded-full [&_svg]:size-[18px]",
        )}
      >
        {unreadCount > 0 ? <BellRing aria-hidden="true" /> : <Bell aria-hidden="true" />}
        {unreadCount > 0 ? (
          <span
            aria-hidden="true"
            className="absolute -right-0.5 -top-0.5 flex min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold leading-4 text-destructive-foreground"
          >
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <div
          id={panelId}
          role="dialog"
          aria-label={t("title")}
          className="absolute right-0 z-[60] mt-3 w-[min(24rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-border bg-[var(--card-solid)] shadow-2xl animate-rise"
        >
          <div className="flex items-center gap-2 border-b border-border px-4 py-3">
            <div className="min-w-0 flex-1">
              <p className="font-display text-sm font-bold">{t("title")}</p>
              <p className="text-[11px] text-muted-foreground">
                {unreadCount > 0 ? t("unread", { count: unreadCount }) : t("allCaughtUp")}
              </p>
            </div>
            {unreadCount > 0 ? (
              <button
                type="button"
                onClick={() => markMutation.mutate(undefined)}
                disabled={markMutation.isPending}
                className={cn(
                  buttonVariants({ variant: "ghost", size: "sm" }),
                  "h-8 shrink-0 gap-1 px-2 text-[11px]",
                )}
              >
                <Check aria-hidden="true" className="size-3.5" />
                {t("markAllRead")}
              </button>
            ) : null}
          </div>

          <div className="max-h-[24rem] overflow-y-auto overscroll-contain">
            {!data || data.notifications.length === 0 ? (
              <div className="px-5 py-8 text-center">
                <Megaphone className="mx-auto size-7 text-muted-foreground" aria-hidden="true" />
                <p className="mt-3 text-sm font-semibold">{t("emptyTitle")}</p>
                <p className="mt-1 text-xs text-muted-foreground">{t("emptyBody")}</p>
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {data.notifications.map((item) => {
                  const Icon = kindIcon(item.kind);
                  return (
                    <li key={item.id}>
                      <button
                        type="button"
                        onClick={() => handleItemClick(item)}
                        className={cn(
                          "flex w-full gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none",
                          !item.read && "bg-primary/[0.04]",
                        )}
                      >
                        <span
                          className={cn(
                            "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-xl",
                            kindTone(item.kind),
                          )}
                        >
                          <Icon className="size-4" aria-hidden="true" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-2">
                            <span className="min-w-0 flex-1 truncate text-xs font-bold">
                              {item.title}
                            </span>
                            {!item.read ? (
                              <span
                                className="size-1.5 shrink-0 rounded-full bg-primary"
                                aria-label={t("unreadItem")}
                              />
                            ) : null}
                          </span>
                          <span className="mt-1 block line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                            {item.body}
                          </span>
                          <span className="mt-1.5 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                            {t(`kinds.${item.kind}`)}
                            <span aria-hidden="true">·</span>
                            {item.timeLabel}
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
