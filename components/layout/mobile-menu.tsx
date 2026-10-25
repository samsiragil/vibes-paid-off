"use client";

import { useTranslations } from "next-intl";
import { useEffect, useId, useState, type ReactNode } from "react";
import { usePathname } from "@/i18n/navigation";

/** Below `md` the header collapses into this disclosure panel. Closes on navigation and Escape. */
export function MobileMenu({ children }: { children: ReactNode }) {
  const t = useTranslations("nav");
  const [open, setOpen] = useState(false);
  const [openedAt, setOpenedAt] = useState<string | null>(null);
  const pathname = usePathname();
  const panelId = useId();

  // Navigating away closes the menu (derived, so no effect needed).
  const isOpen = open && openedAt === pathname;

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isOpen]);

  return (
    <div className="md:hidden">
      <button
        type="button"
        aria-expanded={isOpen}
        aria-controls={panelId}
        aria-label={isOpen ? t("closeMenu") : t("openMenu")}
        onClick={() => {
          setOpen(!isOpen);
          setOpenedAt(pathname);
        }}
        className="inline-flex size-11 items-center justify-center rounded-md text-ink transition-colors duration-150 hover:bg-placeholder"
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          aria-hidden="true"
        >
          {isOpen ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
        </svg>
      </button>
      <div
        id={panelId}
        hidden={!isOpen}
        className="absolute inset-x-0 top-full z-40 border-b border-border bg-bg px-4 pt-2 pb-6 shadow-sm"
      >
        {children}
      </div>
    </div>
  );
}
