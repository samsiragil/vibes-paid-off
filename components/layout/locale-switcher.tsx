"use client";

import { useLocale, useTranslations } from "next-intl";
import { useEffect, useTransition } from "react";
import { usePathname, useRouter } from "@/i18n/navigation";
import { routing, type Locale } from "@/i18n/routing";
import { cn } from "@/lib/cn";
import { prefersReducedMotion } from "@/lib/motion";

/**
 * Ends the crossfade of a language switch. A new locale remounts the root layout, so the switcher
 * that started it is gone by then: the switcher that mounts in the new language calls this.
 */
let finishSwitch: (() => void) | null = null;

/** Longest the old screen waits for the new language before it gives up on the crossfade. */
const SWITCH_TIMEOUT_MS = 2000;

/** "ID / EN" toggle from the header. Keeps the current path when switching. */
export function LocaleSwitcher({ className }: { className?: string }) {
  const t = useTranslations("locale");
  const current = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    finishSwitch?.();
    finishSwitch = null;
  }, [current]);

  function switchTo(locale: Locale) {
    // Nothing would mount in a "new" language, so the crossfade would only wait out its timeout.
    if (locale === current) return;
    const navigate = () => startTransition(() => router.replace(pathname, { locale }));
    // React does not animate a root layout remount, so the whole screen crossfades here (README §11).
    if (!document.startViewTransition || prefersReducedMotion()) {
      navigate();
      return;
    }
    document.startViewTransition(
      () =>
        new Promise<void>((resolve) => {
          finishSwitch = resolve;
          setTimeout(resolve, SWITCH_TIMEOUT_MS);
          navigate();
        }),
    );
  }

  return (
    <div
      role="group"
      aria-label={t("label")}
      className={cn("flex items-center text-sm text-muted", className)}
    >
      {routing.locales.map((locale, index) => (
        <span key={locale} className="flex items-center">
          {index > 0 ? <span aria-hidden="true">/</span> : null}
          <button
            type="button"
            lang={locale}
            disabled={pending}
            aria-current={locale === current ? "true" : undefined}
            aria-label={t("switchTo", { language: t(locale) })}
            onClick={() => switchTo(locale)}
            className={cn(
              "min-h-11 min-w-8 px-1 uppercase hover:text-ink",
              locale === current && "font-semibold text-ink",
            )}
          >
            {locale}
          </button>
        </span>
      ))}
    </div>
  );
}
