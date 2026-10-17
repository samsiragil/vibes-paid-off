import type { Metadata } from "next";
import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
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

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("explore");
  return { title: t("metaTitle"), description: t("metaDescription") };
}

// Jelajah (VPO-Jelajah). The title is static; everything that depends on the URL query streams
// in, with each filter combination cached for minutes (searchProjects).
export default async function ExplorePage({ searchParams }: PageProps<"/[locale]/explore">) {
  const t = await getTranslations("explore");

  return (
    <>
      <main className="mx-auto w-full max-w-[1200px] px-4 pt-12 sm:px-6 sm:pt-14">
        <h1 className="font-display text-[44px] leading-none font-normal tracking-[-1px] sm:text-[56px] sm:tracking-[-1.2px]">
          {t("titleLead")} <span className="italic">{t("titleTail")}</span>
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
      <div className="border-b border-border pt-5 pb-8">
        <SearchForm />
      </div>
      <PendingStatus />

      <div className="flex gap-10 pt-8">
        <aside aria-label={t("filtersLabel")} className="hidden w-[220px] shrink-0 lg:block">
          {panel}
        </aside>

        <section className="flex min-w-0 grow flex-col gap-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-ink-2">
              {filters.q
                ? t("countSearch", { count: page.total, q: filters.q })
                : t("count", { count: page.total })}
            </p>
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
              {page.items.map((project) => (
                <ProjectGridCard key={project.id} project={project} showLang />
              ))}
            </ResultsGrid>
          ) : (
            <div className="flex flex-col items-start gap-4 py-6">
              <SystemMessage>
                {t("empty")}{" "}
                <Link href="/submit" className="text-accent-text underline underline-offset-2">
                  {t("emptyCta")}
                </Link>
              </SystemMessage>
              {hasFilters ? (
                <Link
                  href="/explore"
                  className="ml-[46px] text-sm font-medium text-accent-text underline-offset-2 hover:underline"
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
      <div className="border-b border-border pt-5 pb-8">
        <div className="h-[60px] max-w-[760px] rounded-[30px] bg-bubble" />
      </div>
      <div className="flex gap-10 pt-8">
        <div className="hidden w-[220px] shrink-0 flex-col gap-3 lg:flex">
          {[0, 1, 2, 3, 4, 5].map((index) => (
            <div key={index} className="h-6 rounded bg-bubble" />
          ))}
        </div>
        <div className="grid grow gap-[18px] sm:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((index) => (
            <div key={index} className="h-80 rounded-[22px] bg-bubble" />
          ))}
        </div>
      </div>
    </div>
  );
}
