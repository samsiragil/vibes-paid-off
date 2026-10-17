import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cacheLife, cacheTag } from "next/cache";
import { makerTag, projectSlugTag, projectTag } from "@/lib/cache-tags";
import type { ProjectMedia } from "@/lib/media/limits";
import type { Database } from "@/lib/supabase/database.types";
import { createPublicClient } from "@/lib/supabase/public";
import { createClient } from "@/lib/supabase/server";
import {
  isAiTool,
  type ContentLang,
  type LinkStatus,
  type ProjectStatus,
  type ToolKind,
} from "./types";

export type ProjectSessionView = {
  id: string;
  label: string | null;
  durationHours: number;
  prompt: string;
  result: string;
  challenge: string | null;
  solution: string | null;
};

export type ProjectToolView = {
  name: string;
  /** Catalog tools have a page (/tools/[slug]); suggested tools are plain text. */
  slug: string | null;
  url: string | null;
  ai: boolean;
};

export type ProjectMaker = {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  bio: string | null;
  tipUrl: string | null;
  isTrusted: boolean;
};

/** Everything /p/[slug] shows. Plain JSON so it can live in a "use cache" entry. */
export type ProjectDetail = {
  id: string;
  slug: string;
  title: string;
  tagline: string;
  description: string;
  keyPrompt: string;
  lessons: string | null;
  liveUrl: string;
  repoUrl: string | null;
  videoUrl: string | null;
  category: string;
  contentLang: ContentLang;
  status: ProjectStatus;
  rejectReason: string | null;
  linkStatus: LinkStatus;
  lastCheckedAt: string | null;
  buildTimeHours: number;
  sessionCount: number;
  upvoteCount: number;
  publishedAt: string | null;
  createdAt: string;
  maker: ProjectMaker;
  sessions: ProjectSessionView[];
  media: ProjectMedia[];
  /** AI tools first, then the rest, then suggestions (§2.8). */
  tools: ProjectToolView[];
  /** The maker's other published projects, newest first. */
  others: { slug: string; title: string; keyPrompt: string }[];
};

const slugPattern = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const OTHER_PROJECTS = 3;

const DETAIL_SELECT = `
  id, slug, owner_id, title, tagline, description, key_prompt, lessons, live_url, repo_url,
  video_url, category, content_lang, status, reject_reason, link_status, last_checked_at,
  build_time_hours, session_count, upvote_count, published_at, created_at,
  owner:profiles!projects_owner_id_fkey (id, username, display_name, avatar_url, bio, tip_url, is_trusted),
  project_sessions (id, sort_order, label, duration_hours, prompt, result, challenge, solution),
  project_media (id, r2_key, width, height, sort_order),
  project_tools (tools (slug, name, url, kind)),
  tool_suggestions (name, url, status, created_at)
` as const;

/** Loads a project with whatever the client's role may read (RLS decides visibility). */
async function loadProject(
  supabase: SupabaseClient<Database>,
  slug: string,
): Promise<ProjectDetail | null> {
  if (!slugPattern.test(slug) || slug.length > 80) return null;

  const { data: row, error } = await supabase
    .from("projects")
    .select(DETAIL_SELECT)
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw new Error(`Could not load project: ${error.message}`);
  if (!row?.owner?.username) return null;

  const { data: others } = await supabase
    .from("projects")
    .select("slug, title, key_prompt")
    .eq("owner_id", row.owner_id)
    .eq("status", "published")
    .neq("id", row.id)
    .order("published_at", { ascending: false })
    .limit(OTHER_PROJECTS);

  const catalog = row.project_tools.flatMap(({ tools }) =>
    tools
      ? [
          {
            name: tools.name,
            slug: tools.slug,
            url: tools.url,
            ai: isAiTool(tools.kind as ToolKind),
          },
        ]
      : [],
  );
  const suggested = row.tool_suggestions
    .filter((suggestion) => suggestion.status === "pending")
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
    .map((suggestion) => ({ name: suggestion.name, slug: null, url: suggestion.url, ai: false }));
  const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name);

  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    tagline: row.tagline,
    description: row.description,
    keyPrompt: row.key_prompt,
    lessons: row.lessons || null,
    liveUrl: row.live_url,
    repoUrl: row.repo_url,
    videoUrl: row.video_url,
    category: row.category,
    contentLang: row.content_lang,
    status: row.status,
    rejectReason: row.reject_reason,
    linkStatus: row.link_status,
    lastCheckedAt: row.last_checked_at,
    buildTimeHours: Number(row.build_time_hours),
    sessionCount: row.session_count,
    upvoteCount: row.upvote_count,
    publishedAt: row.published_at,
    createdAt: row.created_at,
    maker: {
      id: row.owner.id,
      username: row.owner.username,
      displayName: row.owner.display_name || row.owner.username,
      avatarUrl: row.owner.avatar_url,
      bio: row.owner.bio,
      tipUrl: row.owner.tip_url,
      isTrusted: row.owner.is_trusted,
    },
    sessions: [...row.project_sessions]
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((session) => ({
        id: session.id,
        label: session.label || null,
        durationHours: Number(session.duration_hours),
        prompt: session.prompt,
        result: session.result,
        challenge: session.challenge || null,
        solution: session.solution || null,
      })),
    media: [...row.project_media]
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((media) => ({
        id: media.id,
        key: media.r2_key,
        width: media.width,
        height: media.height,
      })),
    tools: [
      ...catalog.filter((tool) => tool.ai).sort(byName),
      ...catalog.filter((tool) => !tool.ai).sort(byName),
      ...suggested,
    ],
    others: (others ?? []).map((other) => ({
      slug: other.slug,
      title: other.title,
      keyPrompt: other.key_prompt,
    })),
  };
}

/**
 * A published project as anyone sees it, or null. Cached and shared by all visitors; saving the
 * project, its media or the maker's profile invalidates it (see lib/cache-tags.ts). Moderation
 * changes made inside the database (auto-hide after reports) show up within the cache lifetime.
 */
export async function getPublishedProject(slug: string): Promise<ProjectDetail | null> {
  "use cache";
  cacheLife("minutes");
  cacheTag(projectSlugTag(slug));

  const project = await loadProject(createPublicClient(), slug);
  if (!project || project.status !== "published") return null;
  cacheTag(projectTag(project.id), makerTag(project.maker.id));
  return project;
}

/**
 * The signed-in owner's own project in any state except removed (pending, rejected, hidden),
 * or null when it is not theirs. Per request, not cached.
 */
export async function getOwnProject(slug: string, userId: string): Promise<ProjectDetail | null> {
  const project = await loadProject(await createClient(), slug);
  if (!project || project.maker.id !== userId || project.status === "removed") return null;
  return project;
}
