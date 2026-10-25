import type { Metadata } from "next";
import { Suspense, type ReactNode } from "react";
import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { HomeHeroCard } from "@/components/discovery/home-hero";
import { JsonLd } from "@/components/seo/json-ld";
import { ProjectRow } from "@/components/discovery/project-row";
import { SiteFooter } from "@/components/layout/site-footer";
import { ProjectGridCard } from "@/components/project/project-grid-card";
import { Label } from "@/components/ui/badge";
import { SystemAvatar } from "@/components/ui/avatar";
import { SystemMessage } from "@/components/ui/bubble";
import { buttonStyles } from "@/components/ui/button";
import { pillStyles } from "@/components/ui/pill";
import { cn } from "@/lib/cn";
import { getHomeData } from "@/lib/projects/discovery";
import { localeAlternates, localeUrl } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  return { alternates: localeAlternates(await getLocale()) };
}

// Beranda (VPO-Beranda). The lists are cached for minutes (getHomeData) and prerendered, so the
// page is served from the static shell; rankings come from the database (§2.7).
export default async function HomePage() {
  const t = await getTranslations("home");
  const tMeta = await getTranslations("meta");
  const locale = await getLocale();

  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "WebSite",
          name: tMeta("title"),
          description: tMeta("description"),
          url: localeUrl(locale),
          inLanguage: locale,
          potentialAction: {
            "@type": "SearchAction",
            target: `${localeUrl(locale, "/explore")}?q={search_term_string}`,
            "query-input": "required name=search_term_string",
          },
        }}
      />
      <main className="mx-auto w-full max-w-[1200px] px-4 sm:px-6">
        <section className="flex flex-col gap-12 pt-14 pb-16 lg:flex-row lg:items-center lg:gap-16 lg:pt-[88px] lg:pb-20">
          <div className="flex min-w-0 flex-col gap-[22px] lg:flex-[1_1_440px]">
            <Label className="text-xs text-accent-text">{t("eyebrow")}</Label>
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
          </div>
          <div className="min-w-0 lg:flex-[1_1_500px]">
            <Suspense fallback={<HeroSkeleton />}>
              <Hero />
            </Suspense>
          </div>
        </section>

        <Suspense fallback={<ListsSkeleton />}>
          <HomeLists />
        </Suspense>

        <section className="mt-[72px] flex flex-col gap-5 rounded-[28px] border border-border bg-surface px-5 py-8 sm:px-12 sm:py-10">
          <div className="flex items-end gap-2.5">
            <SystemAvatar />
            <p className="rounded-[20px] rounded-bl-md bg-bubble px-5 py-4 font-display text-[22px] leading-[1.2] sm:text-[28px]">
              {t("ctaLead")} <span className="italic">{t("ctaTail")}</span>
            </p>
          </div>
          <Link
            href="/submit"
            className="flex min-h-[60px] flex-wrap items-center gap-3 rounded-[30px] border border-border-strong bg-bg py-2 pr-2 pl-[22px] transition-colors hover:border-ink sm:ml-[46px]"
          >
            <span className="min-w-0 grow text-base text-muted">{t("ctaPlaceholder")}</span>
            <span className={buttonStyles({ variant: "accent", className: "max-sm:w-full" })}>
              {t("ctaButton")}
            </span>
          </Link>
        </section>
      </main>
      <SiteFooter variant="full" />
    </>
  );
}

async function Hero() {
  const { hero } = await getHomeData();
  if (!hero) {
    const t = await getTranslations("home");
    return <SystemMessage className="max-w-xl">{t("soon")}</SystemMessage>;
  }
  return <HomeHeroCard hero={hero} />;
}

async function HomeLists() {
  const t = await getTranslations("home");
  const { popular, latest, tools } = await getHomeData();

  return (
    <>
      <section className="flex flex-col gap-6 border-t border-border pt-14">
        <SectionHeading href="/explore" seeAll={t("seeAll")}>
          {t("popularLead")} <span className="italic">{t("popularTail")}</span>
        </SectionHeading>
        {popular.length > 0 ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {popular.map((project) => (
              <ProjectGridCard key={project.id} project={project} />
            ))}
          </div>
        ) : (
          <SystemMessage className="max-w-xl">{t("popularEmpty")}</SystemMessage>
        )}
      </section>

      {tools.length > 0 ? (
        <section className="flex flex-col gap-4 pt-14">
          <Label className="text-xs">{t("toolsLabel")}</Label>
          <ul className="flex flex-wrap gap-2.5">
            {tools.map((tool) => (
              <li key={tool.id}>
                <Link
                  href={`/tools/${tool.slug}`}
                  className={pillStyles({ tone: "accent", className: "h-11 px-[18px] text-sm" })}
                >
                  {tool.name}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {latest.length > 0 ? (
        <section className="flex flex-col pt-16">
          <SectionHeading href="/explore?sort=new" seeAll={t("seeAll")} className="pb-4">
            {t("latestLead")} <span className="italic">{t("latestTail")}</span>
          </SectionHeading>
          <div>
            {latest.map((project) => (
              <ProjectRow key={project.id} project={project} />
            ))}
          </div>
        </section>
      ) : null}
    </>
  );
}

function SectionHeading({
  href,
  seeAll,
  className,
  children,
}: {
  href: string;
  seeAll: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("flex items-baseline justify-between gap-4", className)}>
      <h2 className="font-display text-[30px] leading-tight font-normal tracking-[-0.6px] sm:text-[38px]">
        {children}
      </h2>
      <Link
        href={href}
        className="shrink-0 text-sm font-medium text-accent-text underline-offset-2 hover:underline"
      >
        {seeAll}
      </Link>
    </div>
  );
}

function HeroSkeleton() {
  return (
    <div aria-hidden="true" className="flex flex-col gap-3.5">
      <div className="ml-auto h-20 w-4/5 rounded-[22px] bg-bubble" />
      <div className="h-[300px] w-[88%] rounded-[22px] bg-bubble" />
    </div>
  );
}

function ListsSkeleton() {
  return (
    <div
      aria-hidden="true"
      className="grid gap-5 border-t border-border pt-14 sm:grid-cols-2 lg:grid-cols-3"
    >
      {[0, 1, 2].map((index) => (
        <div key={index} className="h-80 rounded-[22px] bg-bubble" />
      ))}
    </div>
  );
}
