"use server";

import { refresh, updateTag } from "next/cache";
import { after } from "next/server";
import { z } from "zod";
import {
  LISTINGS_TAG,
  makerTag,
  projectSlugTag,
  projectTag,
  repliesTag,
  TOOLS_TAG,
} from "@/lib/cache-tags";
import { getCurrentUser, isCurrentUserAdmin } from "@/lib/auth/current-user";
import { sendReviewEmail } from "@/lib/email/review";
import { isEmailConfigured } from "@/lib/email/send";
import { createClient } from "@/lib/supabase/server";
import {
  resolveReportSchema,
  reviewSchema,
  suggestionActionSchema,
  toolFormErrors,
  toolFormSchema,
  type ToolFormErrors,
} from "@/lib/validation/admin";

// Moderation from /admin (Fase 8). Every action checks the admin role here for a clear answer,
// and the database checks it again (admin RPCs raise not_allowed; tools RLS needs is_admin()).
// Public pages that show the result are invalidated with the same tags their loaders use.

type Denied = "unauthorized" | "forbidden";

async function adminGuard(): Promise<Denied | null> {
  if (!(await getCurrentUser())) return "unauthorized";
  if (!(await isCurrentUserAdmin())) return "forbidden";
  return null;
}

/** Everything that shows a project whose status changed (published or not). */
function invalidateProject(project: { id: string; slug: string; ownerId: string }) {
  updateTag(projectTag(project.id));
  updateTag(projectSlugTag(project.slug));
  updateTag(makerTag(project.ownerId));
  updateTag(LISTINGS_TAG);
  // tools.project_count counts published projects only.
  updateTag(TOOLS_TAG);
}

// ---------------------------------------------------------------------------
// Review queue
// ---------------------------------------------------------------------------

export type ReviewResult =
  | { ok: true; status: "published" | "rejected"; emailQueued: boolean }
  | { ok: false; error: Denied | "not_pending" | "note_required" | "invalid" | "failed" };

const reviewResultSchema = z.object({
  id: z.uuid(),
  slug: z.string(),
  owner_id: z.uuid(),
  status: z.enum(["published", "rejected"]),
  title: z.string(),
  content_lang: z.enum(["id", "en"]),
});

/** Approves (the maker becomes trusted) or rejects a pending project, then emails the maker. */
export async function reviewProject(input: unknown): Promise<ReviewResult> {
  const parsed = reviewSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const denied = await adminGuard();
  if (denied) return { ok: false, error: denied };

  const review = parsed.data;
  const note = review.approve ? undefined : review.note || undefined;
  if (!review.approve && review.code === "other" && !note) {
    return { ok: false, error: "note_required" };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_review_project", {
    p_project_id: review.projectId,
    p_approve: review.approve,
    p_reject_code: review.approve ? undefined : review.code,
    p_reject_note: note,
  });
  if (error) {
    if (error.code === "42501") return { ok: false, error: "forbidden" };
    if (error.message === "not_pending" || error.message === "project_not_found") {
      return { ok: false, error: "not_pending" };
    }
    if (error.message === "reject_note_required") return { ok: false, error: "note_required" };
    console.error("admin_review_project failed", error);
    return { ok: false, error: "failed" };
  }

  const result = reviewResultSchema.safeParse(data);
  if (!result.success) return { ok: false, error: "failed" };
  const project = result.data;

  invalidateProject({ id: project.id, slug: project.slug, ownerId: project.owner_id });
  after(() =>
    sendReviewEmail({
      ownerId: project.owner_id,
      slug: project.slug,
      title: project.title,
      locale: project.content_lang,
      verdict: review.approve
        ? { approved: true }
        : { approved: false, code: review.code, note: note ?? null },
    }),
  );
  refresh();
  return { ok: true, status: project.status, emailQueued: isEmailConfigured() };
}

// ---------------------------------------------------------------------------
// Reports and trust
// ---------------------------------------------------------------------------

export type ResolveReportResult =
  { ok: true } | { ok: false; error: Denied | "already_resolved" | "invalid" | "failed" };

const resolveResultSchema = z.object({
  project_id: z.uuid().nullable(),
  owner_id: z.uuid().nullable(),
  slug: z.string().nullable(),
});

/** Closes every open report on a project or reply with one verdict (keep, hide, remove). */
export async function resolveReport(input: unknown): Promise<ResolveReportResult> {
  const parsed = resolveReportSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const denied = await adminGuard();
  if (denied) return { ok: false, error: denied };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_resolve_report", {
    p_target_type: parsed.data.targetType,
    p_target_id: parsed.data.targetId,
    p_action: parsed.data.action,
  });
  if (error) {
    if (error.code === "42501") return { ok: false, error: "forbidden" };
    if (error.message === "no_open_reports") return { ok: false, error: "already_resolved" };
    console.error("admin_resolve_report failed", error);
    return { ok: false, error: "failed" };
  }

  const result = resolveResultSchema.safeParse(data);
  if (result.success && result.data.project_id) {
    const { project_id: id, owner_id: ownerId, slug } = result.data;
    if (parsed.data.targetType === "project" && ownerId && slug) {
      invalidateProject({ id, slug, ownerId });
    } else {
      updateTag(repliesTag(id));
      // Repliers count toward "Obrolan terpopuler minggu ini" (§2.7).
      updateTag(LISTINGS_TAG);
    }
  }
  refresh();
  return { ok: true };
}

export type SetTrustedResult = { ok: true } | { ok: false; error: Denied | "invalid" | "failed" };

const trustSchema = z.object({ profileId: z.uuid(), trusted: z.boolean() });

/** Grants or revokes "Maker terpercaya" (an untrusted maker's next project is reviewed). */
export async function setMakerTrusted(input: unknown): Promise<SetTrustedResult> {
  const parsed = trustSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const denied = await adminGuard();
  if (denied) return { ok: false, error: denied };

  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_set_trusted", {
    p_profile_id: parsed.data.profileId,
    p_trusted: parsed.data.trusted,
  });
  if (error) {
    if (error.code === "42501") return { ok: false, error: "forbidden" };
    console.error("admin_set_trusted failed", error);
    return { ok: false, error: "failed" };
  }

  // The badge on the profile and on the maker's project pages.
  updateTag(makerTag(parsed.data.profileId));
  refresh();
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Tools catalog
// ---------------------------------------------------------------------------

export type SaveToolResult =
  | { ok: true; id: number }
  | {
      ok: false;
      error: Denied | "invalid" | "slug_taken" | "not_found" | "failed";
      fieldErrors?: ToolFormErrors;
    };

const toolIdSchema = z.number().int().positive().nullable();

/** Adds a tool (`toolId` null) or edits one. Inactive tools leave the picker and filters. */
export async function saveTool(toolId: number | null, values: unknown): Promise<SaveToolResult> {
  const id = toolIdSchema.safeParse(toolId);
  const parsed = toolFormSchema.safeParse(values);
  if (!id.success) return { ok: false, error: "invalid" };
  if (!parsed.success) {
    return { ok: false, error: "invalid", fieldErrors: toolFormErrors(parsed.error) };
  }
  const denied = await adminGuard();
  if (denied) return { ok: false, error: denied };

  const tool = parsed.data;
  const row = {
    name: tool.name,
    slug: tool.slug,
    url: tool.url || null,
    logo_url: tool.logoUrl || null,
    kind: tool.kind,
    description_id: tool.descriptionId,
    description_en: tool.descriptionEn,
    is_active: tool.isActive,
  };

  const supabase = await createClient();
  const { data, error } =
    id.data === null
      ? await supabase.from("tools").insert(row).select("id").single()
      : await supabase.from("tools").update(row).eq("id", id.data).select("id").maybeSingle();

  if (error) {
    if (error.code === "23505") {
      return { ok: false, error: "slug_taken", fieldErrors: { slug: "invalid_slug" } };
    }
    if (error.code === "42501") return { ok: false, error: "forbidden" };
    console.error("save tool failed", error);
    return { ok: false, error: "failed" };
  }
  if (!data) return { ok: false, error: "not_found" };

  // Tool pages, filters and the picker; tool names on cards and project pages follow.
  updateTag(TOOLS_TAG);
  updateTag(LISTINGS_TAG);
  refresh();
  return { ok: true, id: data.id };
}

export type ResolveSuggestionResult =
  | { ok: true }
  | {
      ok: false;
      error: Denied | "invalid" | "slug_taken" | "already_resolved" | "tool_not_found" | "failed";
      fieldErrors?: ToolFormErrors;
    };

const suggestionResultSchema = z.object({ project_ids: z.array(z.uuid()) });

/**
 * Resolves all pending suggestions with one name: merge into a catalog tool, create a new tool
 * from them, or reject. Merging links the tool to every project that suggested the name.
 */
export async function resolveToolSuggestion(input: unknown): Promise<ResolveSuggestionResult> {
  const parsed = suggestionActionSchema.safeParse(input);
  if (!parsed.success) {
    // A new tool's form: report its fields like saveTool does.
    const tool =
      input && typeof input === "object" && "tool" in input
        ? toolFormSchema.safeParse(input.tool)
        : null;
    return {
      ok: false,
      error: "invalid",
      fieldErrors: tool && !tool.success ? toolFormErrors(tool.error) : undefined,
    };
  }
  const denied = await adminGuard();
  if (denied) return { ok: false, error: denied };

  const request = parsed.data;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_resolve_tool_suggestions", {
    p_name: request.name,
    p_action: request.action,
    p_tool_id: request.action === "merge" ? request.toolId : undefined,
    p_new_tool:
      request.action === "create"
        ? {
            slug: request.tool.slug,
            name: request.tool.name,
            url: request.tool.url,
            logo_url: request.tool.logoUrl,
            kind: request.tool.kind,
            description_id: request.tool.descriptionId,
            description_en: request.tool.descriptionEn,
          }
        : undefined,
  });
  if (error) {
    if (error.code === "42501") return { ok: false, error: "forbidden" };
    if (error.code === "23505") {
      return { ok: false, error: "slug_taken", fieldErrors: { slug: "invalid_slug" } };
    }
    if (error.message === "no_pending_suggestions") return { ok: false, error: "already_resolved" };
    if (error.message === "tool_not_found") return { ok: false, error: "tool_not_found" };
    console.error("admin_resolve_tool_suggestions failed", error);
    return { ok: false, error: "failed" };
  }

  const result = suggestionResultSchema.safeParse(data);
  for (const projectId of result.success ? result.data.project_ids : []) {
    updateTag(projectTag(projectId));
  }
  updateTag(TOOLS_TAG);
  updateTag(LISTINGS_TAG);
  refresh();
  return { ok: true };
}
