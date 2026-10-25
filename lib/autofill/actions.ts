"use server";

import { z } from "zod";
import { consumeMediaQuota, currentUserClient } from "@/lib/media/server";
import type { BuildEffort, ContentLang } from "@/lib/projects/types";
import { httpsUrlPattern, PROJECT_LIMITS } from "@/lib/validation/project";
import { fetchPublic } from "./fetch";
import { getRepoInfo, type RepoLookup } from "./github";
import { clip, guessContentLang, parseGithubRepo, parsePageMeta, repoTitle } from "./parse";

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
  /** Commit stats of a public repo, null otherwise. */
  repo: { commits: number; activeDays: number } | null;
  /** "not_found": GitHub has the account but not the repo, so it is private (or a typo). */
  repoState: RepoLookup["status"];
  /** A live link was given but its page told nothing. */
  pageFailed: boolean;
};

export type AutofillResult =
  | { ok: true; suggestion: AutofillSuggestion }
  | { ok: false; error: "unauthorized" | "rate_limit" | "invalid" | "failed" };

const requestSchema = z.object({
  liveUrl: z
    .string()
    .trim()
    .max(PROJECT_LIMITS.url)
    .refine((value) => value === "" || httpsUrlPattern.test(value)),
  repoUrl: z.string().trim().max(PROJECT_LIMITS.url).regex(httpsUrlPattern),
});

/**
 * Suggestions for the submit form from the GitHub repo (description, README, build time from the
 * commit history; or that it looks private) and the optional live page (title, tagline,
 * screenshot, language). Signed-in
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

  const [page, lookup] = await Promise.all([
    liveUrl
      ? fetchPublic(liveUrl, {
          accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.5",
          maxBytes: MAX_PAGE_BYTES,
          truncate: true,
        })
      : Promise.resolve(null),
    getRepoInfo(repoUrl),
  ]);
  const repo = lookup.status === "public" ? lookup.info : null;

  const isHtml = page && (page.contentType === "" || page.contentType.includes("html"));
  const meta = isHtml ? parsePageMeta(new TextDecoder().decode(page.bytes), page.url) : null;

  const longText = meta?.description ?? repo?.summary ?? repo?.description ?? null;
  const tagline = meta?.description ?? repo?.description ?? null;
  // Without a page title, the repo name ("kasir-warung" → "Kasir Warung"), private repos too.
  const repoName = parseGithubRepo(repoUrl)?.repo;
  const title = meta?.title ?? (repoName ? repoTitle(repoName) : null);

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
      repoState: lookup.status,
      pageFailed: Boolean(liveUrl) && (!meta || !(meta.title || meta.description || meta.image)),
    },
  };
}
