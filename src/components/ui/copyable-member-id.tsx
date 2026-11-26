"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Copy } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { copyText } from "@/lib/clipboard";
import { cn } from "@/lib/utils";

/** Highlighted Member ID with a one-tap copy action. */
export function CopyableMemberId({
  memberId,
  compact = false,
  className,
}: {
  memberId: string;
  compact?: boolean;
  className?: string;
}) {
  const t = useTranslations("common");
  const [copied, setCopied] = useState(false);
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (resetTimer.current) clearTimeout(resetTimer.current);
    },
    [],
  );

  async function copy() {
    if (!(await copyText(memberId))) {
      toast.error(t("error"));
      return;
    }
    setCopied(true);
    toast.success(t("copied"));
    if (resetTimer.current) clearTimeout(resetTimer.current);
    resetTimer.current = setTimeout(() => setCopied(false), 1600);
  }

  return (
    <button
      type="button"
      onClick={copy}
      title={t("copyMemberId")}
      aria-label={`${t("copyMemberId")}: ${memberId}`}
      translate="no"
      className={cn(
        "inline-flex max-w-full items-center gap-1.5 rounded-lg bg-primary/10 px-2 py-1 font-mono font-bold text-primary ring-1 ring-primary/20 transition-colors hover:bg-primary/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        compact ? "text-xs" : "text-sm",
        className,
      )}
    >
      <span className="truncate">{memberId}</span>
      {copied ? (
        <Check className="size-3.5 shrink-0 text-emerald-500" aria-hidden="true" />
      ) : (
        <Copy className="size-3.5 shrink-0" aria-hidden="true" />
      )}
    </button>
  );
}
