import "server-only";
import { getProjectMedia } from "@/lib/media/server";
import type { ProjectMedia } from "@/lib/media/limits";
import { createClient } from "@/lib/supabase/server";
import type { ProjectInput } from "@/lib/validation/project";
import type { ContentLang, ProjectStatus } from "./types";

export type EditableProject = {
  id: string;
  slug: string;
  status: ProjectStatus;
  rejectCode: string | null;
  rejectReason: string | null;
  project: ProjectInput;
  media: ProjectMedia[];
};

/**
 * A project the given user owns, in the shape of the submit form, or null when it does not
 * exist, is not theirs, or was removed. RLS already limits what the user can read.
 */
export async function getEditableProject(
  slug: string,
  userId: string,
): Promise<EditableProject | null> {
  const supabase = await createClient();
  const { data: row } = await supabase
    .from("projects")
    .select(
      "id, slug, owner_id, status, reject_code, reject_reason, title, tagline, description, key_prompt, lessons, live_url, repo_url, video_url, category, content_lang",
    )
    .eq("slug", slug)
    .maybeSingle();
  if (!row || row.owner_id !== userId || row.status === "removed") return null;

  const [sessions, tools, suggestions, media] = await Promise.all([
    supabase
      .from("project_sessions")
      .select("id, label, duration_hours, prompt, result, challenge, solution")
      .eq("project_id", row.id)
      .order("sort_order"),
    supabase.from("project_tools").select("tool_id").eq("project_id", row.id),
    supabase
      .from("tool_suggestions")
      .select("name, url")
      .eq("project_id", row.id)
      .eq("status", "pending")
      .order("created_at"),
    getProjectMedia(row.id),
  ]);

  return {
    id: row.id,
    slug: row.slug,
    status: row.status,
    rejectCode: row.reject_code,
    rejectReason: row.reject_reason,
    media,
    project: {
      keyPrompt: row.key_prompt,
      title: row.title,
      tagline: row.tagline,
      description: row.description,
      liveUrl: row.live_url,
      repoUrl: row.repo_url ?? "",
      videoUrl: row.video_url ?? "",
      category: row.category,
      contentLang: row.content_lang as ContentLang,
      toolIds: (tools.data ?? []).map((tool) => tool.tool_id),
      suggestions: (suggestions.data ?? []).map((suggestion) => ({
        name: suggestion.name,
        url: suggestion.url ?? "",
      })),
      sessions: (sessions.data ?? []).map((session) => ({
        id: session.id,
        label: session.label ?? "",
        durationHours: Number(session.duration_hours),
        prompt: session.prompt,
        result: session.result,
        challenge: session.challenge ?? "",
        solution: session.solution ?? "",
      })),
      lessons: row.lessons ?? "",
    },
  };
}
