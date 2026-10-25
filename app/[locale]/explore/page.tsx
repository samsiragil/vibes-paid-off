import type { Metadata } from "next";
import { Suspense } from "react";
import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import {
  ExploreProvider,
  FilterPanel,
  MobileFilters,
  PendingStatus,
  ResultsGrid,
  SearchForm,
  SortSwitch,
  type FilterCategory,
  type FilterToolGroup,
} from "@/components/discovery/explore-client";
import { SiteFooter } from "@/components/layout/site-footer";
import { ProjectGridCard } from "@/components/project/project-grid-card";
import { SystemMessage } from "@/components/ui/bubble";
import { getCategories, getToolCatalog } from "@/lib/projects/catalog";
import { searchProjects } from "@/lib/projects/discovery";
import {
  activeFilterCount,
  exploreHref,
  parseExploreParams,
  type ExploreFilters,
} from "@/lib/projects/explore-params";
import { TOOL_KINDS, type CatalogTool } from "@/lib/projects/types";
import { localeAlternates } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("explore");
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
    alternates: localeAlternates(await getLocale(), "/explore"),
  };
}

// Jelajah (VPO-Jelajah). The title is static; everything that depends on the URL query streams
// in, with each filter combination cached for minutes (searchProjects).
export default async function ExplorePage({ searchParams }: PageProps<"/[locale]/explore">) {
  const t = await getTranslations("explore");

  return (
    <>
      <main className="mx-auto w-full max-w-[1120px] px-4 pt-10 sm:px-6 sm:pt-12">
        <h1 className="text-[30px] leading-9 font-bold break-words sm:text-[40px] sm:leading-11">
          {t("titleLead")} {t("titleTail")}
        </h1>
        <Suspense fallback={<ExploreSkeleton />}>
          <ExploreBody searchParams={searchParams} />
        </Suspense>
      </main>
      <SiteFooter />
    </>
  );
}

/** Tools with published projects, grouped by kind, most used first (§2.8). */
function filterToolGroups(
  catalog: CatalogTool[],
  selected: string[],
  kindLabel: (kind: CatalogTool["kind"]) => string,
): FilterToolGroup[] {
  return TOOL_KINDS.map((kind) => ({
    kind,
    label: kindLabel(kind),
    tools: catalog
      .filter(
        (tool) => tool.kind === kind && (tool.projectCount > 0 || selected.includes(tool.slug)),
      )
      .sort((a, b) => b.projectCount - a.projectCount || a.name.localeCompare(b.name))
      .map((tool) => ({ slug: tool.slug, name: tool.name, count: tool.projectCount })),
  })).filter((group) => group.tools.length > 0);
}

async function ExploreBody({
  searchParams,
}: {
  searchParams: PageProps<"/[locale]/explore">["searchParams"];
}) {
  const parsed = parseExploreParams(await searchParams);
  const [catalog, categorySlugs] = await Promise.all([getToolCatalog(), getCategories()]);
  // Unknown slugs would only ever match nothing; drop them so the URL state stays honest.
  const filters: ExploreFilters = {
    ...parsed,
    tools: parsed.tools.filter((slug) => catalog.some((tool) => tool.slug === slug)),
    categories: parsed.categories.filter((slug) => categorySlugs.includes(slug)),
  };
  const page = await searchProjects(filters);

  const t = await getTranslations("explore");
  const tKinds = await getTranslations("toolKinds");
  const tCategories = await getTranslations("categories");
  const toolGroups = filterToolGroups(catalog, filters.tools, (kind) => tKinds(kind));
  const categories: FilterCategory[] = categorySlugs.map((slug) => ({
    slug,
    label: tCategories(slug),
  }));
  const hasFilters = activeFilterCount(filters) > 0 || filters.q !== "";
  const panel = <FilterPanel toolGroups={toolGroups} categories={categories} />;

  return (
    <ExploreProvider filters={filters}>
      <div className="border-b border-border pt-5 pb-6">
        <SearchForm />
      </div>
      <PendingStatus />

      <div className="flex gap-10 pt-8">
        <aside aria-label={t("filtersLabel")} className="hidden w-[220px] shrink-0 lg:block">
          {panel}
        </aside>

        <section className="flex min-w-0 grow flex-col gap-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-sm font-normal text-ink-2">
              {filters.q
                ? t("countSearch", { count: page.total, q: filters.q })
                : t("count", { count: page.total })}
            </h2>
            <div className="flex flex-wrap items-center gap-2">
              <MobileFilters>{panel}</MobileFilters>
              <SortSwitch />
            </div>
          </div>

          {page.items.length > 0 ? (
            <ResultsGrid
              key={exploreHref(filters)}
              filters={filters}
              nextCursor={page.nextCursor}
              showLang
            >
              {page.items.map((project, index) => (
                <ProjectGridCard key={project.id} project={project} showLang eager={index === 0} />
              ))}
            </ResultsGrid>
          ) : (
            <div className="flex flex-col items-start gap-4 py-6">
              <SystemMessage>
                {t("empty")}{" "}
                <Link href="/submit" className="text-accent-text underline underline-offset-3">
                  {t("emptyCta")}
                </Link>
              </SystemMessage>
              {hasFilters ? (
                <Link
                  href="/explore"
                  className="inline-flex min-h-11 items-center text-sm font-semibold text-accent-text underline underline-offset-3 sm:ml-12"
                >
                  {t("clear")}
                </Link>
              ) : null}
            </div>
          )}
        </section>
      </div>
    </ExploreProvider>
  );
}

function ExploreSkeleton() {
  return (
    <div aria-hidden="true">
      <div className="border-b border-border pt-5 pb-6">
        <div className="h-14 max-w-[760px] rounded-md border-[1.5px] border-border bg-surface" />
      </div>
      <div className="flex gap-10 pt-8">
        <div className="hidden w-[220px] shrink-0 flex-col gap-3 lg:flex">
          {[0, 1, 2, 3, 4, 5].map((index) => (
            <div key={index} className="h-5 rounded-sm bg-placeholder" />
          ))}
        </div>
        <div className="grid grow gap-6 sm:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((index) => (
            <div key={index} className="h-80 rounded border border-border bg-surface" />
          ))}
        </div>
      </div>
    </div>
  );
}
