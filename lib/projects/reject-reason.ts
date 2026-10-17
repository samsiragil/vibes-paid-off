import "server-only";
import { getTranslations } from "next-intl/server";
import { isRejectCode } from "@/lib/validation/admin";

/**
 * Why a project was rejected, in the viewer's language: the reason label from the admin's list
 * plus their note ("Link tidak bisa dibuka: mengarah ke halaman login"), or null when unknown.
 */
export async function rejectReasonText(code: string | null, note: string | null) {
  const t = await getTranslations("moderation.rejectCodes");
  const label = isRejectCode(code) && !(code === "other" && note) ? t(code) : null;
  return joinRejectReason(label, note);
}

/** "Label: note", without the note's final full stop (the sentences around it add their own). */
export function joinRejectReason(label: string | null, note: string | null) {
  const trimmed = note?.trim().replace(/[.。]+$/, "") || null;
  return [label, trimmed].filter(Boolean).join(": ") || null;
}
