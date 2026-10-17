import { z } from "zod";
import { TOOL_KINDS, type ToolKind } from "@/lib/projects/types";

// /admin rules shared by the admin forms (browser) and the admin actions (server). They mirror
// the check constraints on projects and tools, which stay the final word.

/** Why a project was rejected (Q11); labels in messages moderation.rejectCodes. */
export const REJECT_CODES = [
  "incomplete",
  "broken_link",
  "not_vibe_coded",
  "duplicate",
  "rules",
  "other",
] as const;

export type RejectCode = (typeof REJECT_CODES)[number];

export function isRejectCode(value: unknown): value is RejectCode {
  return REJECT_CODES.includes(value as RejectCode);
}

export const REJECT_NOTE_MAX = 1000;

export const reviewSchema = z.discriminatedUnion("approve", [
  z.object({ projectId: z.uuid(), approve: z.literal(true) }),
  z.object({
    projectId: z.uuid(),
    approve: z.literal(false),
    code: z.enum(REJECT_CODES),
    note: z.string().trim().max(REJECT_NOTE_MAX).optional(),
  }),
]);

export type ReviewInput = z.input<typeof reviewSchema>;

/** Report verdicts (admin_resolve_report). */
export const REPORT_ACTIONS = ["keep", "hide", "remove"] as const;
export type ReportAction = (typeof REPORT_ACTIONS)[number];

export const resolveReportSchema = z.object({
  targetType: z.enum(["project", "comment"]),
  targetId: z.uuid(),
  action: z.enum(REPORT_ACTIONS),
});

// ---------------------------------------------------------------------------
// Tools catalog
// ---------------------------------------------------------------------------

export const TOOL_LIMITS = { name: 60, slug: 60, url: 500, description: 500 } as const;

export type ToolFormErrorCode = "required" | "too_long" | "invalid_slug" | "invalid_url";

const httpsUrl = /^https:\/\/[^\s/]+\.[^\s]+$/;
const slugPattern = /^[a-z0-9]+(-[a-z0-9]+)*$/;

const optionalUrl = z
  .string()
  .trim()
  .max(TOOL_LIMITS.url, { error: "too_long" })
  .refine((value) => value === "" || httpsUrl.test(value), { error: "invalid_url" });

export const toolFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, { error: "required" })
    .max(TOOL_LIMITS.name, { error: "too_long" }),
  slug: z
    .string()
    .trim()
    .min(1, { error: "required" })
    .max(TOOL_LIMITS.slug, { error: "too_long" })
    .regex(slugPattern, { error: "invalid_slug" }),
  url: optionalUrl,
  logoUrl: optionalUrl,
  kind: z.enum(TOOL_KINDS as [ToolKind, ...ToolKind[]]),
  descriptionId: z.string().trim().max(TOOL_LIMITS.description, { error: "too_long" }),
  descriptionEn: z.string().trim().max(TOOL_LIMITS.description, { error: "too_long" }),
  isActive: z.boolean(),
});

export type ToolFormValues = z.input<typeof toolFormSchema>;
export type ToolFormField = keyof ToolFormValues;
export type ToolFormErrors = Partial<Record<ToolFormField, ToolFormErrorCode>>;

/** Field errors from a failed parse, first issue per field. */
export function toolFormErrors(error: z.ZodError): ToolFormErrors {
  const errors: ToolFormErrors = {};
  for (const issue of error.issues) {
    const field = issue.path[0] as ToolFormField | undefined;
    if (field && !errors[field]) errors[field] = issue.message as ToolFormErrorCode;
  }
  return errors;
}

/** "Claude Code" → "claude-code": a starting point for the slug field. */
export function slugifyToolName(name: string) {
  return name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, TOOL_LIMITS.slug)
    .replace(/-+$/, "");
}

export const suggestionActionSchema = z.discriminatedUnion("action", [
  z.object({ name: z.string().trim().min(1).max(60), action: z.literal("reject") }),
  z.object({
    name: z.string().trim().min(1).max(60),
    action: z.literal("merge"),
    toolId: z.number().int().positive(),
  }),
  z.object({
    name: z.string().trim().min(1).max(60),
    action: z.literal("create"),
    tool: toolFormSchema,
  }),
]);

export type SuggestionActionInput = z.input<typeof suggestionActionSchema>;
