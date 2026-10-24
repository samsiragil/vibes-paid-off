"use server";

import { updateTag } from "next/cache";
import { z } from "zod";
import { LISTINGS_TAG, makerTag, projectSlugTag, projectTag, TOOLS_TAG } from "@/lib/cache-tags";
import { slugify } from "@/lib/slug";
import { createClient } from "@/lib/supabase/server";
import { verifyTurnstile } from "@/lib/turnstile";
import {
  projectFieldErrors,
  projectSchema,
  toUpsertPayload,
  type ProjectFieldErrors,
} from "@/lib/validation/project";
import type { ProjectStatus } from "./types";

export type SaveProjectError =
  "unauthorized" | "captcha" | "rate_limit" | "forbidden" | "invalid" | "failed";

export type SaveProjectResult =
  | { ok: true; id: string; slug: string; status: ProjectStatus }
  | { ok: false; error: SaveProjectError; fieldErrors?: ProjectFieldErrors };

const requestSchema = z.object({
  /** Set on the edit page; omitted to create a project. */
  projectId: z.uuid().optional(),
  turnstileToken: z.string().max(4096).optional(),
  project: z.unknown(),
});

const projectIdSchema = z.uuid();

const resultSchema = z.object({
  id: z.uuid(),
  slug: z.string(),
  status: z.enum(["pending", "published", "hidden", "rejected", "removed"]),
});

/**
 * Creates or edits a project with its tools in one transaction (upsert_project).
 * The database decides status (pending, or published for trusted makers), rate limits and
 * ownership; this action validates input and checks Turnstile on new submissions.
 */
export async function saveProject(request: {
  projectId?: string;
  turnstileToken?: string;
  project: unknown;
}): Promise<SaveProjectResult> {
  const parsedRequest = requestSchema.safeParse(request);
  if (!parsedRequest.success) return { ok: false, error: "invalid" };
  const { projectId, turnstileToken } = parsedRequest.data;

  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) return { ok: false, error: "unauthorized" };

  const parsed = projectSchema.safeParse(parsedRequest.data.project);
  if (!parsed.success) {
    return { ok: false, error: "invalid", fieldErrors: projectFieldErrors(parsed.error) };
  }

  if (!projectId) {
    if (!(await verifyTurnstile(turnstileToken, "submit_project")))
      return { ok: false, error: "captcha" };
  }

  const { data, error } = await supabase.rpc("upsert_project", {
    p_project: toUpsertPayload(parsed.data),
    ...(projectId ? { p_project_id: projectId } : { p_slug_base: slugify(parsed.data.title) }),
  });

  if (error) {
    if (error.message.startsWith("rate_limit")) return { ok: false, error: "rate_limit" };
    if (error.message === "ai_tool_required") {
      return { ok: false, error: "invalid", fieldErrors: { toolIds: "ai_tool_required" } };
    }
    // 42501: not the owner (or no username yet); the rest: input the checks or triggers rejected.
    if (error.code === "42501") return { ok: false, error: "forbidden" };
    if (["22023", "22P02", "P0001"].includes(error.code) || error.code?.startsWith("23")) {
      return { ok: false, error: "invalid" };
    }
    console.error("upsert_project failed", error);
    return { ok: false, error: "failed" };
  }

  const saved = resultSchema.safeParse(data);
  if (!saved.success) return { ok: false, error: "failed" };

  // Public pages read cached data: the project page, its slug lookup (a new or re-approved
  // project stops being a cached 404) and the maker's profile list and stats.
  updateTag(projectTag(saved.data.id));
  updateTag(projectSlugTag(saved.data.slug));
  updateTag(makerTag(claims.claims.sub));
  // Published projects also show in home/explore/tools lists and in the tool counts.
  if (saved.data.status === "published") {
    updateTag(LISTINGS_TAG);
    updateTag(TOOLS_TAG);
  }
  return { ok: true, ...saved.data };
}

/**
 * "Nanti aja" on the /me nudge to add a build story: it stops showing for that project. RLS
 * limits the update to the owner's own projects; the column is not content, so it never sends a
 * project back to review.
 */
export async function dismissStoryNudge(projectId: string): Promise<{ ok: boolean }> {
  const parsed = projectIdSchema.safeParse(projectId);
  if (!parsed.success) return { ok: false };

  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) return { ok: false };

  const { error } = await supabase
    .from("projects")
    .update({ story_nudge_dismissed_at: new Date().toISOString() })
    .eq("id", parsed.data)
    .eq("owner_id", claims.claims.sub);
  if (error) {
    console.error("dismissStoryNudge failed", error);
    return { ok: false };
  }
  return { ok: true };
}
