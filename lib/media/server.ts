import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { MediaErrorCode, ProjectMedia } from "./limits";

/** JSON error body for /api/media/*. */
export function mediaError(error: MediaErrorCode, status: number) {
  return Response.json({ error }, { status });
}

/**
 * Whether the request comes from one of our own pages. The media routes act on the session cookie
 * alone, so a cross-site form or fetch must not reach them (SameSite=Lax is the only other guard).
 */
export function isSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (!origin || !host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

/**
 * Counts one presign/finalize/autofill call against the account's hourly budget
 * (consume_media_quota). Returns false once the budget is spent.
 */
export async function consumeMediaQuota(
  supabase: UserClient,
  kind: "presign" | "finalize" | "autofill",
) {
  const { error } = await supabase.rpc("consume_media_quota", { p_kind: kind });
  if (!error) return true;
  if (error.message.startsWith("rate_limit")) return false;
  throw error;
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
