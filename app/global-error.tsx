"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { Logo } from "@/components/layout/logo";
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
        <main className="mx-auto flex max-w-[1120px] flex-col gap-5 px-4 pt-16 sm:px-6 sm:pt-20">
          <Logo className="self-start" />
          <h1 className="text-[30px] leading-9 font-bold sm:text-[40px] sm:leading-11">
            500 · {t.title}
          </h1>
          <p className="max-w-xl rounded border border-border bg-surface px-4 py-3 text-base leading-6">
            {t.body}
            {error.digest ? (
              <span className="mt-2 block text-sm text-muted">{error.digest}</span>
            ) : null}
          </p>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => retry()}
              className="inline-flex h-11 items-center rounded-md bg-accent px-4 text-base font-semibold text-on-accent"
            >
              {t.retry}
            </button>
            {/* A full page load on purpose: the app shell itself is what failed. */}
            <a
              href={`/${locale}`}
              className="inline-flex h-11 items-center rounded-md border-[1.5px] border-border-strong bg-surface px-4 text-base font-semibold"
            >
              {t.home}
            </a>
          </div>
        </main>
      </body>
    </html>
  );
}
