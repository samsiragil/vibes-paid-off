import { isAiTool, type ContentLang, type LinkStatus, type ToolKind } from "./types";

/** What an "obrolan" card or row needs (profile, home, explore, tools). */
export type ProjectCardData = {
  id: string;
  slug: string;
  title: string;
  tagline: string;
  keyPrompt: string;
  category: string;
  contentLang: ContentLang;
  buildTimeHours: number;
  upvoteCount: number;
  commentCount: number;
  linkStatus: LinkStatus;
  publishedAt: string | null;
  coverKey: string | null;
  /** AI tools first (§2.8); suggested tools count as non-AI. */
  tools: { name: string; ai: boolean }[];
  maker: { username: string; displayName: string; avatarUrl: string | null };
};

/** Columns for `.select()` on projects that `toProjectCard` maps. */
export const PROJECT_CARD_SELECT = `
  id, slug, title, tagline, key_prompt, category, content_lang, build_time_hours, upvote_count,
  comment_count, link_status, published_at,
  owner:profiles!projects_owner_id_fkey (username, display_name, avatar_url),
  project_media (r2_key, sort_order),
  project_tools (tools (name, kind)),
  tool_suggestions (name, status)
` as const;

type CardRow = {
  id: string;
  slug: string;
  title: string;
  tagline: string;
  key_prompt: string;
  category: string;
  content_lang: ContentLang;
  build_time_hours: number | string;
  upvote_count: number;
  comment_count: number;
  link_status: LinkStatus;
  published_at: string | null;
  owner: { username: string | null; display_name: string; avatar_url: string | null } | null;
  project_media: { r2_key: string; sort_order: number }[];
  project_tools: { tools: { name: string; kind: ToolKind } | null }[];
  tool_suggestions: { name: string; status: string }[];
};

export function toProjectCard(row: CardRow): ProjectCardData {
  const cover = [...row.project_media].sort((a, b) => a.sort_order - b.sort_order)[0];
  const catalog = row.project_tools.flatMap(({ tools }) =>
    tools ? [{ name: tools.name, ai: isAiTool(tools.kind) }] : [],
  );
  const suggested = row.tool_suggestions
    .filter((suggestion) => suggestion.status === "pending")
    .map((suggestion) => ({ name: suggestion.name, ai: false }));

  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    tagline: row.tagline,
    keyPrompt: row.key_prompt,
    category: row.category,
    contentLang: row.content_lang,
    buildTimeHours: Number(row.build_time_hours),
    upvoteCount: row.upvote_count,
    commentCount: row.comment_count,
    linkStatus: row.link_status,
    publishedAt: row.published_at,
    coverKey: cover?.r2_key ?? null,
    tools: [
      ...catalog.filter((tool) => tool.ai),
      ...catalog.filter((tool) => !tool.ai),
      ...suggested,
    ],
    maker: {
      username: row.owner?.username ?? "",
      displayName: row.owner?.display_name || row.owner?.username || "",
      avatarUrl: row.owner?.avatar_url ?? null,
    },
  };
}
