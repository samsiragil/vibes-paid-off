"use server";

import { revalidateTag, updateTag } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { LISTINGS_TAG, makerTag, projectTag, repliesTag } from "@/lib/cache-tags";
import { getCurrentUser } from "@/lib/auth/current-user";
import { createClient } from "@/lib/supabase/server";
import { verifyTurnstile } from "@/lib/turnstile";
import { replyBodySchema, reportSchema, type ReplyErrorCode } from "@/lib/validation/interactions";
import type { ReplyView } from "./replies";

// Worth it, replies and reports from the project page (Fase 7). RLS and triggers decide who may
// do what (one vote per account, no voting on your own project, 30 replies a day, one report per
// account and target, auto-hide at three); these actions validate input, check Turnstile on new
// replies and refresh the cached pages that show the result.

const uuid = z.uuid();

async function currentUserId() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  return { supabase, userId: data?.claims?.sub ?? null };
}

// ---------------------------------------------------------------------------
// Worth it
// ---------------------------------------------------------------------------

export type WorthItResult =
  | { ok: true; voted: boolean; count: number }
  | { ok: false; error: "unauthorized" | "own_project" | "unavailable" | "invalid" | "failed" };

/**
 * Sets the signed-in user's vote to `voted` (idempotent, so a double click or a retry cannot
 * vote twice) and returns the stored state with the live counter.
 */
export async function setWorthIt(projectId: string, voted: boolean): Promise<WorthItResult> {
  if (!uuid.safeParse(projectId).success || typeof voted !== "boolean") {
    return { ok: false, error: "invalid" };
  }
  const { supabase, userId } = await currentUserId();
  if (!userId) return { ok: false, error: "unauthorized" };

  if (voted) {
    const { error } = await supabase.from("upvotes").insert({ project_id: projectId });
    // 23505: already voted, which is the state we want.
    if (error && error.code !== "23505") {
      if (error.message === "upvote_own_project") return { ok: false, error: "own_project" };
      // 42501: the project is not published (in review, hidden, removed).
      if (error.code === "42501") return { ok: false, error: "unavailable" };
      console.error("upvote insert failed", error);
      return { ok: false, error: "failed" };
    }
  } else {
    const { error } = await supabase
      .from("upvotes")
      .delete()
      .eq("project_id", projectId)
      .eq("user_id", userId);
    if (error) {
      console.error("upvote delete failed", error);
      return { ok: false, error: "failed" };
    }
  }

  const { data: project } = await supabase
    .from("projects")
    .select("upvote_count, owner_id")
    .eq("id", projectId)
    .maybeSingle();
  if (!project) return { ok: false, error: "unavailable" };

  // The counter on the project page, cards in every list, and the maker's "worth it" total.
  updateTag(projectTag(projectId));
  updateTag(makerTag(project.owner_id));
  updateTag(LISTINGS_TAG);
  return { ok: true, voted, count: project.upvote_count };
}

// ---------------------------------------------------------------------------
// Replies
// ---------------------------------------------------------------------------

export type PostReplyResult =
  | { ok: true; reply: ReplyView }
  | {
      ok: false;
      error:
        | "unauthorized"
        | "username_required"
        | "captcha"
        | "rate_limit"
        | "unavailable"
        | "invalid"
        | "failed";
      fieldError?: ReplyErrorCode;
    };

const postReplySchema = z.object({
  projectId: z.uuid(),
  body: z.string(),
  turnstileToken: z.string().max(4096).optional(),
});

/** Posts a one-level reply under a published project. */
export async function postReply(request: {
  projectId: string;
  body: string;
  turnstileToken?: string;
}): Promise<PostReplyResult> {
  const parsedRequest = postReplySchema.safeParse(request);
  if (!parsedRequest.success) return { ok: false, error: "invalid" };
  const { projectId, turnstileToken } = parsedRequest.data;

  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "unauthorized" };
  if (!user.username) return { ok: false, error: "username_required" };

  const body = replyBodySchema.safeParse(parsedRequest.data.body);
  if (!body.success) {
    const code = body.error.issues[0]?.message;
    return {
      ok: false,
      error: "invalid",
      fieldError: code === "too_long" ? "too_long" : "required",
    };
  }

  const headerList = await headers();
  const remoteIp =
    headerList.get("cf-connecting-ip") ??
    headerList.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    null;
  if (!(await verifyTurnstile(turnstileToken, remoteIp))) return { ok: false, error: "captcha" };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("comments")
    .insert({ project_id: projectId, body: body.data })
    .select("id, body, created_at")
    .single();

  if (error) {
    if (error.message.startsWith("rate_limit")) return { ok: false, error: "rate_limit" };
    if (error.message === "username_required") return { ok: false, error: "username_required" };
    // 42501: the project is not published any more.
    if (error.code === "42501") return { ok: false, error: "unavailable" };
    if (error.code?.startsWith("23")) return { ok: false, error: "invalid" };
    console.error("reply insert failed", error);
    return { ok: false, error: "failed" };
  }

  updateTag(repliesTag(projectId));
  // Replies count toward "Obrolan terpopuler minggu ini" (§2.7).
  updateTag(LISTINGS_TAG);
  return {
    ok: true,
    reply: {
      id: data.id,
      body: data.body,
      createdAt: data.created_at,
      author: {
        id: user.id,
        username: user.username,
        displayName: user.displayName || user.username,
        avatarUrl: user.avatarUrl,
      },
    },
  };
}

export type DeleteReplyResult =
  { ok: true } | { ok: false; error: "unauthorized" | "not_found" | "invalid" | "failed" };

/** Deletes one of the signed-in user's own replies. */
export async function deleteReply(replyId: string): Promise<DeleteReplyResult> {
  if (!uuid.safeParse(replyId).success) return { ok: false, error: "invalid" };
  const { supabase, userId } = await currentUserId();
  if (!userId) return { ok: false, error: "unauthorized" };

  const { data, error } = await supabase
    .from("comments")
    .delete()
    .eq("id", replyId)
    .eq("user_id", userId)
    .select("project_id");
  if (error) {
    console.error("reply delete failed", error);
    return { ok: false, error: "failed" };
  }
  const projectId = data[0]?.project_id;
  if (!projectId) return { ok: false, error: "not_found" };

  updateTag(repliesTag(projectId));
  updateTag(LISTINGS_TAG);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Reports
// ---------------------------------------------------------------------------

export type ReportResult =
  | { ok: true; targetHidden: boolean }
  | {
      ok: false;
      error:
        "unauthorized" | "already_reported" | "own_content" | "not_found" | "invalid" | "failed";
    };

const reportResultSchema = z.object({
  project_id: z.uuid(),
  owner_id: z.uuid(),
  target_hidden: z.boolean(),
});

/**
 * Reports a project or a reply with a reason and an optional note. The third report from a
 * different account hides the target at once (database trigger); the pages showing it follow.
 */
export async function reportContent(input: unknown): Promise<ReportResult> {
  const parsed = reportSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const { supabase, userId } = await currentUserId();
  if (!userId) return { ok: false, error: "unauthorized" };

  const { data, error } = await supabase.rpc("report_content", {
    p_target_type: parsed.data.targetType,
    p_target_id: parsed.data.targetId,
    p_reason: parsed.data.reason,
    p_note: parsed.data.note || undefined,
  });
  if (error) {
    if (error.code === "23505") return { ok: false, error: "already_reported" };
    if (error.message === "report_own_content") return { ok: false, error: "own_content" };
    if (error.message === "report_target_not_found") return { ok: false, error: "not_found" };
    console.error("report_content failed", error);
    return { ok: false, error: "failed" };
  }

  const result = reportResultSchema.safeParse(data);
  if (!result.success) return { ok: false, error: "failed" };
  const { project_id: projectId, owner_id: ownerId, target_hidden: hidden } = result.data;

  if (hidden) {
    // Gone for everyone on their next request. Not updateTag: the reporter keeps the page they
    // are on (with the confirmation) instead of having it swapped for a 404 under the dialog.
    const now = { expire: 0 };
    if (parsed.data.targetType === "project") {
      revalidateTag(projectTag(projectId), now);
      revalidateTag(makerTag(ownerId), now);
    } else {
      revalidateTag(repliesTag(projectId), now);
    }
    revalidateTag(LISTINGS_TAG, now);
  }
  return { ok: true, targetHidden: hidden };
}
