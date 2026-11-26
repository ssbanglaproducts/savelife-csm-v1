"use client";

import { useEffect, useRef, useState, type KeyboardEvent, type MouseEvent } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

function legacyCopy(value: string): boolean {
  const input = document.createElement("textarea");
  input.value = value;
  input.setAttribute("readonly", "");
  input.style.position = "fixed";
  input.style.top = "-1000px";
  input.style.opacity = "0";
  document.body.appendChild(input);
  input.select();
  try {
    return document.execCommand("copy");
  } catch {
    return false;
  } finally {
    input.remove();
  }
}

/** Member ID that copies itself on click or keyboard activation. */
export function CopyableMemberId({
  memberId,
  className,
  textClassName,
  centered = false,
}: {
  memberId: string;
  className?: string;
  textClassName?: string;
  centered?: boolean;
}) {
  const t = useTranslations("common");
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  async function copy(event: MouseEvent<HTMLSpanElement> | KeyboardEvent<HTMLSpanElement>) {
    event.preventDefault();
    event.stopPropagation();

    let copiedSuccessfully = false;
    try {
      await navigator.clipboard.writeText(memberId);
      copiedSuccessfully = true;
    } catch {
      copiedSuccessfully = legacyCopy(memberId);
    }

    if (!copiedSuccessfully) return;
    setCopied(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), 1400);
  }

  return (
    <span
      role="button"
      tabIndex={0}
      aria-label={`${t("copyMemberId")} ${memberId}`}
      title={copied ? t("copied") : t("copyMemberId")}
      translate="no"
      onClick={(event) => void copy(event)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") void copy(event);
      }}
      className={cn(
        "inline-flex max-w-full cursor-pointer items-center gap-1 rounded-md font-mono text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        centered && "justify-center text-center",
        className,
      )}
    >
      <span className={cn("truncate", textClassName)}>{memberId}</span>
    </span>
  );
}
