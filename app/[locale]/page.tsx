import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { MonoLabel } from "@/components/ui/badge";
import { SystemMessage } from "@/components/ui/bubble";
import { buttonStyles } from "@/components/ui/button";
import { SiteFooter } from "@/components/layout/site-footer";

// Placeholder home. The real Beranda (hero pick, popular, latest) is built in Fase 6.
export default async function HomePage() {
  const t = await getTranslations("home");

  return (
    <>
      <main className="mx-auto w-full max-w-[1200px] px-4 sm:px-6">
        <section className="flex max-w-[640px] flex-col gap-[22px] pt-16 pb-12 md:pt-[88px]">
          <MonoLabel className="text-xs text-accent-text">{t("eyebrow")}</MonoLabel>
          <h1 className="font-display text-[44px] leading-[1.02] font-normal tracking-[-1px] sm:text-[68px] sm:tracking-[-1.8px]">
            {t("titleLead")}
            <br />
            <span className="italic">{t("titleTail")}</span>
          </h1>
          <p className="max-w-[480px] text-lg leading-relaxed text-ink-2">{t("lede")}</p>
          <div className="flex flex-wrap gap-3">
            <Link href="/submit" className={buttonStyles({ variant: "accent", size: "lg" })}>
              {t("ctaSubmit")}
            </Link>
            <Link href="/explore" className={buttonStyles({ variant: "outline", size: "lg" })}>
              {t("ctaExplore")}
            </Link>
          </div>
        </section>
        <SystemMessage className="max-w-xl">{t("soon")}</SystemMessage>
      </main>
      <SiteFooter variant="full" />
    </>
  );
}
