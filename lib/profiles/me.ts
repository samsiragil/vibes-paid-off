import "server-only";
import type { LinkStatus, ProjectStatus } from "@/lib/projects/types";
import { createClient } from "@/lib/supabase/server";
import type { ProfileFormValues } from "@/lib/validation/profile";
import { parseProfileLinks } from "./public";
import { SOCIAL_KEYS, socialInputValue } from "./social";

const RECENT_APPROVAL_MS = 7 * 24 * 3_600_000;
/** "Ceritain dong" nudge: a published project without a story, once people noticed it… */
const NUDGE_MIN_UPVOTES = 10;
/** …or once it has been live this long. */
const NUDGE_AFTER_MS = 7 * 24 * 3_600_000;

export type MyProject = {
  id: string;
  slug: string;
  title: string;
  keyPrompt: string;
  status: ProjectStatus;
  rejectCode: string | null;
  rejectReason: string | null;
  /** Approved by an admin within the last week (the "Kabar baik" notice on /me). */
  recentlyApproved: boolean;
  linkStatus: LinkStatus;
  lastCheckedAt: string | null;
  upvoteCount: number;
  commentCount: number;
  coverKey: string | null;
  /**
   * Published without a build story, with enough Worth it (or long enough live) that people
   * will want one, and the maker has not said "nanti aja" yet.
   */
  storyNudge: boolean;
};

/** The signed-in user's projects in every state but removed, newest first (dashboard table). */
export async function getMyProjects(userId: string): Promise<MyProject[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("projects")
    .select(
      "id, slug, title, key_prompt, status, reject_code, reject_reason, reviewed_at, published_at, link_status, last_checked_at, upvote_count, comment_count, has_story, story_nudge_dismissed_at, project_media (r2_key, sort_order)",
    )
    .eq("owner_id", userId)
    .neq("status", "removed")
    .order("created_at", { ascending: false });
  if (error) throw new Error(`Could not load projects: ${error.message}`);

  const now = Date.now();
  return data.map((row) => ({
    id: row.id,
    slug: row.slug,
    title: row.title,
    keyPrompt: row.key_prompt,
    status: row.status,
    rejectCode: row.reject_code,
    rejectReason: row.reject_reason,
    recentlyApproved:
      row.status === "published" &&
      row.reviewed_at !== null &&
      now - Date.parse(row.reviewed_at) < RECENT_APPROVAL_MS,
    linkStatus: row.link_status,
    lastCheckedAt: row.last_checked_at,
    upvoteCount: row.upvote_count,
    commentCount: row.comment_count,
    coverKey: [...row.project_media].sort((a, b) => a.sort_order - b.sort_order)[0]?.r2_key ?? null,
    storyNudge:
      row.status === "published" &&
      !row.has_story &&
      row.story_nudge_dismissed_at === null &&
      (row.upvote_count >= NUDGE_MIN_UPVOTES ||
        (row.published_at !== null && now - Date.parse(row.published_at) >= NUDGE_AFTER_MS)),
  }));
}

/** The "Edit profil" form's starting values. */
export async function getMyProfileForm(userId: string): Promise<ProfileFormValues | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("username, display_name, bio, location, links, tip_url")
    .eq("id", userId)
    .maybeSingle();
  if (!data) return null;

  const links = parseProfileLinks(data.links);
  return {
    displayName: data.display_name,
    username: data.username ?? "",
    bio: data.bio ?? "",
    location: data.location ?? "",
    tipUrl: data.tip_url ?? "",
    ...(Object.fromEntries(
      SOCIAL_KEYS.map((key) => [key, socialInputValue(key, links[key] ?? "")]),
    ) as Record<(typeof SOCIAL_KEYS)[number], string>),
    website: links.website ?? "",
  };
}
