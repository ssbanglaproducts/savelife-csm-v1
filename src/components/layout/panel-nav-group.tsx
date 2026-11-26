"use client";

import { useEffect, useId, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { PanelNavLink } from "./panel-nav-link";
import type { PanelLink } from "./panel-nav-types";

/** Expandable desktop navigation row with nested child links. */
export function PanelNavGroup({ item }: { item: PanelLink }) {
  const pathname = usePathname();
  const activePrefix = item.href.replace(/\/overview$/, "");
  const active = pathname === activePrefix || pathname.startsWith(`${activePrefix}/`);
  const [expanded, setExpanded] = useState(active);
  const wasActive = useRef(active);
  const groupId = useId();

  useEffect(() => {
    if (active && !wasActive.current) setExpanded(true);
    wasActive.current = active;
  }, [active]);

  const children = item.children ?? [];

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1">
        <div className="min-w-0 flex-1">
          <PanelNavLink
            href={item.href}
            label={item.label}
            locked={item.locked}
            badge={item.badge}
            activePrefix={activePrefix}
          />
        </div>
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          aria-expanded={expanded}
          aria-controls={expanded ? groupId : undefined}
          aria-label={item.toggleLabel ?? item.label}
          className="flex size-8 shrink-0 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ChevronDown
            className={cn("size-4 transition-transform", expanded && "rotate-180")}
            aria-hidden="true"
          />
        </button>
      </div>

      {expanded && children.length > 0 ? (
        <div id={groupId} className="ml-3 flex flex-col gap-0.5 border-l border-border pl-2">
          {children.map((child) => (
            <PanelNavLink
              key={child.href}
              href={child.href}
              label={child.label}
              locked={child.locked}
              badge={child.badge}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
