"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { Check, ChevronDown, CopyPlus, LayoutDashboard, Loader2, X } from "lucide-react";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import { CopyableMemberId } from "@/components/ui/copyable-member-id";
import { UserAvatar } from "@/components/ui/user-avatar";
import { TeamCloneDialog } from "@/components/member/team-clone-dialog";
import type { Viewer } from "@/lib/viewer";
import { cn } from "@/lib/utils";
import { SignOutConfirmDialog } from "./sign-out-confirm-dialog";

/**
 * Signed-in identity control. The trigger shows the avatar (with the name on
 * desktop only for the storefront); the dialog carries the name, Member ID and
 * the actions that were previously spread across the header.
 */
export function ProfileMenu({
  viewer,
  showName = false,
  panel = false,
  header = false,
}: {
  viewer: Viewer;
  showName?: boolean;
  panel?: boolean;
  header?: boolean;
}) {
  const t = useTranslations("nav");
  const tm = useTranslations("memberPanel");
  const pathname = usePathname();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [switchOpen, setSwitchOpen] = useState(false);
  const [switchingId, setSwitchingId] = useState<string | null>(null);
  const [switchError, setSwitchError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [cloneOpen, setCloneOpen] = useState(false);
  const [lastPathname, setLastPathname] = useState(pathname);
  const dialogId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const restoreFocusRef = useRef(false);

  if (pathname !== lastPathname) {
    setLastPathname(pathname);
    setOpen(false);
    setSwitchOpen(false);
  }

  const close = useCallback((restoreFocus = true) => {
    restoreFocusRef.current = restoreFocus;
    setOpen(false);
    setSwitchOpen(false);
  }, []);

  useEffect(() => {
    if (!open) {
      if (restoreFocusRef.current) {
        restoreFocusRef.current = false;
        triggerRef.current?.focus();
      }
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialogRef.current?.querySelector<HTMLElement>("[data-profile-autofocus]")?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        close();
        return;
      }
      if (event.key !== "Tab") return;

      const focusables = dialogRef.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled])',
      );
      if (!focusables?.length) return;

      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, close]);

  type OwnedAccount = {
    id: string;
    memberId: string;
    name: string;
    image: string | null;
    role: "MEMBER" | "ADMIN";
    status: "INACTIVE" | "ACTIVE" | "SUSPENDED";
    current: boolean;
  };

  const accountsQuery = useQuery({
    queryKey: ["me-accounts"],
    queryFn: async (): Promise<OwnedAccount[]> => {
      const response = await fetch("/api/me/accounts", { cache: "no-store" });
      if (!response.ok) throw new Error("Unable to load accounts");
      const data = (await response.json()) as { accounts: OwnedAccount[] };
      return data.accounts;
    },
    enabled: open && switchOpen,
    staleTime: 30_000,
  });

  async function switchAccount(memberId: string) {
    setSwitchError(null);
    setSwitchingId(memberId);
    try {
      const response = await fetch("/api/me/accounts/switch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberId }),
      });
      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        setSwitchError(t("switchFailed"));
        if (data.error === "ACCOUNT_NOT_OWNED") setSwitchError(t("accountNotOwned"));
        return;
      }
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["viewer"] }),
        queryClient.invalidateQueries({ queryKey: ["cart-count"] }),
        queryClient.invalidateQueries({ queryKey: ["notifications"] }),
        queryClient.invalidateQueries({ queryKey: ["me-accounts"] }),
      ]);
      close(false);
      router.refresh();
    } catch {
      setSwitchError(t("switchFailed"));
    } finally {
      setSwitchingId(null);
    }
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? dialogId : undefined}
        aria-label={t("account")}
        title={header ? viewer.name : undefined}
        className={cn(
          "flex min-w-0 items-center gap-2 rounded-xl p-1 text-left transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          panel
            ? "size-11 justify-center p-0 md:hidden"
            : header
              ? "rounded-full border border-border bg-[var(--glass-strong)] py-1 pl-1 pr-2.5 shadow-sm hover:border-primary/50"
              : "sm:p-1.5",
        )}
      >
        <UserAvatar
          name={viewer.name}
          src={viewer.image}
          className={cn(
            "size-9 shrink-0 rounded-full",
            panel && "size-10",
            header && "size-8 ring-2 ring-primary/20",
          )}
          textClassName="text-[11px]"
        />
        {header ? (
          <span className="hidden min-w-0 text-left lg:block">
            <span className="block text-[10px] font-bold tracking-[0.08em] text-muted-foreground">
              {t("account")}
            </span>
            <span className="block max-w-24 truncate text-sm font-semibold leading-tight">
              {viewer.name}
            </span>
          </span>
        ) : showName ? (
          <span className="hidden min-w-0 sm:block">
            <span className="block max-w-48 truncate text-sm font-semibold leading-tight">
              {viewer.name}
            </span>
            <span className="block text-[10px] leading-tight text-muted-foreground">
              {viewer.memberId}
            </span>
          </span>
        ) : null}
        {!panel ? (
          <ChevronDown
            className={cn(
              "hidden size-3.5 shrink-0 text-muted-foreground sm:block",
              header && "ml-0.5 text-primary",
            )}
            aria-hidden="true"
          />
        ) : null}
      </button>

      {/* Portal to the body: the header's backdrop blur creates a containing
          block for fixed children, which would otherwise trap this overlay in
          the header and leave clicks outside it unable to close the menu. */}
      {open && typeof document !== "undefined"
        ? createPortal(
            <div className="fixed inset-0 z-[70]">
              <button
                type="button"
                tabIndex={-1}
                aria-label={t("closeMenu")}
                onClick={() => close()}
                className="absolute inset-0 size-full cursor-default"
              />

              <div
                ref={dialogRef}
                id={dialogId}
                role="dialog"
                aria-modal="true"
                aria-labelledby={`${dialogId}-title`}
                className="absolute inset-x-4 top-[calc(72px+env(safe-area-inset-top))] mx-auto max-w-sm rounded-3xl border border-border bg-[var(--card-solid)] p-2 shadow-2xl sm:left-auto sm:right-4 sm:inset-x-auto sm:top-[calc(80px+env(safe-area-inset-top))]"
              >
                <div className="flex items-center gap-3 rounded-2xl bg-muted/40 p-3">
                  <UserAvatar
                    name={viewer.name}
                    src={viewer.image}
                    className="size-12 rounded-full"
                  />
                  <div className="min-w-0 flex-1">
                    <p id={`${dialogId}-title`} className="truncate font-display font-bold">
                      {viewer.name}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      <span className="text-xs text-muted-foreground">{t("memberId")}</span>
                      <CopyableMemberId memberId={viewer.memberId} compact />
                    </div>
                  </div>
                  <button
                    type="button"
                    data-profile-autofocus
                    onClick={() => close()}
                    aria-label={t("closeMenu")}
                    className="flex size-9 shrink-0 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <X className="size-4" aria-hidden="true" />
                  </button>
                </div>

                <Link
                  href={viewer.role === "ADMIN" ? "/admin/dashboard" : "/member/dashboard"}
                  onClick={() => close(false)}
                  className="mt-1 flex min-h-11 w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <LayoutDashboard className="size-4 shrink-0 text-primary" aria-hidden="true" />
                  {t("goToDashboard")}
                </Link>

                {viewer.role !== "ADMIN" ? (
                  <button
                    type="button"
                    onClick={() => {
                      close(false);
                      setCloneOpen(true);
                    }}
                    className="mt-1 flex min-h-11 w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <CopyPlus className="size-4 shrink-0 text-primary" aria-hidden="true" />
                    {tm("teamCloneAccount")}
                  </button>
                ) : null}

                <section aria-label={t("switchAccount")} className="mt-2 border-t border-border pt-2">
                  <button
                    type="button"
                    onClick={() => setSwitchOpen((current) => !current)}
                    aria-expanded={switchOpen}
                    aria-controls={`${dialogId}-accounts`}
                    className="flex min-h-11 w-full items-center justify-between gap-3 rounded-xl px-3 py-1.5 text-left text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {t("switchAccount")}
                    <ChevronDown
                      className={cn("size-4 shrink-0 transition-transform", switchOpen && "rotate-180")}
                      aria-hidden="true"
                    />
                  </button>
                  {switchOpen ? (
                    <div id={`${dialogId}-accounts`}>
                      {accountsQuery.isLoading ? (
                        <div className="flex min-h-11 items-center gap-3 px-3 text-sm text-muted-foreground">
                          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                          {t("loadingAccounts")}
                        </div>
                      ) : null}
                      {accountsQuery.data?.map((account) => (
                        <button
                          key={account.id}
                          type="button"
                          disabled={switchingId !== null || account.current}
                          aria-current={account.current ? "true" : undefined}
                          onClick={() => void switchAccount(account.memberId)}
                          className="flex min-h-14 w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
                        >
                          <UserAvatar
                            name={account.name}
                            src={account.image}
                            className="size-9 shrink-0 rounded-full"
                            textClassName="text-[11px]"
                          />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-semibold">{account.name}</span>
                            <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
                              <span className="font-mono" translate="no">
                                {account.memberId}
                              </span>
                              <span>
                                {account.status === "ACTIVE"
                                  ? tm("active")
                                  : account.status === "SUSPENDED"
                                    ? tm("suspended")
                                    : tm("inactive")}
                              </span>
                            </span>
                          </span>
                          {switchingId === account.memberId ? (
                            <Loader2 className="size-4 shrink-0 animate-spin text-primary" aria-hidden="true" />
                          ) : account.current ? (
                            <Check className="size-4 shrink-0 text-primary" aria-label={t("currentAccount")} />
                          ) : null}
                        </button>
                      ))}
                      {switchError ? (
                        <p
                          role="alert"
                          className="mx-2 mt-1 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-600 dark:text-red-300"
                        >
                          {switchError}
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                </section>

                <button
                  type="button"
                  onClick={() => {
                    close(false);
                    setConfirming(true);
                  }}
                  className="mt-1 flex min-h-11 w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold text-red-600 transition-colors hover:bg-red-500/15 hover:text-red-600 focus-visible:ring-2 focus-visible:ring-red-500/50 dark:text-red-400 dark:hover:text-red-300"
                >
                  <span className="flex size-4 shrink-0 items-center justify-center" aria-hidden="true">
                    <span className="size-2 rounded-full bg-red-500" />
                  </span>
                  {t("logout")}
                </button>
              </div>
            </div>,
            document.body,
          )
        : null}

      {cloneOpen ? (
        <TeamCloneDialog
          viewerMemberId={viewer.memberId}
          onClose={() => setCloneOpen(false)}
          onSuccess={() => router.refresh()}
        />
      ) : null}

      <SignOutConfirmDialog
        open={confirming}
        onCancel={() => {
          setConfirming(false);
          triggerRef.current?.focus();
        }}
      />
    </>
  );
}
