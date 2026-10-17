import type { ContentLang } from "./types";

// /explore filter state lives in the URL so a filtered view can be shared:
//   /explore?q=kasir&tools=claude-code,supabase&category=umkm&lang=id&sort=new
// Shared by the server (parsing searchParams) and the filter controls (building links).

export type ExploreSort = "worth_it" | "new";

export type ExploreFilters = {
  q: string;
  /** Tool slugs; a project must use all of them. */
  tools: string[];
  /** Category slugs; a project may be in any of them. */
  categories: string[];
  lang: ContentLang | null;
  sort: ExploreSort;
};

/** Keyset cursor of the last card on a page (see search_projects). */
export type ExploreCursor = { e: number; p: string; i: string };

export const MAX_QUERY_LENGTH = 200;
const MAX_LIST = 10;
const slugPattern = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export const emptyFilters: ExploreFilters = {
  q: "",
  tools: [],
  categories: [],
  lang: null,
  sort: "worth_it",
};

type SearchParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function slugList(value: string | string[] | undefined) {
  const raw = Array.isArray(value) ? value.join(",") : (value ?? "");
  const slugs = raw
    .split(",")
    .map((slug) => slug.trim().toLowerCase())
    .filter((slug) => slugPattern.test(slug) && slug.length <= 60);
  return [...new Set(slugs)].slice(0, MAX_LIST).sort();
}

/** Lenient: unknown or malformed values are dropped, never an error page. */
export function parseExploreParams(params: SearchParams): ExploreFilters {
  const lang = first(params.lang);
  return {
    q: (first(params.q) ?? "").trim().replace(/\s+/g, " ").slice(0, MAX_QUERY_LENGTH),
    tools: slugList(params.tools),
    categories: slugList(params.category),
    lang: lang === "id" || lang === "en" ? lang : null,
    sort: first(params.sort) === "new" ? "new" : "worth_it",
  };
}

/** "/explore?…" for a filter state; defaults are left out so URLs stay short. */
export function exploreHref(filters: ExploreFilters) {
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  if (filters.tools.length > 0) params.set("tools", [...filters.tools].sort().join(","));
  if (filters.categories.length > 0) {
    params.set("category", [...filters.categories].sort().join(","));
  }
  if (filters.lang) params.set("lang", filters.lang);
  if (filters.sort !== "worth_it") params.set("sort", filters.sort);
  const query = params.toString().replaceAll("%2C", ",");
  return query ? `/explore?${query}` : "/explore";
}

export function activeFilterCount(filters: ExploreFilters) {
  return filters.tools.length + filters.categories.length + (filters.lang ? 1 : 0);
}

export function toggle(list: string[], value: string) {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value].sort();
}
