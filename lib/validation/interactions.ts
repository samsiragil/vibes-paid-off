import { z } from "zod";

// Reply and report rules shared by the project page (browser) and the interaction actions
// (server). They mirror the comments/reports check constraints, which stay the final word.

export const REPLY_MAX = 1000;
export const REPORT_NOTE_MAX = 500;

export const REPORT_REASONS = [
  "spam",
  "scam",
  "adult_illegal",
  "harassment",
  "personal_data",
  "other",
] as const;

export type ReportReason = (typeof REPORT_REASONS)[number];

export type ReplyErrorCode = "required" | "too_long";

export const replyBodySchema = z
  .string()
  .trim()
  .min(1, { error: "required" })
  .max(REPLY_MAX, { error: "too_long" });

export const reportSchema = z.object({
  targetType: z.enum(["project", "comment"]),
  targetId: z.uuid(),
  reason: z.enum(REPORT_REASONS),
  note: z.string().trim().max(REPORT_NOTE_MAX).optional(),
});

export type ReportInput = z.infer<typeof reportSchema>;
