"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import "./globals.css";

// Replaces the root layout when it fails, so there is no next-intl provider here: the two
// languages are spelled inline (same copy as messages error.*), picked from the URL prefix.
const copy = {
  id: {
    title: "Ada yang error",
    body: "Maaf, situs ini gagal dimuat. Biasanya cukup dicoba lagi. Kalau masih gagal, tunggu beberapa menit.",
    retry: "Coba lagi",
    home: "Balik ke beranda",
  },
  en: {
    title: "Something went wrong",
    body: "Sorry, the site failed to load. Trying again usually fixes it. If it keeps failing, wait a few minutes.",
    retry: "Try again",
    home: "Back to home",
  },
};

export default function GlobalError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  const locale = usePathname()?.startsWith("/en") ? "en" : "id";
  const t = copy[locale];

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang={locale}>
      <body className="min-h-full bg-bg text-ink">
        <title>{`${t.title} · Jadinya`}</title>
        <main className="mx-auto flex max-w-[1200px] flex-col gap-6 px-4 pt-20 sm:px-6">
          <p className="font-serif text-2xl">
            Jadi<span className="text-accent-text italic">nya.</span>
          </p>
          <h1 className="font-serif text-5xl font-normal tracking-[-1px]">500 · {t.title}</h1>
          <p className="max-w-xl rounded-[18px] rounded-bl-md border border-border bg-surface px-[18px] py-3.5 text-[15px] leading-normal">
            {t.body}
            {error.digest ? (
              <span className="mt-2 block font-mono text-xs text-muted">{error.digest}</span>
            ) : null}
          </p>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => retry()}
              className="inline-flex h-11 items-center rounded-full bg-ink px-[18px] text-sm font-medium text-bg"
            >
              {t.retry}
            </button>
            {/* A full page load on purpose: the app shell itself is what failed. */}
            <a
              href={`/${locale}`}
              className="inline-flex h-11 items-center rounded-full border border-border-strong bg-surface px-[18px] text-sm font-medium"
            >
              {t.home}
            </a>
          </div>
        </main>
      </body>
    </html>
  );
}
