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
      <main className="mx-auto w-full max-w-[1120px] px-4 sm:px-6">
        <section className="flex flex-col gap-10 pt-10 pb-16 lg:flex-row lg:items-center lg:gap-16 lg:pt-16 lg:pb-20">
          <div className="flex min-w-0 flex-col gap-5 lg:flex-[1_1_400px]">
            <Label>{t("eyebrow")}</Label>
            <h1 className="text-[32px] leading-9 font-bold sm:text-[44px] sm:leading-12">
              {t("titleLead")}
              <br />
              {t("titleTail")}
            </h1>
            <p className="max-w-[46ch] text-[17px] leading-7 text-ink-2 sm:text-lg sm:leading-8">
              {t("lede")}
            </p>
            <div className="flex flex-wrap gap-3">
              <Link href="/submit" className={buttonStyles({ variant: "accent", size: "lg" })}>
                {t("ctaSubmit")}
              </Link>
              <Link href="/explore" className={buttonStyles({ variant: "outline", size: "lg" })}>
                {t("ctaExplore")}
              </Link>
            </div>
          </div>
          <div className="min-w-0 lg:flex-[1_1_560px]">
            <Suspense fallback={<HeroSkeleton />}>
              <Hero />
            </Suspense>
          </div>
        </section>

        <Suspense fallback={<ListsSkeleton />}>
          <HomeLists />
        </Suspense>

        <section className="mt-20 flex flex-col gap-5 rounded border border-border bg-surface px-5 py-8 sm:px-10 sm:py-10">
          <div className="flex items-center gap-3">
            <SystemAvatar />
            <h2 className="text-[22px] leading-7 font-semibold sm:text-[26px] sm:leading-8">
              {t("ctaLead")} {t("ctaTail")}
            </h2>
          </div>
          <Link
            href="/submit"
            className="flex min-h-14 flex-wrap items-center gap-3 rounded-md border-[1.5px] border-border-strong bg-bg py-1.5 pr-1.5 pl-4 transition-colors hover:border-ink sm:ml-12"
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
      <section className="flex flex-col gap-6 border-t border-border pt-12">
        <SectionHeading href="/explore" seeAll={t("seeAll")}>
          {t("popularLead")} {t("popularTail")}
        </SectionHeading>
        {popular.length > 0 ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {popular.map((project) => (
              <ProjectGridCard key={project.id} project={project} />
            ))}
          </div>
        ) : (
          <SystemMessage className="max-w-xl">{t("popularEmpty")}</SystemMessage>
        )}
      </section>

      {tools.length > 0 ? (
        <section className="flex flex-col gap-3 pt-12">
          <Label>{t("toolsLabel")}</Label>
          <ul className="flex flex-wrap gap-2">
            {tools.map((tool) => (
              <li key={tool.id}>
                <Link href={`/tools/${tool.slug}`} className={pillStyles({ tone: "accent" })}>
                  {tool.name}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {latest.length > 0 ? (
        <section className="flex flex-col pt-14">
          <SectionHeading href="/explore?sort=new" seeAll={t("seeAll")} className="pb-2">
            {t("latestLead")} {t("latestTail")}
          </SectionHeading>
          <div className="border-t border-rule">
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
      <h2 className="text-[22px] leading-7 font-semibold sm:text-[26px] sm:leading-8">
        {children}
      </h2>
      <Link
        href={href}
        className="shrink-0 text-sm font-semibold text-accent-text underline underline-offset-3"
      >
        {seeAll}
      </Link>
    </div>
  );
}

function HeroSkeleton() {
  // The hero page with its ruling and margin line, still empty.
  return (
    <div
      aria-hidden="true"
      className="relative h-[480px] rounded border border-border bg-surface ruled sm:h-[512px]"
    >
      <span className="absolute inset-y-0 left-3 w-[1.5px] bg-margin sm:left-14" />
    </div>
  );
}

function ListsSkeleton() {
  return (
    <div
      aria-hidden="true"
      className="grid gap-6 border-t border-border pt-12 sm:grid-cols-2 lg:grid-cols-3"
    >
      {[0, 1, 2].map((index) => (
        <div key={index} className="h-80 rounded border border-border bg-surface" />
      ))}
    </div>
  );
}
