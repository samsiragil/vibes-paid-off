import "server-only";
import { createClient } from "@/lib/supabase/server";

/**
 * The signed-in user's vote on a project and the live counter, per request (the public page and
 * its counter are cached). Null when the project is not readable to them (no longer published).
 */
export async function getViewerVote(
  projectId: string,
  userId: string,
): Promise<{ voted: boolean; count: number } | null> {
  const supabase = await createClient();
  const [project, vote] = await Promise.all([
    supabase.from("projects").select("upvote_count").eq("id", projectId).maybeSingle(),
    supabase
      .from("upvotes")
      .select("project_id")
      .eq("project_id", projectId)
      .eq("user_id", userId)
      .maybeSingle(),
  ]);
  if (!project.data) return null;
  return { voted: Boolean(vote.data), count: project.data.upvote_count };
}

/** `/id/login?next=/id/p/kasir#balasan`: log in, then come back to the same spot. */
export function loginHref(locale: string, next: string) {
  return `/${locale}/login?next=${encodeURIComponent(next)}`;
}

/** Same as loginHref for users who still need to pick a username. */
export function onboardingHref(locale: string, next: string) {
  return `/${locale}/onboarding?next=${encodeURIComponent(next)}`;
}
