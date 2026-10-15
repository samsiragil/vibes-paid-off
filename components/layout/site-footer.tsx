import { cacheLife } from "next/cache";
import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { buttonStyles } from "@/components/ui/button";
import { MonoLabel } from "@/components/ui/badge";
import { Wordmark } from "./logo";

async function getCurrentYear() {
  "use cache";
  cacheLife("days");
  return new Date().getFullYear();
}

/** Donation link follows the active language: local platform for /id, global for /en. */
function DonateLink({ locale, label }: { locale: string; label: string }) {
  const external =
    locale === "id" ? process.env.NEXT_PUBLIC_DONATE_URL_ID : process.env.NEXT_PUBLIC_DONATE_URL_EN;
  const className = buttonStyles({ variant: "outline-accent" });

  if (!external) {
    return (
      <Link href="/support" className={className}>
        {label}
      </Link>
    );
  }
  return (
    <a href={external} target="_blank" rel="noopener noreferrer" className={className}>
      {label}
    </a>
  );
}

export async function SiteFooter({ variant = "compact" }: { variant?: "full" | "compact" }) {
  const t = await getTranslations("footer");
  const tLocale = await getTranslations("locale");
  const locale = await getLocale();
  const year = await getCurrentYear();
  const link = "text-ink hover:text-accent-text";

  if (variant === "compact") {
    return (
      <footer className="mt-24 border-t border-border">
        <div className="mx-auto flex max-w-[1200px] flex-col gap-5 px-4 py-8 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <Wordmark className="text-xl" />
          <div className="flex flex-wrap items-center gap-x-5 gap-y-3 text-sm">
            <Link href="/rules" className={link}>
              {t("rules")}
            </Link>
            <Link href="/support" className={link}>
              {t("about")}
            </Link>
            <DonateLink locale={locale} label={t("buyCoffee")} />
          </div>
        </div>
      </footer>
    );
  }

  return (
    <footer className="mt-24 border-t border-border">
      <div className="mx-auto grid max-w-[1200px] gap-10 px-4 pt-12 pb-6 sm:px-6 md:grid-cols-[minmax(0,2fr)_repeat(3,minmax(0,1fr))]">
        <div className="flex flex-col gap-2.5">
          <Wordmark />
          <p className="max-w-80 text-sm leading-relaxed text-ink-2">{t("tagline")}</p>
        </div>
        <div className="flex flex-col gap-2.5 text-sm">
          <MonoLabel>{t("explore")}</MonoLabel>
          <Link href="/explore" className={link}>
            {t("allProjects")}
          </Link>
          <Link href="/tools" className={link}>
            {t("byTools")}
          </Link>
        </div>
        <div className="flex flex-col gap-2.5 text-sm">
          <MonoLabel>{t("community")}</MonoLabel>
          <Link href="/rules" className={link}>
            {t("rules")}
          </Link>
          <Link href="/support" className={link}>
            {t("about")}
          </Link>
        </div>
        <div className="flex flex-col items-start gap-2.5">
          <p className="text-sm text-ink-2">{t("freeNote")}</p>
          <DonateLink locale={locale} label={t("buyCoffee")} />
        </div>
      </div>
      <div className="mx-auto flex max-w-[1200px] flex-col gap-2 px-4 pt-4 pb-8 font-mono text-xs text-muted sm:flex-row sm:justify-between sm:px-6">
        <span>{t("copyright", { year })}</span>
        <span>
          {tLocale("id")} · {tLocale("en")}
        </span>
      </div>
    </footer>
  );
}
