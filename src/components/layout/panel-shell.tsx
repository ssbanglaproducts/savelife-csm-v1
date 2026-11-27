import type { ReactNode } from "react";
import { getTranslations } from "next-intl/server";
import type { Viewer } from "@/lib/viewer";
import { PanelNavGroup } from "./panel-nav-group";
import { PanelNavLink } from "./panel-nav-link";
import { PanelNavSection } from "./panel-nav-section";
import type { PanelLink } from "./panel-nav-types";
import { PanelChrome } from "./panel-chrome";

export async function PanelShell({
  title,
  links,
  primaryHrefs,
  avatar,
  hideMobilePreferences = false,
  children,
}: {
  title?: string;
  links: PanelLink[];
  primaryHrefs: string[];
  avatar?: Viewer;
  hideMobilePreferences?: boolean;
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
      hideMobilePreferences={hideMobilePreferences}
      desktopNav={
        <nav aria-label={t("sections")} className="w-full">
          <p className="border-b border-border px-3 py-3 text-xs font-bold tracking-[0.12em] text-muted-foreground">
            {t("sections")}
          </p>
          <div className="flex flex-col gap-1 p-2">
            {groups.map((group, groupIndex) => (
              <div key={`${group.label ?? "links"}-${groupIndex}`} className={groupIndex === 0 ? "" : "mt-2"}>
                {group.label ? (
                  <PanelNavSection
                    label={group.label}
                    hrefs={group.links.flatMap((item) => [
                      item.href,
                      ...(item.children ?? []).map((child) => child.href),
                    ])}
                    storageKey={`savelife.panel.section.${group.links[0]?.href ?? groupIndex}`}
                  >
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
                  </PanelNavSection>
                ) : (
                  <div className="flex flex-col gap-1">
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
