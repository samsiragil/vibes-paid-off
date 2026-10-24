import { z } from "zod";
import { BUILD_EFFORTS } from "@/lib/projects/types";

// Project rules shared by the submit/edit form (browser) and the saveProject action (server).
// They mirror the check constraints in the database, which stay the final word.
// Error messages are codes; the form shows them as projectForm.errors.<code>.

export const PROJECT_LIMITS = {
  keyPrompt: 280,
  title: 80,
  tagline: 80,
  description: 5000,
  /** "Kalau mulai ulang" (stored as lessons). */
  lessons: 2000,
  moment: 1000,
  url: 500,
  maxTools: 20,
  maxSuggestions: 5,
  suggestionName: 60,
} as const;

export type ProjectErrorCode =
  | "required"
  | "too_long"
  | "invalid_url"
  | "invalid_video_url"
  | "ai_tool_required"
  | "too_many"
  | "invalid";

/** Same rule as public.is_https_url(). */
export const httpsUrlPattern = /^https:\/\/[^\s/]+\.[^\s]+$/;
/** Demo videos: YouTube or Loom only (projects.video_url check). */
const videoUrlPattern = /^https:\/\/((www|m)\.)?(youtube\.com|youtu\.be|loom\.com)\//;
const slugPattern = /^[a-z0-9]+(-[a-z0-9]+)*$/;

const error = (code: ProjectErrorCode) => ({ error: code });

const optionalText = (max: number) => z.string().trim().max(max, error("too_long"));
const requiredText = (max: number) => optionalText(max).min(1, error("required"));

const httpsUrl = z
  .string()
  .trim()
  .min(1, error("required"))
  .max(PROJECT_LIMITS.url, error("too_long"))
  .regex(httpsUrlPattern, error("invalid_url"));

const optionalHttpsUrl = z
  .string()
  .trim()
  .max(PROJECT_LIMITS.url, error("too_long"))
  .refine((value) => value === "" || httpsUrlPattern.test(value), error("invalid_url"));

const optionalVideoUrl = optionalHttpsUrl.refine(
  (value) => value === "" || videoUrlPattern.test(value),
  error("invalid_video_url"),
);

export const toolSuggestionSchema = z.object({
  name: requiredText(PROJECT_LIMITS.suggestionName),
  url: optionalHttpsUrl,
});

export const projectSchema = z.object({
  keyPrompt: requiredText(PROJECT_LIMITS.keyPrompt),
  title: requiredText(PROJECT_LIMITS.title),
  tagline: requiredText(PROJECT_LIMITS.tagline),
  description: optionalText(PROJECT_LIMITS.description),
  liveUrl: httpsUrl,
  repoUrl: optionalHttpsUrl,
  videoUrl: optionalVideoUrl,
  category: z.string().regex(slugPattern, error("required")),
  contentLang: z.enum(["id", "en"], error("required")),
  buildEffort: z.enum(BUILD_EFFORTS, error("required")),
  toolIds: z.array(z.number().int().positive()).max(PROJECT_LIMITS.maxTools, error("too_many")),
  suggestions: z.array(toolSuggestionSchema).max(PROJECT_LIMITS.maxSuggestions, error("too_many")),
  momentWow: optionalText(PROJECT_LIMITS.moment),
  momentHardest: optionalText(PROJECT_LIMITS.moment),
  lessons: optionalText(PROJECT_LIMITS.lessons),
});

export type ProjectInput = z.infer<typeof projectSchema>;

/** Field path ("toolIds") → first error code, for showing errors next to fields. */
export type ProjectFieldErrors = Record<string, ProjectErrorCode>;

const knownCodes = new Set<string>([
  "required",
  "too_long",
  "invalid_url",
  "invalid_video_url",
  "ai_tool_required",
  "too_many",
  "invalid",
]);

export function projectFieldErrors(zodError: z.ZodError): ProjectFieldErrors {
  const errors: ProjectFieldErrors = {};
  for (const issue of zodError.issues) {
    const path = issue.path.join(".");
    if (errors[path]) continue;
    errors[path] = knownCodes.has(issue.message) ? (issue.message as ProjectErrorCode) : "invalid";
  }
  return errors;
}

/** The jsonb payload upsert_project() expects (snake_case). */
export function toUpsertPayload(project: ProjectInput) {
  return {
    title: project.title,
    tagline: project.tagline,
    description: project.description,
    key_prompt: project.keyPrompt,
    build_effort: project.buildEffort,
    moment_wow: project.momentWow,
    moment_hardest: project.momentHardest,
    lessons: project.lessons,
    live_url: project.liveUrl,
    repo_url: project.repoUrl,
    video_url: project.videoUrl,
    category: project.category,
    content_lang: project.contentLang,
    tool_ids: project.toolIds,
    suggestions: project.suggestions.map((suggestion) => ({
      name: suggestion.name,
      url: suggestion.url,
    })),
  };
}
