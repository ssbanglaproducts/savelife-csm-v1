import type { ReactNode } from "react";
import { getTranslations } from "next-intl/server";
import type { Viewer } from "@/lib/viewer";
import { PanelNavGroup } from "./panel-nav-group";
import { PanelNavLink } from "./panel-nav-link";
import type { PanelLink } from "./panel-nav-types";
import { PanelChrome } from "./panel-chrome";

export async function PanelShell({
  title,
  links,
  primaryHrefs,
  avatar,
  children,
}: {
  title?: string;
  links: PanelLink[];
  primaryHrefs: string[];
  avatar?: Viewer;
  children: ReactNode;
}) {
  const t = await getTranslations("nav");

  const groups: Array<{ label: string | null; links: PanelLink[] }> = [];
  for (const item of links) {
    const label = item.group ?? null;
    const current = groups[groups.length - 1];
    if (current && current.label === label) {
      current.links.push(item);
    } else {
      groups.push({ label, links: [item] });
    }
  }

  return (
    <PanelChrome
      title={title}
      avatar={avatar}
      links={links}
      primaryHrefs={primaryHrefs}
      desktopNav={
        <nav aria-label={t("sections")} className="w-full">
          <p className="border-b border-border px-3 py-3 text-xs font-bold tracking-[0.12em] text-muted-foreground">
            {t("sections")}
          </p>
          <div className="flex flex-col gap-1 p-2">
            {groups.map((group, groupIndex) => (
              <div
                key={`${group.label ?? "links"}-${groupIndex}`}
                className={groupIndex === 0 ? "flex flex-col gap-1" : "mt-2 flex flex-col gap-1"}
              >
                {group.label ? (
                  <p className="px-3 pb-1 pt-1 text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground/80">
                    {group.label}
                  </p>
                ) : null}
                {group.links.map((item) =>
                  item.children?.length ? (
                    <PanelNavGroup key={item.href} item={item} />
                  ) : (
                    <PanelNavLink
                      key={item.href}
                      href={item.href}
                      label={item.label}
                      locked={item.locked}
                      badge={item.badge}
                    />
                  ),
                )}
              </div>
            ))}
          </div>
        </nav>
      }
    >
      {children}
    </PanelChrome>
  );
}
