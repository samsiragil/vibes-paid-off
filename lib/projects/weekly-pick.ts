import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { LISTINGS_TAG } from "@/lib/cache-tags";
import { createPublicClient } from "@/lib/supabase/public";

export type PickExampleCandidate = {
  /** Null when the project is no longer public (hidden, removed): shown without a name. */
  title: string | null;
  slug: string | null;
  score: number;
  eligibleVotes: number;
  eligibleRepliers: number;
  winner: boolean;
};

/** The newest stored "Pilihan minggu ini" (§2.7 B), for the worked example on /support. */
export type PickExample = {
  /** Monday the pick was computed for; it scored the Monday–Sunday before it. */
  weekStart: string;
  minScore: number;
  /** Top candidates in rank order (at most 5); empty when nobody reached the minimum score. */
  candidates: PickExampleCandidate[];
};

/** Null until the weekly job has run once. Cached; tag "listings". */
export async function getLatestWeeklyPick(): Promise<PickExample | null> {
  "use cache";
  cacheLife("hours");
  cacheTag(LISTINGS_TAG);

  const supabase = createPublicClient();
  const { data: row, error } = await supabase
    .from("weekly_picks")
    .select("week_start, project_id, breakdown")
    .order("week_start", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`Could not load weekly pick: ${error.message}`);
  if (!row) return null;

  const breakdown = (row.breakdown ?? {}) as Record<string, unknown>;
  const stored = Array.isArray(breakdown.candidates) ? breakdown.candidates : [];
  const candidates = stored.flatMap((candidate) => {
    if (!candidate || typeof candidate !== "object") return [];
    const item = candidate as Record<string, unknown>;
    if (typeof item.project_id !== "string") return [];
    return [
      {
        projectId: item.project_id,
        score: Number(item.score ?? 0),
        eligibleVotes: Number(item.eligible_votes ?? 0),
        eligibleRepliers: Number(item.eligible_repliers ?? 0),
      },
    ];
  });

  // RLS only returns published projects, so hidden ones stay nameless.
  const titles = new Map<string, { title: string; slug: string }>();
  if (candidates.length > 0) {
    const { data: projects, error: projectsError } = await supabase
      .from("projects")
      .select("id, slug, title")
      .in(
        "id",
        candidates.map((candidate) => candidate.projectId),
      );
    if (projectsError) throw new Error(`Could not load projects: ${projectsError.message}`);
    for (const project of projects) titles.set(project.id, project);
  }

  return {
    weekStart: row.week_start,
    minScore: typeof breakdown.min_score === "number" ? breakdown.min_score : 3,
    candidates: candidates.map(({ projectId, ...candidate }) => ({
      ...candidate,
      title: titles.get(projectId)?.title ?? null,
      slug: titles.get(projectId)?.slug ?? null,
      winner: projectId === row.project_id,
    })),
  };
}
