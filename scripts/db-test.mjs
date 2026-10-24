// Runs supabase/tests/*.sql against a database through the Supabase CLI, without Docker or psql.
// Each file runs inside one transaction (supabase/tests/_setup.sql + the file) that is aborted at
// the end; the TAP output travels back in the abort message, so nothing is ever committed.
//
//   pnpm db:test                     # linked project (default)
//   pnpm db:test --local             # local stack from `supabase start`
//   pnpm db:test ranking             # only files whose name contains "ranking"
import { spawnSync } from "node:child_process";
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const testsDir = join(import.meta.dirname, "..", "supabase", "tests");
const args = process.argv.slice(2);
const target = args.includes("--local") ? "--local" : "--linked";
const filters = args.filter((arg) => !arg.startsWith("--"));

const setup = readFileSync(join(testsDir, "_setup.sql"), "utf8");
const finish = `
select tap.emit(line) from finish() as line;
do $$ begin
  raise exception 'TAP_RESULTS%', E'\\n' || (select string_agg(line, E'\\n' order by id) from tap.out) || E'\\nTAP_END';
end $$;
`;

const files = readdirSync(testsDir)
  .filter((name) => name.endsWith(".sql") && !name.startsWith("_"))
  .filter((name) => filters.length === 0 || filters.some((filter) => name.includes(filter)))
  .sort();

const workDir = mkdtempSync(join(tmpdir(), "vpo-db-test-"));
let failed = 0;

try {
  for (const file of files) {
    const sqlPath = join(workDir, file);
    writeFileSync(sqlPath, `${setup}\n${readFileSync(join(testsDir, file), "utf8")}\n${finish}`);

    const run = spawnSync("supabase", ["db", "query", target, "-f", sqlPath], { encoding: "utf8" });
    // Newer CLIs return the error as JSON, so newlines and quotes arrive escaped (once or twice).
    const output = unescape(`${run.stdout}\n${run.stderr}`)
      .replace(/\\+n/g, "\n")
      .replace(/\\+"/g, '"');
    const match = output.match(/TAP_RESULTS\n([\s\S]*?)\nTAP_END/);

    console.log(`\n# ${file}`);
    if (!match) {
      failed++;
      console.log("not ok - file did not finish (error before the end of the test):");
      console.log(output.trim());
      continue;
    }

    const lines = match[1].split("\n");
    for (const line of lines) console.log(line);
    failed += lines.filter((line) => line.startsWith("not ok")).length;
  }
} finally {
  rmSync(workDir, { recursive: true, force: true });
}

console.log(failed === 0 ? "\nAll database tests passed." : `\n${failed} failing test(s).`);
process.exit(failed === 0 ? 0 : 1);

// The CLI nests the Postgres error inside JSON (sometimes twice); undo the escaping.
function unescape(text) {
  let current = text;
  for (let i = 0; i < 3; i++) {
    current = current
      .replace(/\\\\/g, "\\")
      .replace(/\\n/g, "\n")
      .replace(/\\"/g, '"')
      .replace(/\\u003c/g, "<")
      .replace(/\\u003e/g, ">");
  }
  return current;
}
