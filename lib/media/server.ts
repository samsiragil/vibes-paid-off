import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { MediaErrorCode, ProjectMedia } from "./limits";

/** JSON error body for /api/media/*. */
export function mediaError(error: MediaErrorCode, status: number) {
  return Response.json({ error }, { status });
}

/** The signed-in user's id and a client acting as them, or null. */
export async function currentUserClient() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  return userId ? { supabase, userId } : null;
}

type UserClient = Awaited<ReturnType<typeof createClient>>;

/** Whether the user may edit the project's media, and how many images it already has. */
export async function projectMediaQuota(supabase: UserClient, projectId: string) {
  const [{ data: canEdit }, { count }] = await Promise.all([
    supabase.rpc("can_edit_project", { p_project_id: projectId }),
    supabase
      .from("project_media")
      .select("id", { count: "exact", head: true })
      .eq("project_id", projectId),
  ]);
  return { canEdit: canEdit === true, count: count ?? 0 };
}

/** A project's images in display order (for the edit form and project pages). */
export async function getProjectMedia(projectId: string): Promise<ProjectMedia[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("project_media")
    .select("id, r2_key, width, height")
    .eq("project_id", projectId)
    .order("sort_order");
  return (data ?? []).map((row) => ({
    id: row.id,
    key: row.r2_key,
    width: row.width,
    height: row.height,
  }));
}
