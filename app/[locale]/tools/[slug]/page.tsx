import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { ResultsGrid } from "@/components/discovery/explore-client";
import { SiteFooter } from "@/components/layout/site-footer";
import { ProjectGridCard } from "@/components/project/project-grid-card";
import { SystemMessage } from "@/components/ui/bubble";
import { buttonStyles } from "@/components/ui/button";
import { ExternalLink } from "@/components/ui/external-link";
import { pillStyles } from "@/components/ui/pill";
import { PageTransition, Reveal } from "@/components/ui/transitions";
import { getToolCatalog, quickPickIds } from "@/lib/projects/catalog";
import { getToolPage, searchProjects, type ToolPageData } from "@/lib/projects/discovery";
import { emptyFilters, type ExploreFilters } from "@/lib/projects/explore-params";
import { localeAlternates } from "@/lib/seo";

/** The most used tools are prerendered; any other slug renders on first visit, then is cached. */
export async function generateStaticParams() {
  const catalog = await getToolCatalog();
  return quickPickIds(catalog).flatMap((id) => {
    const tool = catalog.find((item) => item.id === id);
    return tool ? [{ slug: tool.slug }] : [];
  });
}

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/tools/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const tool = await getToolPage(slug);
  const t = await getTranslations("tools");
  if (!tool) return { title: t("metaTitle"), robots: { index: false } };
  const locale = await getLocale();
  return {
    title: t("toolMeta", { name: tool.name }),
    description: (locale === "en" ? tool.description.en : tool.description.id) || undefined,
    alternates: localeAlternates(locale, `/tools/${tool.slug}`),
  };
}

export default function ToolPage({ params }: PageProps<"/[locale]/tools/[slug]">) {
  return (
    <PageTransition>
      <Reveal fallback={<ToolSkeleton />}>
        <ToolContent params={params} />
      </Reveal>
      <SiteFooter />
    </PageTransition>
  );
}

/** "Claude Code" → "Cc", "Cursor" → "Cu", "v0" → "v0" (the square monogram). */
function monogram(name: string) {
  const words = name.split(/[\s/.-]+/).filter(Boolean);
  if (words.length > 1) return words[0][0].toUpperCase() + words[1][0].toLowerCase();
  return name.slice(0, 2);
}

function toolFilters(slug: string): ExploreFilters {
  return { ...emptyFilters, tools: [slug] };
}

async function ToolContent({ params }: { params: PageProps<"/[locale]/tools/[slug]">["params"] }) {
  const { slug } = await params;
  const tool = await getToolPage(slug);
  if (!tool) notFound();

  const filters = toolFilters(tool.slug);
  const [page, locale, t] = await Promise.all([
    searchProjects(filters),
    getLocale(),
    getTranslations("tools"),
  ]);
  const description = locale === "en" ? tool.description.en : tool.description.id;

  return (
    <main className="mx-auto w-full max-w-[1120px] px-4 pt-8 sm:px-6 sm:pt-10">
      <ToolSwitcher tool={tool} label={t("switcherLabel")} allLabel={t("allTools")} />

      <section className="flex flex-col gap-4 border-b border-border pt-8 pb-8 sm:flex-row sm:items-center sm:gap-6">
        <ToolMark tool={tool} />
        <div className="flex min-w-0 flex-col gap-2">
          <h1 className="text-[30px] leading-9 font-bold break-words sm:text-[40px] sm:leading-11">
            {t("pageTitleLead")} {tool.name}
          </h1>
          {description ? (
            <p className="max-w-[68ch] text-base leading-6 text-ink-2">{description}</p>
          ) : null}
          <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted">
            <span className="tabular-nums">{t("projectCount", { count: page.total })}</span>
            {tool.url ? (
              <ExternalLink
                href={tool.url}
                className="inline-flex min-h-11 items-center font-semibold text-accent-text underline underline-offset-3 sm:min-h-0"
              >
                {t("site", { name: tool.name })}
              </ExternalLink>
            ) : null}
          </p>
        </div>
      </section>

      <section className="flex flex-col gap-6 pt-8">
        {/* Cards use h3; keep the outline h1 → h2 → h3 for screen readers. */}
        <h2 className="sr-only">{t("projectCount", { count: page.total })}</h2>
        {page.items.length > 0 ? (
          <>
            <SystemMessage>{t("intro", { name: tool.name })}</SystemMessage>
            <ResultsGrid key={tool.slug} filters={filters} nextCursor={page.nextCursor}>
              {page.items.map((project, index) => (
                <ProjectGridCard key={project.id} project={project} eager={index === 0} />
              ))}
            </ResultsGrid>
          </>
        ) : (
          <div className="flex flex-col items-start gap-4">
            <SystemMessage className="max-w-xl">
              {t("emptyLead")} {tool.name}.
            </SystemMessage>
            <Link
              href="/submit"
              className={buttonStyles({ variant: "accent", className: "sm:ml-12" })}
            >
              {t("emptyCta")}
            </Link>
          </div>
        )}
      </section>
    </main>
  );
}

function ToolSwitcher({
  tool,
  label,
  allLabel,
}: {
  tool: ToolPageData;
  label: string;
  allLabel: string;
}) {
  return (
    <nav aria-label={label}>
      {/* One scrollable row on phones, wrapping from `sm` up. */}
      <ul className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
        {tool.switcher.map((item) => {
          const current = item.id === tool.id;
          return (
            <li key={item.id} className="shrink-0">
              <Link
                href={`/tools/${item.slug}`}
                aria-current={current ? "page" : undefined}
                className={pillStyles({ selected: current })}
              >
                {item.name}
              </Link>
            </li>
          );
        })}
        <li className="shrink-0">
          <Link
            href="/tools"
            className="inline-flex h-11 items-center px-3 text-sm font-semibold text-accent-text underline underline-offset-3 sm:h-9"
          >
            {allLabel} →
          </Link>
        </li>
      </ul>
    </nav>
  );
}

function ToolMark({ tool }: { tool: ToolPageData }) {
  return (
    <div
      aria-hidden="true"
      className="relative flex size-16 shrink-0 items-center justify-center overflow-hidden rounded border border-border bg-surface text-2xl font-bold text-ink sm:size-20 sm:text-[28px]"
    >
      {tool.logoUrl ? (
        <Image
          src={tool.logoUrl}
          alt=""
          fill
          unoptimized
          sizes="96px"
          className="object-contain p-3"
        />
      ) : (
        monogram(tool.name)
      )}
    </div>
  );
}

function ToolSkeleton() {
  return (
    <main aria-hidden="true" className="mx-auto w-full max-w-[1120px] px-4 pt-8 sm:px-6 sm:pt-10">
      <div className="flex flex-wrap gap-2">
        {[0, 1, 2, 3, 4, 5].map((index) => (
          <div key={index} className="h-9 w-28 rounded-md border border-border bg-surface" />
        ))}
      </div>
      <div className="flex items-center gap-6 border-b border-border py-8">
        <div className="size-20 rounded border border-border bg-surface" />
        <div className="h-10 w-96 max-w-[60%] rounded-sm bg-placeholder" />
      </div>
      <div className="mt-8 grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
        {[0, 1, 2].map((index) => (
          <div key={index} className="h-80 rounded border border-border bg-surface" />
        ))}
      </div>
    </main>
  );
}
