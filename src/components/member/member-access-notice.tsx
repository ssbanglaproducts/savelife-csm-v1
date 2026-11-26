"use client";

import { useId } from "react";
import { useTranslations } from "next-intl";
import { LockKeyhole, ShieldAlert } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { ActivationGuidanceContent } from "@/components/member/activation-guidance";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type RestrictedMemberStatus = "INACTIVE" | "SUSPENDED";

export function MemberAccessNotice({
  status,
  note,
  availablePaisa = "0",
}: {
  status: RestrictedMemberStatus;
  note?: string | null;
  availablePaisa?: string;
}) {
  const t = useTranslations("memberPanel");
  const tn = useTranslations("nav");
  const titleId = useId();
  const suspended = status === "SUSPENDED";

  return (
    <section
      role="alert"
      aria-labelledby={titleId}
      style={
        suspended
          ? { borderColor: "rgba(245, 158, 11, 0.38)" }
          : {
              borderColor: "rgba(244, 63, 94, 0.38)",
              backgroundImage:
                "linear-gradient(110deg, rgba(251,113,133,0.14) 0%, rgba(244,63,94,0.05) 52%, transparent 82%)",
            }
      }
      className="glass relative w-full max-w-2xl rounded-3xl border p-6 text-left shadow-2xl animate-rise sm:p-8"
    >
      <div
        aria-hidden="true"
        className={cn(
          "absolute inset-x-6 top-0 h-px",
          suspended ? "bg-amber-400/50" : "bg-rose-400/50",
        )}
      />

      <div className="flex min-w-0 items-start gap-4">
        <div
          className={cn(
            "flex size-12 shrink-0 items-center justify-center rounded-2xl",
            suspended ? "bg-amber-500/10 text-amber-500" : "bg-rose-500/10 text-rose-500",
          )}
        >
          {suspended ? (
            <ShieldAlert className="size-6" aria-hidden="true" />
          ) : (
            <LockKeyhole className="size-6" aria-hidden="true" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
            {suspended ? t("suspended") : t("inactive")}
          </p>
          <h1
            id={titleId}
            className="mt-1 break-words font-display text-2xl font-bold tracking-tight"
          >
            {suspended ? t("accountLockedTitle") : t("accountPendingTitle")}
          </h1>
          <p className="mt-2 break-words text-sm leading-relaxed text-muted-foreground">
            {suspended ? t("accountLockedIntro") : t("accountPendingIntro")}
          </p>
        </div>
      </div>

      {suspended ? (
        <div className="mt-6 rounded-2xl border border-amber-500/30 bg-amber-500/5 px-4 py-4 text-left">
          <p className="text-xs font-bold tracking-[0.12em] text-amber-500">
            {t("accountLockedNoteLabel")}
          </p>
          <p className="mt-2 whitespace-pre-wrap break-words text-sm font-medium">
            {note?.trim() || t("accountLockedNoNote")}
          </p>
        </div>
      ) : (
        <div className="mt-6 rounded-2xl border border-border/60 bg-background/40 p-4 text-left sm:p-5">
          <ActivationGuidanceContent availablePaisa={BigInt(availablePaisa || "0")} />
        </div>
      )}

      <div className="mt-6 flex flex-wrap gap-2">
        <Link href="/member/dashboard" className={cn(buttonVariants(), "min-w-32")}>
          {tn("dashboard")}
        </Link>
        {!suspended ? (
          <Link
            href="/member/profile"
            className={cn(buttonVariants({ variant: "outline" }), "min-w-32")}
          >
            {tn("profile")}
          </Link>
        ) : null}
      </div>

      <p className="mt-5 break-words text-xs text-muted-foreground">
        {suspended ? t("accountLockedFootnote") : t("accountPendingFootnote")}
      </p>
    </section>
  );
}
