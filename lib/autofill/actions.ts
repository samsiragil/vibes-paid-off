"use server";

import { z } from "zod";
import { consumeMediaQuota, currentUserClient } from "@/lib/media/server";
import type { BuildEffort, ContentLang } from "@/lib/projects/types";
import { httpsUrlPattern, PROJECT_LIMITS } from "@/lib/validation/project";
import { fetchPublic } from "./fetch";
import { getRepoInfo } from "./github";
import { clip, guessContentLang, parsePageMeta } from "./parse";

/** Enough HTML for any <head>; the rest of the page is never read. */
const MAX_PAGE_BYTES = 512 * 1024;

export type AutofillSuggestion = {
  title: string | null;
  tagline: string | null;
  description: string | null;
  /** The page's og:image, fetched through /api/autofill/image. */
  imageUrl: string | null;
  contentLang: ContentLang | null;
  effort: BuildEffort | null;
  /** Null without a repo link or when the repo could not be read (see repoFailed). */
  repo: { commits: number; activeDays: number } | null;
  pageFailed: boolean;
  repoFailed: boolean;
};

export type AutofillResult =
  | { ok: true; suggestion: AutofillSuggestion }
  | { ok: false; error: "unauthorized" | "rate_limit" | "invalid" | "failed" };

const requestSchema = z.object({
  liveUrl: z.string().trim().max(PROJECT_LIMITS.url).regex(httpsUrlPattern),
  repoUrl: z
    .string()
    .trim()
    .max(PROJECT_LIMITS.url)
    .refine((value) => value === "" || httpsUrlPattern.test(value)),
});

/**
 * Suggestions for the submit form from the live page (title, tagline, screenshot, language) and
 * a public GitHub repo (description, README, build time from the commit history). Signed-in
 * makers only, within the hourly autofill budget. Nothing is saved: the form shows the
 * suggestions and the maker decides.
 */
export async function autofillFromLinks(request: {
  liveUrl: string;
  repoUrl: string;
}): Promise<AutofillResult> {
  const parsed = requestSchema.safeParse(request);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const { liveUrl, repoUrl } = parsed.data;

  const user = await currentUserClient();
  if (!user) return { ok: false, error: "unauthorized" };
  try {
    if (!(await consumeMediaQuota(user.supabase, "autofill")))
      return { ok: false, error: "rate_limit" };
  } catch (error) {
    console.error("consume_media_quota failed", error);
    return { ok: false, error: "failed" };
  }

  const [page, repo] = await Promise.all([
    fetchPublic(liveUrl, {
      accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.5",
      maxBytes: MAX_PAGE_BYTES,
      truncate: true,
    }),
    repoUrl ? getRepoInfo(repoUrl) : Promise.resolve(null),
  ]);

  const isHtml = page && (page.contentType === "" || page.contentType.includes("html"));
  const meta = isHtml ? parsePageMeta(new TextDecoder().decode(page.bytes), page.url) : null;

  const longText = meta?.description ?? repo?.summary ?? repo?.description ?? null;
  const tagline = meta?.description ?? repo?.description ?? null;
  const title = meta?.title ?? null;

  return {
    ok: true,
    suggestion: {
      title: title ? clip(title, PROJECT_LIMITS.title) : null,
      tagline: tagline ? clip(tagline, PROJECT_LIMITS.tagline) : null,
      // Only worth suggesting when it says more than the tagline does.
      description:
        longText && longText.length > PROJECT_LIMITS.tagline
          ? clip(longText, PROJECT_LIMITS.description)
          : null,
      imageUrl: meta?.image ?? null,
      contentLang: guessContentLang(
        meta?.lang ?? null,
        [title, longText].filter(Boolean).join(" "),
      ),
      effort: repo?.effort ?? null,
      repo: repo ? { commits: repo.commits, activeDays: repo.activeDays } : null,
      pageFailed: !meta || !(meta.title || meta.description || meta.image),
      repoFailed: Boolean(repoUrl) && !repo,
    },
  };
}
