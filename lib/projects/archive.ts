"use server";

import { updateTag } from "next/cache";
import { z } from "zod";
import { LISTINGS_TAG, makerTag, projectTag } from "@/lib/cache-tags";
import { createClient } from "@/lib/supabase/server";
import type { LinkStatus } from "./types";

export type ArchiveProjectResult =
  | { ok: true; linkStatus: LinkStatus }
  | { ok: false; error: "unauthorized" | "forbidden" | "invalid" | "failed" };

const requestSchema = z.object({ projectId: z.uuid(), archived: z.boolean() });

/**
 * Archives (or reactivates) one of the signed-in maker's projects from /me (Q8). The database
 * checks ownership (set_project_archived); the project page and profile cards update at once.
 */
export async function setProjectArchived(
  projectId: string,
  archived: boolean,
): Promise<ArchiveProjectResult> {
  const input = requestSchema.safeParse({ projectId, archived });
  if (!input.success) return { ok: false, error: "invalid" };

  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;
  if (!userId) return { ok: false, error: "unauthorized" };

  const { data, error } = await supabase.rpc("set_project_archived", {
    p_project_id: input.data.projectId,
    p_archived: input.data.archived,
  });
  if (error) {
    if (error.code === "42501") return { ok: false, error: "forbidden" };
    console.error("set_project_archived failed", error);
    return { ok: false, error: "failed" };
  }

  updateTag(projectTag(input.data.projectId));
  updateTag(makerTag(userId));
  // Card labels and the home hero (archived projects are not featured).
  updateTag(LISTINGS_TAG);
  return { ok: true, linkStatus: data };
}
