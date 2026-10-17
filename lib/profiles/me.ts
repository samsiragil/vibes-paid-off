import "server-only";
import type { LinkStatus, ProjectStatus } from "@/lib/projects/types";
import { createClient } from "@/lib/supabase/server";
import type { ProfileFormValues } from "@/lib/validation/profile";
import { parseProfileLinks } from "./public";

export type MyProject = {
  id: string;
  slug: string;
  title: string;
  keyPrompt: string;
  status: ProjectStatus;
  rejectReason: string | null;
  linkStatus: LinkStatus;
  lastCheckedAt: string | null;
  upvoteCount: number;
  commentCount: number;
  coverKey: string | null;
};

/** The signed-in user's projects in every state but removed, newest first (dashboard table). */
export async function getMyProjects(userId: string): Promise<MyProject[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("projects")
    .select(
      "id, slug, title, key_prompt, status, reject_reason, link_status, last_checked_at, upvote_count, comment_count, project_media (r2_key, sort_order)",
    )
    .eq("owner_id", userId)
    .neq("status", "removed")
    .order("created_at", { ascending: false });
  if (error) throw new Error(`Could not load projects: ${error.message}`);

  return data.map((row) => ({
    id: row.id,
    slug: row.slug,
    title: row.title,
    keyPrompt: row.key_prompt,
    status: row.status,
    rejectReason: row.reject_reason,
    linkStatus: row.link_status,
    lastCheckedAt: row.last_checked_at,
    upvoteCount: row.upvote_count,
    commentCount: row.comment_count,
    coverKey: [...row.project_media].sort((a, b) => a.sort_order - b.sort_order)[0]?.r2_key ?? null,
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
    github: links.github ?? "",
    linkedin: links.linkedin ?? "",
    x: links.x ?? "",
    website: links.website ?? "",
  };
}
