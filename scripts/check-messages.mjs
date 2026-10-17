// Checks that messages/id.json and messages/en.json stay in sync (§2.5, Q17): the same keys, no
// empty strings, and the same {placeholders} and <tags> in each translation, so a missing EN copy
// or a renamed variable fails CI instead of showing a raw key on the site.
//
//   pnpm messages:check
import { readFileSync } from "node:fs";

const locales = ["id", "en"];

function flatten(value, prefix = "", out = new Map()) {
  for (const [key, child] of Object.entries(value)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (child && typeof child === "object") flatten(child, path, out);
    else out.set(path, child);
  }
  return out;
}

/**
 * Collects ICU argument names from `text` starting at `i`, until an unmatched "}" (the end of a
 * plural/select branch) or the end. Branch bodies ("one {# hour}") are text, not arguments, but
 * may hold arguments of their own. Returns the index after the closing brace.
 */
function collectArguments(text, i, names) {
  while (i < text.length) {
    const char = text[i];
    if (char === "}") return i + 1;
    if (char !== "{") {
      i++;
      continue;
    }
    const head = /^\{\s*([A-Za-z_]\w*)\s*(,\s*(\w+)\s*)?/.exec(text.slice(i));
    if (!head) {
      i++;
      continue;
    }
    names.add(`{${head[1]}}`);
    i += head[0].length;
    const type = head[3];
    if (type === "plural" || type === "select" || type === "selectordinal") {
      i = text.indexOf(",", i) + 1;
      // Selectors ("one", "=1", "other", "offset:1") each followed by a {branch}.
      while (i < text.length && text[i] !== "}") {
        if (text[i] === "{") i = collectArguments(text, i + 1, names);
        else i++;
      }
    } else {
      // Simple argument or a number/date style: skip to its closing brace.
      i = text.indexOf("}", i);
    }
    i++;
  }
  return i;
}

/** Argument names ({name}, {count, plural, …}) and rich-text tags (<link>), sorted. */
function tokens(message) {
  const names = new Set();
  collectArguments(message, 0, names);
  for (const match of message.matchAll(/<([a-z][\w-]*)>/g)) names.add(`<${match[1]}>`);
  return [...names].sort().join(" ");
}

const messages = Object.fromEntries(
  locales.map((locale) => [
    locale,
    flatten(JSON.parse(readFileSync(new URL(`../messages/${locale}.json`, import.meta.url)))),
  ]),
);

const problems = [];
const [base, ...others] = locales;
for (const other of others) {
  for (const key of messages[base].keys()) {
    if (!messages[other].has(key)) problems.push(`${other}: missing ${key}`);
  }
  for (const key of messages[other].keys()) {
    if (!messages[base].has(key)) problems.push(`${base}: missing ${key}`);
  }
}

for (const locale of locales) {
  for (const [key, value] of messages[locale]) {
    if (typeof value !== "string") problems.push(`${locale}: ${key} is not a string`);
    else if (!value.trim()) problems.push(`${locale}: ${key} is empty`);
  }
}

for (const [key, value] of messages[base]) {
  for (const other of others) {
    const translated = messages[other].get(key);
    if (typeof value !== "string" || typeof translated !== "string") continue;
    if (tokens(value) !== tokens(translated)) {
      problems.push(
        `${key}: ${base} uses [${tokens(value)}] but ${other} uses [${tokens(translated)}]`,
      );
    }
  }
}

if (problems.length) {
  console.error(`messages: ${problems.length} problem(s)\n  ${problems.join("\n  ")}`);
  process.exit(1);
}
console.log(`messages: ${messages[base].size} keys in sync across ${locales.join(", ")}`);
