import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { createPublicClient } from "@/lib/supabase/public";
import type { CatalogTool } from "./types";

/**
 * Shown as quick chips while there are no published projects to rank by (§2.8: the 8 most
 * popular tools). Real usage (tools.project_count) wins once projects exist.
 */
const quickPickFallback = [
  "claude-code",
  "cursor",
  "lovable",
  "bolt",
  "v0",
  "replit",
  "chatgpt",
  "supabase",
];

export const QUICK_PICK_COUNT = 8;

/** Active tools for the picker, most used first. Cached; tag "tools". */
export async function getToolCatalog(): Promise<CatalogTool[]> {
  "use cache";
  cacheLife("hours");
  cacheTag("tools");

  const { data, error } = await createPublicClient()
    .from("tools")
    .select("id, slug, name, kind, project_count")
    .eq("is_active", true)
    .order("name");
  if (error) throw new Error(`Could not load tools: ${error.message}`);

  return data.map((tool) => ({
    id: tool.id,
    slug: tool.slug,
    name: tool.name,
    kind: tool.kind,
    projectCount: tool.project_count,
  }));
}

/** Ids of the quick-pick chips: most used first, the fallback list breaks ties. */
export function quickPickIds(tools: CatalogTool[]) {
  const rank = (slug: string) => {
    const index = quickPickFallback.indexOf(slug);
    return index === -1 ? quickPickFallback.length : index;
  };
  return [...tools]
    .sort(
      (a, b) =>
        b.projectCount - a.projectCount ||
        rank(a.slug) - rank(b.slug) ||
        a.name.localeCompare(b.name),
    )
    .slice(0, QUICK_PICK_COUNT)
    .map((tool) => tool.id);
}

/** Category slugs in display order (labels: messages categories.<slug>). Cached; tag "categories". */
export async function getCategories(): Promise<string[]> {
  "use cache";
  cacheLife("days");
  cacheTag("categories");

  const { data, error } = await createPublicClient()
    .from("categories")
    .select("slug")
    .order("sort_order");
  if (error) throw new Error(`Could not load categories: ${error.message}`);
  return data.map((category) => category.slug);
}
