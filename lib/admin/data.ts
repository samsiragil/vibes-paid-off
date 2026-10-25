import "server-only";
import {
  isAiTool,
  type BuildEffort,
  type ToolKind,
  type ProjectStatus,
} from "@/lib/projects/types";
import { createClient } from "@/lib/supabase/server";
import type { ReportReason } from "@/lib/validation/interactions";

// Loaders for /admin. They read as the signed-in admin (RLS lets is_admin() see every project,
// reply, report and suggestion), so call them only after the page checked isCurrentUserAdmin().
// Not cached: moderation needs the live state.

/** Review deadline (VPO-Admin "SISA 45 JAM"): two days from submission. */
export const REVIEW_WINDOW_HOURS = 48;

const QUEUE_LIMIT = 100;
const REPORTS_LIMIT = 500;

type AdminMaker = {
  id: string;
  username: string | null;
  displayName: string;
  avatarUrl: string | null;
  isTrusted: boolean;
};

function maker(row: {
  id: string;
  username: string | null;
  display_name: string;
  avatar_url?: string | null;
  is_trusted: boolean;
}): AdminMaker {
  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name || row.username || "?",
    avatarUrl: row.avatar_url ?? null,
    isTrusted: row.is_trusted,
  };
}

// ---------------------------------------------------------------------------
// Review queue
// ---------------------------------------------------------------------------

export type QueueItem = {
  id: string;
  slug: string;
  title: string;
  tagline: string;
  keyPrompt: string;
  liveUrl: string | null;
  repoUrl: string | null;
  repoPrivate: boolean;
  category: string;
  buildEffort: BuildEffort;
  submittedAt: string;
  /** Sent again after a rejection (the clock restarted). */
  resubmitted: boolean;
  coverKey: string | null;
  /** AI tools first, then the rest, then names the maker suggested. */
  tools: string[];
  maker: AdminMaker;
};

/** Pending projects, oldest submission first. */
export async function getReviewQueue(): Promise<{ items: QueueItem[]; now: number }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("projects")
    .select(
      `id, slug, title, tagline, key_prompt, live_url, repo_url, repo_private, category, build_effort,
       submitted_at, created_at,
       owner:profiles!projects_owner_id_fkey (id, username, display_name, avatar_url, is_trusted),
       project_media (r2_key, sort_order),
       project_tools (tools (name, kind)),
       tool_suggestions (name, status)`,
    )
    .eq("status", "pending")
    .order("submitted_at", { ascending: true })
    .limit(QUEUE_LIMIT);
  if (error) throw new Error(`Could not load the review queue: ${error.message}`);

  const items = data.map((row): QueueItem => {
    const catalog = row.project_tools.flatMap(({ tools }) => (tools ? [tools] : []));
    const ai = catalog.filter((tool) => isAiTool(tool.kind as ToolKind));
    const rest = catalog.filter((tool) => !isAiTool(tool.kind as ToolKind));
    const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name);
    return {
      id: row.id,
      slug: row.slug,
      title: row.title,
      tagline: row.tagline,
      keyPrompt: row.key_prompt,
      liveUrl: row.live_url,
      repoUrl: row.repo_url,
      repoPrivate: row.repo_private,
      category: row.category,
      buildEffort: row.build_effort,
      submittedAt: row.submitted_at,
      resubmitted: Date.parse(row.submitted_at) - Date.parse(row.created_at) > 60_000,
      coverKey:
        [...row.project_media].sort((a, b) => a.sort_order - b.sort_order)[0]?.r2_key ?? null,
      tools: [
        ...ai.sort(byName).map((tool) => tool.name),
        ...rest.sort(byName).map((tool) => tool.name),
        ...row.tool_suggestions
          .filter((suggestion) => suggestion.status === "pending")
          .map((suggestion) => suggestion.name),
      ],
      maker: maker(row.owner),
    };
  });
  // When the queue was read: deadlines and "sent 3 hours ago" are counted from here.
  return { items, now: Date.now() };
}

// ---------------------------------------------------------------------------
// Reports, grouped per target
// ---------------------------------------------------------------------------

export type ReportGroup = {
  targetType: "project" | "comment";
  targetId: string;
  count: number;
  /** Reason → number of reports, most common first. */
  reasons: { reason: ReportReason; count: number }[];
  notes: { reporter: string | null; note: string }[];
  firstAt: string;
  /** Null when the target is gone (its author deleted the reply). */
  project: {
    id: string;
    slug: string;
    title: string;
    tagline: string;
    status: ProjectStatus;
    owner: AdminMaker;
  } | null;
  comment: {
    body: string;
    hidden: boolean;
    author: AdminMaker;
  } | null;
  /** Hidden right now (three reports, or an earlier admin verdict). */
  hidden: boolean;
};

/** Open reports, one group per reported project or reply; hidden targets first. */
export async function getOpenReports(): Promise<ReportGroup[]> {
  const supabase = await createClient();
  const { data: reports, error } = await supabase
    .from("reports")
    .select(
      "target_type, target_id, reason, note, created_at, reporter:profiles!reports_reporter_id_fkey (username)",
    )
    .eq("resolved", false)
    .order("created_at", { ascending: true })
    .limit(REPORTS_LIMIT);
  if (error) throw new Error(`Could not load reports: ${error.message}`);
  if (reports.length === 0) return [];

  const projectIds = unique(
    reports.filter((r) => r.target_type === "project").map((r) => r.target_id),
  );
  const commentIds = unique(
    reports.filter((r) => r.target_type === "comment").map((r) => r.target_id),
  );

  const [projects, comments] = await Promise.all([
    projectIds.length
      ? supabase
          .from("projects")
          .select(
            "id, slug, title, tagline, status, owner:profiles!projects_owner_id_fkey (id, username, display_name, avatar_url, is_trusted)",
          )
          .in("id", projectIds)
      : null,
    commentIds.length
      ? supabase
          .from("comments")
          .select(
            `id, body, status,
             author:profiles!comments_user_id_fkey (id, username, display_name, avatar_url, is_trusted),
             project:projects!comments_project_id_fkey (id, slug, title, tagline, status,
               owner:profiles!projects_owner_id_fkey (id, username, display_name, avatar_url, is_trusted))`,
          )
          .in("id", commentIds)
      : null,
  ]);
  if (projects?.error)
    throw new Error(`Could not load reported projects: ${projects.error.message}`);
  if (comments?.error)
    throw new Error(`Could not load reported replies: ${comments.error.message}`);

  const projectById = new Map((projects?.data ?? []).map((row) => [row.id, row]));
  const commentById = new Map((comments?.data ?? []).map((row) => [row.id, row]));

  const groups = new Map<string, ReportGroup>();
  for (const report of reports) {
    const key = `${report.target_type}:${report.target_id}`;
    let group = groups.get(key);
    if (!group) {
      const projectRow =
        report.target_type === "project"
          ? projectById.get(report.target_id)
          : commentById.get(report.target_id)?.project;
      const commentRow =
        report.target_type === "comment" ? commentById.get(report.target_id) : undefined;
      const project = projectRow
        ? {
            id: projectRow.id,
            slug: projectRow.slug,
            title: projectRow.title,
            tagline: projectRow.tagline,
            status: projectRow.status,
            owner: maker(projectRow.owner),
          }
        : null;
      const comment = commentRow
        ? {
            body: commentRow.body,
            hidden: commentRow.status === "hidden",
            author: maker(commentRow.author),
          }
        : null;
      group = {
        targetType: report.target_type,
        targetId: report.target_id,
        count: 0,
        reasons: [],
        notes: [],
        firstAt: report.created_at,
        project,
        comment,
        hidden: report.target_type === "project" ? project?.status === "hidden" : !!comment?.hidden,
      };
      groups.set(key, group);
    }

    group.count++;
    const reason = group.reasons.find((item) => item.reason === report.reason);
    if (reason) reason.count++;
    else group.reasons.push({ reason: report.reason, count: 1 });
    if (report.note)
      group.notes.push({ reporter: report.reporter?.username ?? null, note: report.note });
  }

  return [...groups.values()]
    .map((group) => ({ ...group, reasons: group.reasons.sort((a, b) => b.count - a.count) }))
    .sort(
      (a, b) =>
        Number(b.hidden) - Number(a.hidden) ||
        b.count - a.count ||
        a.firstAt.localeCompare(b.firstAt),
    );
}

// ---------------------------------------------------------------------------
// Tools catalog and suggestions
// ---------------------------------------------------------------------------

export type AdminTool = {
  id: number;
  slug: string;
  name: string;
  url: string | null;
  logoUrl: string | null;
  kind: ToolKind;
  descriptionId: string;
  descriptionEn: string;
  isActive: boolean;
  projectCount: number;
};

export type SuggestionGroup = {
  /** The name as the first maker typed it; every spelling with the same letters is one group. */
  name: string;
  urls: string[];
  projects: { slug: string; title: string; status: ProjectStatus }[];
  firstAt: string;
};

/** Every tool, active or not, by kind then name. */
export async function getAdminTools(): Promise<AdminTool[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tools")
    .select(
      "id, slug, name, url, logo_url, kind, description_id, description_en, is_active, project_count",
    )
    .order("kind")
    .order("name");
  if (error) throw new Error(`Could not load tools: ${error.message}`);
  return data.map((tool) => ({
    id: tool.id,
    slug: tool.slug,
    name: tool.name,
    url: tool.url,
    logoUrl: tool.logo_url,
    kind: tool.kind,
    descriptionId: tool.description_id,
    descriptionEn: tool.description_en,
    isActive: tool.is_active,
    projectCount: tool.project_count,
  }));
}

/** Pending tool suggestions grouped by name (case and spaces ignored), oldest first. */
export async function getToolSuggestions(): Promise<SuggestionGroup[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tool_suggestions")
    .select(
      "name, url, created_at, project:projects!tool_suggestions_project_id_fkey (slug, title, status)",
    )
    .eq("status", "pending")
    .order("created_at", { ascending: true });
  if (error) throw new Error(`Could not load tool suggestions: ${error.message}`);

  const groups = new Map<string, SuggestionGroup>();
  for (const row of data) {
    const key = row.name.trim().toLowerCase();
    let group = groups.get(key);
    if (!group) {
      group = { name: row.name.trim(), urls: [], projects: [], firstAt: row.created_at };
      groups.set(key, group);
    }
    if (row.url && !group.urls.includes(row.url)) group.urls.push(row.url);
    if (row.project && !group.projects.some((project) => project.slug === row.project?.slug)) {
      group.projects.push(row.project);
    }
  }
  return [...groups.values()];
}

// ---------------------------------------------------------------------------
// "Pilihan minggu ini" history (read-only)
// ---------------------------------------------------------------------------

export type PickCandidate = {
  projectId: string;
  title: string | null;
  slug: string | null;
  score: number;
  eligibleVotes: number;
  eligibleRepliers: number;
};

export type WeeklyPickView = {
  weekStart: string;
  computedAt: string;
  windowFrom: string | null;
  windowTo: string | null;
  minScore: number | null;
  winner: PickCandidate | null;
  candidates: PickCandidate[];
};

const PICK_WEEKS = 12;

/** The last weeks' picks with their stored breakdown, newest first. */
export async function getWeeklyPicks(): Promise<WeeklyPickView[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("weekly_picks")
    .select("week_start, project_id, breakdown, computed_at")
    .order("week_start", { ascending: false })
    .limit(PICK_WEEKS);
  if (error) throw new Error(`Could not load weekly picks: ${error.message}`);

  const parsed = data.map((row) => {
    const breakdown = (row.breakdown ?? {}) as Record<string, unknown>;
    const candidates = Array.isArray(breakdown.candidates) ? breakdown.candidates : [];
    return {
      row,
      breakdown,
      candidates: candidates.flatMap((candidate): Omit<PickCandidate, "title" | "slug">[] => {
        if (!candidate || typeof candidate !== "object") return [];
        const item = candidate as Record<string, unknown>;
        if (typeof item.project_id !== "string") return [];
        return [
          {
            projectId: item.project_id,
            score: Number(item.score ?? 0),
            eligibleVotes: Number(item.eligible_votes ?? 0),
            eligibleRepliers: Number(item.eligible_repliers ?? 0),
          },
        ];
      }),
    };
  });

  const ids = unique(parsed.flatMap((pick) => pick.candidates.map((c) => c.projectId)));
  const titles = new Map<string, { title: string; slug: string }>();
  if (ids.length) {
    const { data: projects } = await supabase
      .from("projects")
      .select("id, slug, title")
      .in("id", ids);
    for (const project of projects ?? []) titles.set(project.id, project);
  }

  return parsed.map(({ row, breakdown, candidates }) => {
    const named = candidates.map((candidate) => ({
      ...candidate,
      title: titles.get(candidate.projectId)?.title ?? null,
      slug: titles.get(candidate.projectId)?.slug ?? null,
    }));
    return {
      weekStart: row.week_start,
      computedAt: row.computed_at,
      windowFrom: typeof breakdown.window_from === "string" ? breakdown.window_from : null,
      windowTo: typeof breakdown.window_to === "string" ? breakdown.window_to : null,
      minScore: typeof breakdown.min_score === "number" ? breakdown.min_score : null,
      winner: named.find((candidate) => candidate.projectId === row.project_id) ?? null,
      candidates: named,
    };
  });
}

// ---------------------------------------------------------------------------
// Counts for the admin menu
// ---------------------------------------------------------------------------

export type AdminCounts = { queue: number; reports: number; suggestions: number };

export async function getAdminCounts(): Promise<AdminCounts> {
  const supabase = await createClient();
  const [queue, reports, suggestions] = await Promise.all([
    supabase.from("projects").select("id", { count: "exact", head: true }).eq("status", "pending"),
    supabase
      .from("reports")
      .select("target_type, target_id")
      .eq("resolved", false)
      .limit(REPORTS_LIMIT),
    supabase.from("tool_suggestions").select("name").eq("status", "pending"),
  ]);
  return {
    queue: queue.count ?? 0,
    reports: new Set((reports.data ?? []).map((r) => `${r.target_type}:${r.target_id}`)).size,
    suggestions: new Set((suggestions.data ?? []).map((s) => s.name.trim().toLowerCase())).size,
  };
}

function unique<T>(values: T[]) {
  return [...new Set(values)];
}
