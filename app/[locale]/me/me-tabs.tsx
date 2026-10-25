"use client";

import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { cn } from "@/lib/cn";

export type MeTab = "projects" | "profile";

const TABS: MeTab[] = ["projects", "profile"];

/**
 * The dashboard's two tabs ("Proyek saya", "Edit profil"). Both panels are rendered on the
 * server; the active one is kept in `?tab=` so a reload or shared link opens the same tab.
 */
export function MeTabs({
  initialTab,
  label,
  tabLabels,
  panels,
}: {
  initialTab: MeTab;
  label: string;
  tabLabels: Record<MeTab, string>;
  panels: Record<MeTab, ReactNode>;
}) {
  const [active, setActive] = useState<MeTab>(initialTab);
  const id = useId();
  const tabRefs = useRef<Partial<Record<MeTab, HTMLButtonElement | null>>>({});

  function select(tab: MeTab, focus = false) {
    setActive(tab);
    if (focus) tabRefs.current[tab]?.focus();
    const url = new URL(window.location.href);
    if (tab === "projects") url.searchParams.delete("tab");
    else url.searchParams.set("tab", tab);
    window.history.replaceState(window.history.state, "", url);
  }

  function onKeyDown(event: KeyboardEvent) {
    const index = TABS.indexOf(active);
    if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
      event.preventDefault();
      const step = event.key === "ArrowRight" ? 1 : -1;
      select(TABS[(index + step + TABS.length) % TABS.length], true);
    }
  }

  return (
    <div className="mt-10">
      <div
        role="tablist"
        aria-label={label}
        onKeyDown={onKeyDown}
        className="flex gap-1.5 border-b border-border"
      >
        {TABS.map((tab) => (
          <button
            key={tab}
            ref={(node) => {
              tabRefs.current[tab] = node;
            }}
            id={`${id}-${tab}-tab`}
            type="button"
            role="tab"
            aria-selected={active === tab}
            aria-controls={`${id}-${tab}-panel`}
            tabIndex={active === tab ? 0 : -1}
            onClick={() => select(tab)}
            className={cn(
              "h-11 shrink-0 px-3 text-base whitespace-nowrap transition-colors",
              active === tab ? "font-semibold text-ink" : "text-ink-2 hover:text-ink",
            )}
          >
            {/* The active tab is marked with the highlighter (README §6). */}
            {active === tab ? <span className="stabilo">{tabLabels[tab]}</span> : tabLabels[tab]}
          </button>
        ))}
      </div>
      {TABS.map((tab) => (
        <div
          key={tab}
          id={`${id}-${tab}-panel`}
          role="tabpanel"
          aria-labelledby={`${id}-${tab}-tab`}
          hidden={active !== tab}
          tabIndex={0}
          className="focus-visible:outline-offset-4"
        >
          {panels[tab]}
        </div>
      ))}
    </div>
  );
}
