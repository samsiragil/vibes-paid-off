// Weekly link checker (Fase 9, Q8). Probes live_url of every published, non-archived project and
// hands one verdict per project to record_link_checks(), which owns the rule: one success makes
// the project 'live' again, the second failure in a row marks it 'offline'.
//
//   pnpm links:check               # check and record (needs the secret key)
//   pnpm links:check --dry-run     # check and print, write nothing
//   pnpm links:check kasir toko    # only these slugs
//
// Reads NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY (.env.local locally, repository variable
// and secret in GitHub Actions; see .github/workflows/link-check.yml).
//
// A link fails on HTTP >= 400, a network/TLS error, or no answer within 10 seconds. HEAD comes
// first; anything but a success is retried once with GET, because many servers mishandle HEAD.
// Bot walls (429, or 403 from a Cloudflare/Vercel challenge) count as alive: the site answered,
// it only refused a datacenter IP, and a visitor's browser gets through. Redirects are followed by
// hand and never to a private or loopback address (scripts/lib/link-probe.mjs).
import { appendFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { markdownCell, markdownUrl, probe } from "./lib/link-probe.mjs";

const CONCURRENCY = 8;
const PAGE_SIZE = 500;

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const slugs = args.filter((arg) => !arg.startsWith("--"));

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secretKey = process.env.SUPABASE_SECRET_KEY;
if (!url || !secretKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY.");
  process.exit(1);
}

const supabase = createClient(url, secretKey, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});

const projects = await loadProjects();
console.log(`Checking ${projects.length} link(s)${dryRun ? " (dry run)" : ""}...`);

const checks = await mapLimit(projects, CONCURRENCY, async (project) => ({
  project,
  ...(await probe(project.live_url)),
}));

for (const { project, ok, detail } of checks) {
  if (!ok) console.log(`  fail  ${project.slug}  ${project.live_url}  (${detail})`);
}

let changes = [];
if (!dryRun && checks.length > 0) {
  changes = await record(checks);
}

const failed = checks.filter((check) => !check.ok).length;
const wentOffline = changes.filter((row) => row.changed && row.link_status === "offline");
const cameBack = changes.filter((row) => row.changed && row.link_status === "live");
const slugById = new Map(projects.map((project) => [project.id, project.slug]));

console.log(
  `\n${checks.length - failed} ok, ${failed} failed.` +
    (dryRun
      ? " Dry run: nothing recorded."
      : ` Recorded ${changes.length}; ${wentOffline.length} went offline, ${cameBack.length} back live.`),
);
for (const row of wentOffline) console.log(`  now offline: ${slugById.get(row.project_id)}`);
for (const row of cameBack) console.log(`  live again:  ${slugById.get(row.project_id)}`);

writeStepSummary();

async function loadProjects() {
  const rows = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    let query = supabase
      .from("projects")
      .select("id, slug, live_url, link_status, link_fail_count")
      .eq("status", "published")
      .neq("link_status", "archived")
      .not("live_url", "is", null)
      .order("id")
      .range(from, from + PAGE_SIZE - 1);
    if (slugs.length > 0) query = query.in("slug", slugs);

    const { data, error } = await query;
    if (error) throw new Error(`Could not read projects: ${error.message}`);
    rows.push(...data);
    if (data.length < PAGE_SIZE) return rows;
  }
}

async function record(results) {
  const rows = [];
  for (let i = 0; i < results.length; i += PAGE_SIZE) {
    const batch = results
      .slice(i, i + PAGE_SIZE)
      .map(({ project, ok }) => ({ id: project.id, ok }));
    const { data, error } = await supabase.rpc("record_link_checks", { p_results: batch });
    if (error) throw new Error(`Could not record results: ${error.message}`);
    rows.push(...data);
  }
  return rows;
}

async function mapLimit(items, limit, fn) {
  const results = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await fn(items[index]);
    }
  });
  await Promise.all(workers);
  return results;
}

// A short report on the workflow run page. Only public data: slugs and URLs of published projects.
function writeStepSummary() {
  const file = process.env.GITHUB_STEP_SUMMARY;
  if (!file) return;

  const rowById = new Map(changes.map((row) => [row.project_id, row]));
  const lines = [
    `### Link check${dryRun ? " (dry run)" : ""}`,
    "",
    `${checks.length} checked, ${checks.length - failed} ok, ${failed} failed.`,
  ];
  const interesting = checks.filter(({ project, ok }) => !ok || rowById.get(project.id)?.changed);
  if (interesting.length > 0) {
    lines.push("", "| Project | Result | Status now |", "|---|---|---|");
    for (const { project, ok, detail } of interesting) {
      const row = rowById.get(project.id);
      const status = row ? `${row.link_status} (fails: ${row.link_fail_count})` : "not recorded";
      lines.push(
        `| [${markdownCell(project.slug)}](${markdownUrl(project.live_url)}) | ${ok ? "ok" : "fail"}: ${markdownCell(detail)} | ${status} |`,
      );
    }
  }
  appendFileSync(file, `${lines.join("\n")}\n`);
}
