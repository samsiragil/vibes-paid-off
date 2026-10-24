import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { makerTag, usernameTag } from "@/lib/cache-tags";
import { PROJECT_CARD_SELECT, toProjectCard, type ProjectCardData } from "@/lib/projects/cards";
import { createPublicClient } from "@/lib/supabase/public";
import { usernamePattern } from "@/app/[locale]/onboarding/username";

export type ProfileLinks = { github?: string; linkedin?: string; x?: string; website?: string };

export const PROFILE_LINK_KEYS = ["github", "linkedin", "x", "website"] as const;

export type PublicProfile = {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  bio: string | null;
  location: string | null;
  links: ProfileLinks;
  tipUrl: string | null;
  isTrusted: boolean;
  createdAt: string;
  /** Published projects, newest first (archived ones included, with their label). */
  projects: ProjectCardData[];
  stats: {
    projectCount: number;
    /** Published projects with a build story. */
    storyCount: number;
    upvoteCount: number;
    /** The tool used in most published projects (AI tools win ties). */
    topTool: string | null;
  };
};

/** Only https links from the jsonb column, in a fixed order. */
export function parseProfileLinks(value: unknown): ProfileLinks {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const links: ProfileLinks = {};
  for (const key of PROFILE_LINK_KEYS) {
    const url = (value as Record<string, unknown>)[key];
    if (typeof url === "string" && url.startsWith("https://")) links[key] = url;
  }
  return links;
}

function topToolOf(projects: ProjectCardData[]) {
  const counts = new Map<string, { count: number; ai: boolean }>();
  for (const project of projects) {
    for (const tool of project.tools) {
      const entry = counts.get(tool.name) ?? { count: 0, ai: tool.ai };
      entry.count++;
      counts.set(tool.name, entry);
    }
  }
  const [top] = [...counts.entries()].sort(
    ([nameA, a], [nameB, b]) =>
      b.count - a.count || Number(b.ai) - Number(a.ai) || nameA.localeCompare(nameB),
  );
  return top?.[0] ?? null;
}

/** A maker's public profile with their published projects and stats, or null. Cached. */
export async function getPublicProfile(username: string): Promise<PublicProfile | null> {
  "use cache";
  cacheLife("minutes");
  const handle = username.toLowerCase();
  cacheTag(usernameTag(handle));
  if (!usernamePattern.test(handle)) return null;

  const supabase = createPublicClient();
  const { data: profile, error } = await supabase
    .from("profiles")
    .select(
      "id, username, display_name, avatar_url, bio, location, links, tip_url, is_trusted, created_at",
    )
    .eq("username", handle)
    .maybeSingle();
  if (error) throw new Error(`Could not load profile: ${error.message}`);
  if (!profile?.username) return null;
  cacheTag(makerTag(profile.id));

  const { data: rows, error: projectsError } = await supabase
    .from("projects")
    .select(PROJECT_CARD_SELECT)
    .eq("owner_id", profile.id)
    .eq("status", "published")
    .order("published_at", { ascending: false });
  if (projectsError) throw new Error(`Could not load projects: ${projectsError.message}`);

  const projects = (rows ?? []).map(toProjectCard);

  return {
    id: profile.id,
    username: profile.username,
    displayName: profile.display_name || profile.username,
    avatarUrl: profile.avatar_url,
    bio: profile.bio || null,
    location: profile.location || null,
    links: parseProfileLinks(profile.links),
    tipUrl: profile.tip_url,
    isTrusted: profile.is_trusted,
    createdAt: profile.created_at,
    projects,
    stats: {
      projectCount: projects.length,
      storyCount: projects.filter((project) => project.hasStory).length,
      upvoteCount: projects.reduce((sum, project) => sum + project.upvoteCount, 0),
      topTool: topToolOf(projects),
    },
  };
}
