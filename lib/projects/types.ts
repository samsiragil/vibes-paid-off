import type { Database } from "@/lib/supabase/database.types";

// Project types shared by server and browser code.

export type ToolKind = Database["public"]["Enums"]["tool_kind"];
export type ProjectStatus = Database["public"]["Enums"]["project_status"];
export type ContentLang = Database["public"]["Enums"]["content_lang"];
export type LinkStatus = Database["public"]["Enums"]["link_status"];

export const TOOL_KINDS: ToolKind[] = [
  "ai_agent",
  "ai_builder",
  "ai_assistant",
  "framework",
  "backend",
  "hosting",
  "service",
];

const aiKinds = new Set<ToolKind>(["ai_agent", "ai_builder", "ai_assistant"]);

export function isAiTool(kind: ToolKind) {
  return aiKinds.has(kind);
}

export type CatalogTool = {
  id: number;
  slug: string;
  name: string;
  kind: ToolKind;
  /** Published projects using it (ranking for filters and quick picks). */
  projectCount: number;
};

/**
 * "Claude Code, Cursor +2": AI tools first (§2.8 project card), up to `shown` names,
 * the rest as a count. Suggested tools (not in the catalog yet) count as non-AI.
 */
export function toolsSummary(tools: { name: string; ai: boolean }[], shown = 2) {
  const ordered = [...tools.filter((tool) => tool.ai), ...tools.filter((tool) => !tool.ai)];
  const names = ordered.slice(0, shown).map((tool) => tool.name);
  const rest = ordered.length - names.length;
  return { names: names.join(", "), rest };
}
