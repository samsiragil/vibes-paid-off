import "server-only";
import {
  activeDays,
  estimateEffort,
  parseGithubRepo,
  readmeSummary,
  type BuildEffortGuess,
} from "./parse";

// Public GitHub repos through the REST API. GITHUB_TOKEN (optional, no scopes needed) raises the
// limit from 60 to 5,000 requests per hour; without it the shared server IP runs out quickly.

const API = "https://api.github.com";
const TIMEOUT_MS = 8_000;
/** Commit pages read for active days (100 commits each); the very first commit is read separately. */
const MAX_COMMIT_PAGES = 3;
const MAX_README_BYTES = 64 * 1024;

export type RepoInfo = {
  description: string | null;
  summary: string | null;
  commits: number;
  activeDays: number;
  effort: BuildEffortGuess | null;
};

function headers(accept = "application/vnd.github+json") {
  const token = process.env.GITHUB_TOKEN;
  return {
    accept,
    "user-agent": "jadinya-autofill",
    "x-github-api-version": "2022-11-28",
    ...(token ? { authorization: `Bearer ${token}` } : {}),
  };
}

async function get(path: string, signal: AbortSignal, accept?: string) {
  const response = await fetch(`${API}${path}`, {
    headers: headers(accept),
    signal,
    cache: "no-store",
  });
  if (!response.ok) {
    await response.body?.cancel().catch(() => {});
    return null;
  }
  return response;
}

/** Page number of rel="last" in a Link header, or null. */
function lastPage(link: string | null) {
  const match = link ? /[?&]page=(\d+)[^>]*>;\s*rel="last"/.exec(link) : null;
  return match ? Number(match[1]) : null;
}

type CommitRow = { commit?: { author?: { date?: string }; committer?: { date?: string } } };

const commitDate = (row: CommitRow) => row.commit?.author?.date ?? row.commit?.committer?.date;

/** Description, README summary and commit history of a public repo, or null when unreadable. */
export async function getRepoInfo(repoUrl: string): Promise<RepoInfo | null> {
  const repo = parseGithubRepo(repoUrl);
  if (!repo) return null;
  const base = `/repos/${repo.owner}/${repo.repo}`;
  const signal = AbortSignal.timeout(TIMEOUT_MS);

  try {
    const [meta, readme, firstPage] = await Promise.all([
      get(base, signal),
      get(`${base}/readme`, signal, "application/vnd.github.raw"),
      get(`${base}/commits?per_page=100`, signal),
    ]);
    if (!meta || !firstPage) return null;

    const { description } = (await meta.json()) as { description: string | null };
    const dates: string[] = [];
    const pushDates = (rows: CommitRow[]) => {
      for (const row of rows) {
        const date = commitDate(row);
        if (date) dates.push(date);
      }
    };
    pushDates((await firstPage.json()) as CommitRow[]);

    const pages = lastPage(firstPage.headers.get("link")) ?? 1;
    const more = await Promise.all(
      Array.from({ length: Math.min(pages, MAX_COMMIT_PAGES) - 1 }, (_, index) =>
        get(`${base}/commits?per_page=100&page=${index + 2}`, signal),
      ),
    );
    for (const page of more) if (page) pushDates((await page.json()) as CommitRow[]);

    // The oldest commit sits on the last page; only the count of what lies between is estimated.
    let commits = dates.length;
    if (pages > MAX_COMMIT_PAGES) {
      const last = await get(`${base}/commits?per_page=100&page=${pages}`, signal);
      const rows = last ? ((await last.json()) as CommitRow[]) : [];
      const oldest = rows.at(-1);
      if (oldest && commitDate(oldest)) dates.push(commitDate(oldest)!);
      commits = (pages - 1) * 100 + rows.length;
    }

    const times = dates.map((date) => Date.parse(date)).filter(Number.isFinite);
    const spanHours = times.length ? (Math.max(...times) - Math.min(...times)) / 3_600_000 : 0;
    const days = activeDays(dates);

    const readmeText = readme ? (await readme.text()).slice(0, MAX_README_BYTES) : "";

    return {
      description: description?.trim() || null,
      summary: readmeText ? readmeSummary(readmeText) : null,
      commits,
      activeDays: days,
      // More than 300 commits: the days seen are only part of it, and certainly a long build.
      effort:
        pages > MAX_COMMIT_PAGES
          ? "longer"
          : estimateEffort({ commits, activeDays: days, spanHours }),
    };
  } catch {
    return null;
  }
}
