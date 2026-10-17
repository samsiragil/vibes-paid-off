import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { ResultsGrid } from "@/components/discovery/explore-client";
import { SiteFooter } from "@/components/layout/site-footer";
import { ProjectGridCard } from "@/components/project/project-grid-card";
import { MonoLabel } from "@/components/ui/badge";
import { SystemMessage } from "@/components/ui/bubble";
import { buttonStyles } from "@/components/ui/button";
import { ExternalLink } from "@/components/ui/external-link";
import { pillStyles } from "@/components/ui/pill";
import { cn } from "@/lib/cn";
import { getToolCatalog, quickPickIds } from "@/lib/projects/catalog";
import { getToolPage, searchProjects, type ToolPageData } from "@/lib/projects/discovery";
import { emptyFilters, type ExploreFilters } from "@/lib/projects/explore-params";

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
  };
}

export default function ToolPage({ params }: PageProps<"/[locale]/tools/[slug]">) {
  return (
    <>
      <Suspense fallback={<ToolSkeleton />}>
        <ToolContent params={params} />
      </Suspense>
      <SiteFooter />
    </>
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
    <main className="mx-auto w-full max-w-[1200px] px-4 pt-10 sm:px-6 sm:pt-12">
      <ToolSwitcher tool={tool} label={t("switcherLabel")} allLabel={t("allTools")} />

      <section className="flex flex-col gap-8 border-b border-border pt-10 pb-10 md:flex-row md:items-end md:justify-between md:gap-12 md:pt-12">
        <div className="flex min-w-0 flex-col gap-5 sm:flex-row sm:items-center sm:gap-6">
          <ToolMark tool={tool} />
          <div className="min-w-0">
            <MonoLabel className="text-xs normal-case">/tools/{tool.slug}</MonoLabel>
            <h1 className="mt-1.5 font-display text-[40px] leading-none font-normal tracking-[-1px] break-words sm:text-[60px] sm:tracking-[-1.4px]">
              {t("pageTitleLead")} <span className="italic">{tool.name}</span>
            </h1>
            {description ? (
              <p className="mt-2.5 max-w-[620px] text-[17px] leading-relaxed text-ink-2">
                {description}
              </p>
            ) : null}
          </div>
        </div>
        <div className="flex shrink-0 flex-row items-center justify-between gap-3 md:flex-col md:items-end">
          <div className="md:text-right">
            <div className="font-display text-[44px] leading-none">{page.total}</div>
            <MonoLabel className="text-xs">{t("countLabel")}</MonoLabel>
          </div>
          {tool.url ? (
            <ExternalLink href={tool.url} className={buttonStyles({ variant: "outline" })}>
              {t("site", { name: tool.name })}
            </ExternalLink>
          ) : null}
        </div>
      </section>

      <section className="flex flex-col gap-[22px] pt-10">
        {page.items.length > 0 ? (
          <>
            <SystemMessage>{t("intro", { name: tool.name })}</SystemMessage>
            <ResultsGrid key={tool.slug} filters={filters} nextCursor={page.nextCursor}>
              {page.items.map((project) => (
                <ProjectGridCard key={project.id} project={project} />
              ))}
            </ResultsGrid>
          </>
        ) : (
          <div className="rounded-[22px] border border-dashed border-border-strong px-6 py-10 text-center">
            <p className="font-display text-[26px] leading-tight">
              {t("emptyLead")} <span className="italic">{tool.name}</span>.
            </p>
            <Link
              href="/submit"
              className={buttonStyles({ variant: "accent", className: "mt-4 h-[46px] px-5" })}
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
                className={pillStyles({
                  className: cn(
                    "h-[42px] px-[18px] text-sm",
                    current && "border-ink bg-ink text-bg hover:border-ink",
                  ),
                })}
              >
                {item.name}
              </Link>
            </li>
          );
        })}
        <li className="shrink-0">
          <Link
            href="/tools"
            className="inline-flex h-[42px] items-center px-3 text-sm font-medium text-accent-text underline-offset-2 hover:underline"
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
      className="relative flex size-[72px] shrink-0 items-center justify-center overflow-hidden rounded-[20px] bg-ink font-display text-[28px] text-bg italic sm:size-24 sm:rounded-3xl sm:text-4xl"
    >
      {tool.logoUrl ? (
        <Image
          src={tool.logoUrl}
          alt=""
          fill
          unoptimized
          sizes="96px"
          className="object-contain p-4"
        />
      ) : (
        monogram(tool.name)
      )}
    </div>
  );
}

function ToolSkeleton() {
  return (
    <main aria-hidden="true" className="mx-auto w-full max-w-[1200px] px-4 pt-10 sm:px-6 sm:pt-12">
      <div className="flex flex-wrap gap-2">
        {[0, 1, 2, 3, 4, 5].map((index) => (
          <div key={index} className="h-[42px] w-28 rounded-full bg-bubble" />
        ))}
      </div>
      <div className="flex items-center gap-6 border-b border-border py-12">
        <div className="size-24 rounded-3xl bg-bubble" />
        <div className="h-14 w-96 max-w-[60%] rounded-2xl bg-bubble" />
      </div>
      <div className="mt-10 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {[0, 1, 2].map((index) => (
          <div key={index} className="h-80 rounded-[22px] bg-bubble" />
        ))}
      </div>
    </main>
  );
}
