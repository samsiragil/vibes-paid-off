import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { LISTINGS_TAG, TOOLS_TAG } from "@/lib/cache-tags";
import { createPublicClient } from "@/lib/supabase/public";
import { PROJECT_CARD_SELECT, toProjectCard, type ProjectCardData } from "./cards";
import { getToolCatalog, quickPickIds } from "./catalog";
import type { ExploreCursor, ExploreFilters } from "./explore-params";
import type { CatalogTool, ToolKind } from "./types";

// Public discovery data (Fase 6): home, /explore and /tools. All of it is cached for minutes
// under LISTINGS_TAG; rankings come from the database (§2.7), never from this code.

export const PAGE_SIZE = 24;
const POPULAR_COUNT = 6;
const LATEST_COUNT = 5;
const HOME_TOOL_COUNT = 8;
const SWITCHER_COUNT = 8;

type PublicClient = ReturnType<typeof createPublicClient>;

/** Card data for published projects, in the order of `ids`. */
async function cardsByIds(supabase: PublicClient, ids: string[]): Promise<ProjectCardData[]> {
  if (ids.length === 0) return [];
  const { data, error } = await supabase
    .from("projects")
    .select(PROJECT_CARD_SELECT)
    .in("id", ids)
    .eq("status", "published");
  if (error) throw new Error(`Could not load projects: ${error.message}`);
  const byId = new Map(data.map((row) => [row.id, toProjectCard(row)]));
  return ids.flatMap((id) => byId.get(id) ?? []);
}

export type HomeHero = { project: ProjectCardData; kind: "weekly_pick" | "latest" };

export type HomeData = {
  /** "Pilihan minggu ini", or the newest project ("Baru masuk") when none qualified. */
  hero: HomeHero | null;
  /** "Obrolan terpopuler minggu ini": rolling 7 days, one per maker. */
  popular: ProjectCardData[];
  /** "Baru masuk": newest published, without the hero. */
  latest: ProjectCardData[];
  /** "Mau lihat yang dibikin pakai…": most used tools. */
  tools: CatalogTool[];
};

export async function getHomeData(): Promise<HomeData> {
  "use cache";
  cacheLife("minutes");
  cacheTag(LISTINGS_TAG, TOOLS_TAG);

  const supabase = createPublicClient();
  const [heroResult, popularResult, latestResult, catalog] = await Promise.all([
    supabase.rpc("get_home_hero"),
    supabase.rpc("popular_this_week", { p_limit: POPULAR_COUNT }),
    supabase
      .from("projects")
      .select(PROJECT_CARD_SELECT)
      .eq("status", "published")
      .order("published_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(LATEST_COUNT + 1),
    getToolCatalog(),
  ]);
  if (heroResult.error) throw new Error(`Could not load hero: ${heroResult.error.message}`);
  if (popularResult.error) {
    throw new Error(`Could not load popular projects: ${popularResult.error.message}`);
  }
  if (latestResult.error) {
    throw new Error(`Could not load latest projects: ${latestResult.error.message}`);
  }

  const heroRow = heroResult.data[0];
  const [heroCards, popular] = await Promise.all([
    cardsByIds(supabase, heroRow ? [heroRow.project_id] : []),
    cardsByIds(
      supabase,
      popularResult.data.map((row) => row.project_id),
    ),
  ]);
  const heroProject = heroCards[0];
  const hero: HomeHero | null =
    heroRow && heroProject
      ? { project: heroProject, kind: heroRow.kind === "weekly_pick" ? "weekly_pick" : "latest" }
      : null;

  const latest = latestResult.data
    .map(toProjectCard)
    .filter((project) => project.id !== hero?.project.id)
    .slice(0, LATEST_COUNT);

  const toolIds = quickPickIds(catalog).slice(0, HOME_TOOL_COUNT);
  const tools = toolIds.flatMap((id) => catalog.find((tool) => tool.id === id) ?? []);

  return { hero, popular, latest, tools };
}

export type ProjectPage = {
  items: ProjectCardData[];
  /** Matches for the filters (all pages). */
  total: number;
  /** Pass back to get the next page; null on the last one. */
  nextCursor: ExploreCursor | null;
};

/** One page of published projects for /explore and /tools/[slug] (search_projects RPC). */
export async function searchProjects(
  filters: ExploreFilters,
  after: ExploreCursor | null = null,
): Promise<ProjectPage> {
  "use cache";
  cacheLife("minutes");
  cacheTag(LISTINGS_TAG);

  const supabase = createPublicClient();
  const { data, error } = await supabase.rpc("search_projects", {
    p_query: filters.q || undefined,
    p_tools: filters.tools.length > 0 ? filters.tools : undefined,
    p_categories: filters.categories.length > 0 ? filters.categories : undefined,
    p_lang: filters.lang ?? undefined,
    p_sort: filters.sort,
    p_after: after ?? undefined,
    // One extra row tells whether another page exists.
    p_limit: PAGE_SIZE + 1,
  });
  if (error) throw new Error(`Could not search projects: ${error.message}`);

  const rows = data.slice(0, PAGE_SIZE);
  const last = rows.at(-1);
  const items = await cardsByIds(
    supabase,
    rows.map((row) => row.project_id),
  );

  return {
    items,
    total: Number(data[0]?.total_count ?? 0),
    nextCursor:
      data.length > PAGE_SIZE && last
        ? { e: last.eligible_upvote_count, p: last.published_at, i: last.project_id }
        : null,
  };
}

export type ToolPageData = {
  id: number;
  slug: string;
  name: string;
  url: string | null;
  logoUrl: string | null;
  kind: ToolKind;
  description: { id: string; en: string };
  projectCount: number;
  /** Most used tools of the same kind for the switcher (this one included). */
  switcher: CatalogTool[];
};

/** A catalog tool for /tools/[slug], or null when unknown or inactive. Cached. */
export async function getToolPage(slug: string): Promise<ToolPageData | null> {
  "use cache";
  cacheLife("hours");
  cacheTag(TOOLS_TAG);
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) return null;

  const [{ data: tool, error }, catalog] = await Promise.all([
    createPublicClient()
      .from("tools")
      .select("id, slug, name, url, logo_url, kind, description_id, description_en, project_count")
      .eq("slug", slug)
      .eq("is_active", true)
      .maybeSingle(),
    getToolCatalog(),
  ]);
  if (error) throw new Error(`Could not load tool: ${error.message}`);
  if (!tool) return null;

  const sameKind = catalog.filter((item) => item.kind === tool.kind);
  const top = quickPickIds(sameKind)
    .slice(0, SWITCHER_COUNT)
    .flatMap((id) => sameKind.find((item) => item.id === id) ?? []);
  const switcher = top.some((item) => item.id === tool.id)
    ? top
    : [...top.slice(0, SWITCHER_COUNT - 1), ...sameKind.filter((item) => item.id === tool.id)];

  return {
    id: tool.id,
    slug: tool.slug,
    name: tool.name,
    url: tool.url,
    logoUrl: tool.logo_url,
    kind: tool.kind,
    description: { id: tool.description_id, en: tool.description_en },
    projectCount: tool.project_count,
    switcher,
  };
}
