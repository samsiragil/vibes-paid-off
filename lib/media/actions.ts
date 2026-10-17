"use server";

import { updateTag } from "next/cache";
import { z } from "zod";
import { LISTINGS_TAG, makerTag, projectTag } from "@/lib/cache-tags";
import { deleteObjects } from "@/lib/r2/client";
import { createClient } from "@/lib/supabase/server";
import { MAX_MEDIA_PER_PROJECT } from "./limits";

export type MediaActionResult =
  { ok: true } | { ok: false; error: "forbidden" | "invalid" | "failed" };

const mediaIdSchema = z.uuid();
type UserClient = Awaited<ReturnType<typeof createClient>>;

/** Media changes show on the project page and on the cover of every card. */
async function invalidateProjectMedia(supabase: UserClient, projectId: string) {
  updateTag(projectTag(projectId));
  updateTag(LISTINGS_TAG);
  const { data } = await supabase.auth.getClaims();
  if (data?.claims?.sub) updateTag(makerTag(data.claims.sub));
}

const reorderSchema = z.object({
  projectId: z.uuid(),
  mediaIds: z.array(z.uuid()).min(1).max(MAX_MEDIA_PER_PROJECT),
});

/** Deletes one image of a project the user owns. The rest shift down (trigger in the database). */
export async function deleteProjectMedia(mediaId: string): Promise<MediaActionResult> {
  const id = mediaIdSchema.safeParse(mediaId);
  if (!id.success) return { ok: false, error: "invalid" };

  const supabase = await createClient();
  // RLS limits the delete to the owner's images; no row back means not allowed (or already gone).
  const { data, error } = await supabase
    .from("project_media")
    .delete()
    .eq("id", id.data)
    .select("r2_key, project_id")
    .maybeSingle();
  if (error) return { ok: false, error: "failed" };
  if (!data) return { ok: false, error: "forbidden" };
  await invalidateProjectMedia(supabase, data.project_id);

  // The row is gone either way; a failed object delete only leaves an orphan file behind.
  await deleteObjects([data.r2_key]).catch((cause) =>
    console.error("media object delete failed", data.r2_key, cause),
  );
  return { ok: true };
}

/** Saves a new image order. `mediaIds` must list every image of the project once. */
export async function reorderProjectMedia(
  projectId: string,
  mediaIds: string[],
): Promise<MediaActionResult> {
  const input = reorderSchema.safeParse({ projectId, mediaIds });
  if (!input.success) return { ok: false, error: "invalid" };

  const supabase = await createClient();
  const { error } = await supabase.rpc("reorder_project_media", {
    p_project_id: input.data.projectId,
    p_media_ids: input.data.mediaIds,
  });
  if (!error) {
    await invalidateProjectMedia(supabase, input.data.projectId);
    return { ok: true };
  }
  if (error.code === "42501") return { ok: false, error: "forbidden" };
  if (error.code === "22023") return { ok: false, error: "invalid" };
  return { ok: false, error: "failed" };
}
