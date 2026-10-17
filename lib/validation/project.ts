import { z } from "zod";

// Project rules shared by the submit/edit form (browser) and the saveProject action (server).
// They mirror the check constraints in the database, which stay the final word.
// Error messages are codes; the form shows them as projectForm.errors.<code>.

export const PROJECT_LIMITS = {
  keyPrompt: 280,
  title: 80,
  tagline: 80,
  description: 5000,
  lessons: 2000,
  url: 500,
  sessionLabel: 40,
  sessionPrompt: 1000,
  sessionResult: 500,
  challenge: 1000,
  solution: 1000,
  minSessions: 1,
  maxSessions: 10,
  maxSessionHours: 24,
  maxTools: 20,
  maxSuggestions: 5,
  suggestionName: 60,
} as const;

export type ProjectErrorCode =
  | "required"
  | "too_long"
  | "invalid_url"
  | "invalid_video_url"
  | "invalid_duration"
  | "solution_needs_challenge"
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

/** Hours in half-hour steps, 0.5 to 24. */
const duration = z
  .number(error("invalid_duration"))
  .refine(
    (value) =>
      Number.isFinite(value) &&
      value > 0 &&
      value <= PROJECT_LIMITS.maxSessionHours &&
      Number.isInteger(value * 2),
    error("invalid_duration"),
  );

export const sessionSchema = z
  .object({
    /** Existing session (edit page); new sessions have none. */
    id: z.uuid().optional(),
    label: optionalText(PROJECT_LIMITS.sessionLabel),
    durationHours: duration,
    prompt: requiredText(PROJECT_LIMITS.sessionPrompt),
    result: requiredText(PROJECT_LIMITS.sessionResult),
    challenge: optionalText(PROJECT_LIMITS.challenge),
    solution: optionalText(PROJECT_LIMITS.solution),
  })
  .refine((session) => session.solution === "" || session.challenge !== "", {
    ...error("solution_needs_challenge"),
    path: ["challenge"],
  });

export const toolSuggestionSchema = z.object({
  name: requiredText(PROJECT_LIMITS.suggestionName),
  url: optionalHttpsUrl,
});

export const projectSchema = z
  .object({
    keyPrompt: requiredText(PROJECT_LIMITS.keyPrompt),
    title: requiredText(PROJECT_LIMITS.title),
    tagline: requiredText(PROJECT_LIMITS.tagline),
    description: optionalText(PROJECT_LIMITS.description),
    liveUrl: httpsUrl,
    repoUrl: optionalHttpsUrl,
    videoUrl: optionalVideoUrl,
    category: z.string().regex(slugPattern, error("required")),
    contentLang: z.enum(["id", "en"], error("required")),
    toolIds: z.array(z.number().int().positive()).max(PROJECT_LIMITS.maxTools, error("too_many")),
    suggestions: z
      .array(toolSuggestionSchema)
      .max(PROJECT_LIMITS.maxSuggestions, error("too_many")),
    sessions: z
      .array(sessionSchema)
      .min(PROJECT_LIMITS.minSessions, error("required"))
      .max(PROJECT_LIMITS.maxSessions, error("too_many")),
    lessons: optionalText(PROJECT_LIMITS.lessons),
  })
  .refine(
    (project) => {
      const ids = project.sessions.flatMap((session) => (session.id ? [session.id] : []));
      return new Set(ids).size === ids.length;
    },
    { ...error("invalid"), path: ["sessions"] },
  );

export type ProjectInput = z.infer<typeof projectSchema>;
export type SessionInput = z.infer<typeof sessionSchema>;

/** Field path ("sessions.0.prompt") → first error code, for showing errors next to fields. */
export type ProjectFieldErrors = Record<string, ProjectErrorCode>;

const knownCodes = new Set<string>([
  "required",
  "too_long",
  "invalid_url",
  "invalid_video_url",
  "invalid_duration",
  "solution_needs_challenge",
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

/** Build time shown on the card: the sum of session hours (projects.build_time_hours). */
export function totalBuildHours(sessions: { durationHours: number }[]) {
  return sessions.reduce(
    (sum, session) => sum + (Number.isFinite(session.durationHours) ? session.durationHours : 0),
    0,
  );
}

/** The jsonb payload upsert_project() expects (snake_case). */
export function toUpsertPayload(project: ProjectInput) {
  return {
    title: project.title,
    tagline: project.tagline,
    description: project.description,
    key_prompt: project.keyPrompt,
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
    sessions: project.sessions.map((session) => ({
      id: session.id ?? null,
      label: session.label,
      duration_hours: session.durationHours,
      prompt: session.prompt,
      result: session.result,
      challenge: session.challenge,
      solution: session.challenge ? session.solution : "",
    })),
  };
}
