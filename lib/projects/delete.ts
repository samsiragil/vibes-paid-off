"use server";

import { updateTag } from "next/cache";
import { z } from "zod";
import {
  LISTINGS_TAG,
  TOOLS_TAG,
  makerTag,
  projectSlugTag,
  projectTag,
  repliesTag,
} from "@/lib/cache-tags";
import { deleteObjects } from "@/lib/r2/client";
import { createClient } from "@/lib/supabase/server";

export type DeleteProjectResult =
  { ok: true } | { ok: false; error: "unauthorized" | "forbidden" | "invalid" | "failed" };

const projectIdSchema = z.uuid();

/**
 * Deletes one of the signed-in maker's projects for good, from /me. The database checks
 * ownership and removes the project with everything under it (delete_project); the screenshots
 * are then deleted from R2.
 */
export async function deleteProject(projectId: string): Promise<DeleteProjectResult> {
  const id = projectIdSchema.safeParse(projectId);
  if (!id.success) return { ok: false, error: "invalid" };

  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;
  if (!userId) return { ok: false, error: "unauthorized" };

  // The slug is only needed to drop its cached page; ownership is checked by delete_project.
  const { data: project } = await supabase
    .from("projects")
    .select("slug")
    .eq("id", id.data)
    .maybeSingle();

  const { data: mediaKeys, error } = await supabase.rpc("delete_project", {
    p_project_id: id.data,
  });
  if (error) {
    if (error.code === "42501") return { ok: false, error: "forbidden" };
    console.error("delete_project failed", error);
    return { ok: false, error: "failed" };
  }

  updateTag(projectTag(id.data));
  if (project) updateTag(projectSlugTag(project.slug));
  updateTag(repliesTag(id.data));
  updateTag(makerTag(userId));
  updateTag(LISTINGS_TAG);
  updateTag(TOOLS_TAG);

  // The rows are gone either way; a failed object delete only leaves orphan files behind.
  await deleteObjects(mediaKeys).catch((cause) =>
    console.error("project media delete failed", mediaKeys, cause),
  );
  return { ok: true };
}
