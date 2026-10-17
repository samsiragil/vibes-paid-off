"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { SystemMessage } from "@/components/ui/bubble";
import { Button, buttonStyles } from "@/components/ui/button";

// The "500" page for everything under /[locale]: same voice as the 404 (SystemMessage). The root
// layout (header, providers) stays, so translations and the theme keep working.
export default function ErrorPage({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  const t = useTranslations("error");

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto flex w-full max-w-[1200px] flex-col gap-6 px-4 pt-20 pb-24 sm:px-6">
      <h1 className="font-display text-5xl font-normal tracking-[-1px]">
        500 · {t("title")} <span className="italic">{t("titleTail")}</span>
      </h1>
      <SystemMessage className="max-w-xl">
        {t("body")}
        {error.digest ? (
          <span className="mt-2 block font-mono text-xs text-muted">
            {t("code", { digest: error.digest })}
          </span>
        ) : null}
      </SystemMessage>
      <div className="flex flex-wrap gap-3">
        <Button onClick={() => retry()}>{t("retry")}</Button>
        <Link href="/" className={buttonStyles({ variant: "outline" })}>
          {t("home")}
        </Link>
      </div>
    </main>
  );
}
