"use server";

import { z } from "zod";
import { searchProjects, type ProjectPage } from "./discovery";
import { MAX_QUERY_LENGTH, parseExploreParams } from "./explore-params";

const requestSchema = z.object({
  filters: z.object({
    q: z.string().max(MAX_QUERY_LENGTH),
    tools: z.array(z.string().max(60)).max(10),
    categories: z.array(z.string().max(60)).max(10),
    lang: z.enum(["id", "en"]).nullable(),
    sort: z.enum(["worth_it", "new"]),
  }),
  cursor: z.object({
    e: z.number().int().min(0),
    p: z.iso.datetime({ offset: true }),
    i: z.uuid(),
  }),
});

/** "Muat obrolan lainnya": the next page for the same filters. Public data, no session needed. */
export async function loadMoreProjects(request: unknown): Promise<ProjectPage | null> {
  const parsed = requestSchema.safeParse(request);
  if (!parsed.success) return null;
  const { filters, cursor } = parsed.data;

  // Same normalization as the page, so both share cache entries.
  const normalized = parseExploreParams({
    q: filters.q,
    tools: filters.tools.join(","),
    category: filters.categories.join(","),
    lang: filters.lang ?? undefined,
    sort: filters.sort,
  });
  return searchProjects(normalized, cursor);
}
