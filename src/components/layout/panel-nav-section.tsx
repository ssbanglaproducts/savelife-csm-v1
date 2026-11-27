"use client";

import { useCallback, useEffect, useId, useSyncExternalStore, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { useTranslations } from "next-intl";
import { usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

const SECTION_EVENT = "savelife:panel-section-change";

function useSectionCollapsed(storageKey: string) {
  const subscribe = useCallback((onChange: () => void) => {
    window.addEventListener(SECTION_EVENT, onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener(SECTION_EVENT, onChange);
      window.removeEventListener("storage", onChange);
    };
  }, []);

  const getSnapshot = useCallback(() => {
    try {
      return window.localStorage.getItem(storageKey) === "collapsed";
    } catch {
      // Storage may be unavailable (private browsing / restricted contexts).
      return false;
    }
  }, [storageKey]);

  // The server snapshot keeps hydration deterministic; the real value is read
  // immediately after hydration via useSyncExternalStore.
  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}

/** Collapsible section header for the fixed desktop panel navigation. */
export function PanelNavSection({
  label,
  hrefs,
  storageKey,
  children,
}: {
  label: string;
  hrefs: string[];
  storageKey: string;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const t = useTranslations("nav");
  const bodyId = useId();
  const collapsed = useSectionCollapsed(storageKey);
  const expanded = !collapsed;

  // Hydration uses the server snapshot (expanded). Notify the store once on
  // mount so any saved preference is applied without causing a mismatch.
  useEffect(() => {
    const frame = requestAnimationFrame(() => window.dispatchEvent(new Event(SECTION_EVENT)));
    return () => cancelAnimationFrame(frame);
  }, []);

  const active = hrefs.some((href) => pathname === href || pathname.startsWith(`${href}/`));

  function toggle() {
    try {
      window.localStorage.setItem(storageKey, expanded ? "collapsed" : "expanded");
    } catch {
      // Ignore storage failures; the event still updates in-memory state.
    }
    window.dispatchEvent(new Event(SECTION_EVENT));
  }

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={expanded}
        aria-controls={bodyId}
        aria-label={
          expanded ? t("collapseSection", { section: label }) : t("expandSection", { section: label })
        }
        className={cn(
          "group flex w-full items-center justify-between gap-2 rounded-lg px-3 py-1.5 text-left text-[10px] font-bold uppercase tracking-[0.14em] transition-colors duration-200 hover:bg-accent/60 focus-visible:ring-2 focus-visible:ring-ring",
          active ? "text-foreground" : "text-muted-foreground/80 hover:text-foreground",
        )}
      >
        <span className="truncate">{label}</span>
        <ChevronDown
          className={cn(
            "size-3.5 shrink-0 transition-[transform,color] duration-200 group-hover:text-foreground",
            expanded ? "rotate-180" : "rotate-0",
            active ? "text-primary" : "text-muted-foreground/60",
          )}
          aria-hidden="true"
        />
      </button>

      <div
        id={bodyId}
        inert={!expanded}
        className={cn(
          "grid transition-[grid-template-rows,opacity] duration-200 ease-out motion-reduce:transition-none",
          expanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
        )}
      >
        <div className="overflow-hidden">
          <div className="flex flex-col gap-1 px-1 pb-0.5">{children}</div>
        </div>
      </div>
    </div>
  );
}
