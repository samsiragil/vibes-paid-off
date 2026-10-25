"use client";

import { useLocale, useTranslations } from "next-intl";
import { useTransition } from "react";
import { usePathname, useRouter } from "@/i18n/navigation";
import { routing, type Locale } from "@/i18n/routing";
import { cn } from "@/lib/cn";

/** "ID / EN" toggle from the header. Keeps the current path when switching. */
export function LocaleSwitcher({ className }: { className?: string }) {
  const t = useTranslations("locale");
  const current = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function switchTo(locale: Locale) {
    startTransition(() => router.replace(pathname, { locale }));
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
