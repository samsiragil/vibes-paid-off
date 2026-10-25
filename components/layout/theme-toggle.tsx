"use client";

import { useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";
import { flushSync } from "react-dom";
import { cn } from "@/lib/cn";
import { prefersReducedMotion } from "@/lib/motion";

const order = ["system", "light", "dark"] as const;
type Mode = (typeof order)[number];

const subscribe = () => () => {};

/** Cycles system → light → dark. Renders a neutral icon until mounted to avoid a hydration mismatch. */
export function ThemeToggle({ className }: { className?: string }) {
  const t = useTranslations("theme");
  const { theme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
  const mode: Mode = mounted && order.includes(theme as Mode) ? (theme as Mode) : "system";
  const next = order[(order.indexOf(mode) + 1) % order.length];

  // The whole page crossfades between the old and new colors (README §11). next-themes applies
  // the theme in an effect, which flushSync runs before the browser takes the new snapshot.
  function change() {
    if (!document.startViewTransition || prefersReducedMotion()) {
      setTheme(next);
      return;
    }
    document.startViewTransition(() => flushSync(() => setTheme(next)));
  }

  return (
    <button
      type="button"
      onClick={change}
      aria-label={t("current", { theme: t(mode) })}
      title={t("current", { theme: t(mode) })}
      className={cn(
        "inline-flex size-11 items-center justify-center rounded-md text-muted transition-colors hover:bg-placeholder hover:text-ink",
        className,
      )}
    >
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        {mode === "light" ? (
          <>
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
          </>
        ) : mode === "dark" ? (
          <path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5Z" />
        ) : (
          <>
            <rect x="3" y="4" width="18" height="12" rx="2" />
            <path d="M8 20h8M12 16v4" />
          </>
        )}
      </svg>
    </button>
  );
}
