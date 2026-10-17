import type { MetadataRoute } from "next";
import { cacheLife, cacheTag } from "next/cache";
import { routing } from "@/i18n/routing";
import { LISTINGS_TAG, TOOLS_TAG } from "@/lib/cache-tags";
import { localeUrl } from "@/lib/seo";
import { createPublicClient } from "@/lib/supabase/public";

type Page = { path: string; lastModified?: string };

const staticPaths = ["", "/explore", "/tools", "/support", "/rules"];

/** Every public page: published projects, profiles with at least one, and every active tool. */
async function getPublicPages(): Promise<Page[]> {
  "use cache";
  cacheLife("hours");
  cacheTag(LISTINGS_TAG, TOOLS_TAG);

  const supabase = createPublicClient();
  const [projects, tools] = await Promise.all([
    supabase
      .from("projects")
      .select("slug, updated_at, owner:profiles!projects_owner_id_fkey (username)")
      .eq("status", "published")
      .order("published_at", { ascending: false }),
    supabase.from("tools").select("slug").eq("is_active", true).order("slug"),
  ]);
  if (projects.error) throw new Error(`Could not load projects: ${projects.error.message}`);
  if (tools.error) throw new Error(`Could not load tools: ${tools.error.message}`);

  // A profile changes when one of its projects does; keep the newest date per maker.
  const profiles = new Map<string, string>();
  for (const project of projects.data) {
    const username = project.owner?.username;
    if (!username) continue;
    const known = profiles.get(username);
    if (!known || known < project.updated_at) profiles.set(username, project.updated_at);
  }

  return [
    ...staticPaths.map((path) => ({ path })),
    ...projects.data.map((project) => ({
      path: `/p/${project.slug}`,
      lastModified: project.updated_at,
    })),
    ...[...profiles].map(([username, lastModified]) => ({ path: `/u/${username}`, lastModified })),
    ...tools.data.map((tool) => ({ path: `/tools/${tool.slug}` })),
  ];
}

// One entry per page and language, each listing all its language versions (hreflang, §2.5).
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const pages = await getPublicPages();
  return pages.flatMap(({ path, lastModified }) => {
    const languages = Object.fromEntries(
      routing.locales.map((locale) => [locale, localeUrl(locale, path)]),
    );
    return routing.locales.map((locale) => ({
      url: localeUrl(locale, path),
      ...(lastModified ? { lastModified } : {}),
      alternates: { languages },
    }));
  });
}
