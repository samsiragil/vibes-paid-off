import { isAiTool, type LinkStatus, type ToolKind } from "./types";

/** What an "obrolan" card in a grid needs (profile now, home/explore/tools in Fase 6). */
export type ProjectCardData = {
  id: string;
  slug: string;
  title: string;
  keyPrompt: string;
  category: string;
  buildTimeHours: number;
  upvoteCount: number;
  linkStatus: LinkStatus;
  coverKey: string | null;
  /** AI tools first (§2.8); suggested tools count as non-AI. */
  tools: { name: string; ai: boolean }[];
  maker: { username: string; displayName: string; avatarUrl: string | null };
};

/** Columns for `.select()` on projects that `toProjectCard` maps. */
export const PROJECT_CARD_SELECT = `
  id, slug, title, key_prompt, category, build_time_hours, upvote_count, link_status,
  owner:profiles!projects_owner_id_fkey (username, display_name, avatar_url),
  project_media (r2_key, sort_order),
  project_tools (tools (name, kind)),
  tool_suggestions (name, status)
` as const;

type CardRow = {
  id: string;
  slug: string;
  title: string;
  key_prompt: string;
  category: string;
  build_time_hours: number | string;
  upvote_count: number;
  link_status: LinkStatus;
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
    keyPrompt: row.key_prompt,
    category: row.category,
    buildTimeHours: Number(row.build_time_hours),
    upvoteCount: row.upvote_count,
    linkStatus: row.link_status,
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
