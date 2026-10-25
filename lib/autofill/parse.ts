// Autofill for the submit form: reading a live page's meta tags and a GitHub repo's history.
// No imports, so the unit test can load this file with plain Node (see parse.test.mjs).

export type BuildEffortGuess = "hours" | "overnight" | "weekend" | "week" | "longer";

export type PageMeta = {
  title: string | null;
  description: string | null;
  /** Absolute URL of og:image / twitter:image. */
  image: string | null;
  /** <html lang>, lowercased ("id", "en-us"). */
  lang: string | null;
};

const entities: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  "#39": "'",
};

export function decodeEntities(text: string) {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+|#39);/gi, (match, name: string) => {
    const lower = name.toLowerCase();
    if (lower.startsWith("#x")) return safeCodePoint(Number.parseInt(lower.slice(2), 16), match);
    if (lower.startsWith("#")) return safeCodePoint(Number.parseInt(lower.slice(1), 10), match);
    return entities[lower] ?? match;
  });
}

function safeCodePoint(code: number, fallback: string) {
  return Number.isInteger(code) && code > 0 && code <= 0x10ffff
    ? String.fromCodePoint(code)
    : fallback;
}

/** Collapses whitespace; empty → null. */
function clean(value: string | undefined | null) {
  if (!value) return null;
  const text = decodeEntities(value).replace(/\s+/g, " ").trim();
  return text || null;
}

function attributes(tag: string) {
  const found: Record<string, string> = {};
  for (const match of tag.matchAll(/([a-zA-Z:-]+)\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'>]+))/g)) {
    found[match[1].toLowerCase()] = match[3] ?? match[4] ?? match[5] ?? "";
  }
  return found;
}

/** Title, description, preview image and language from a page's HTML (only the <head> is read). */
export function parsePageMeta(html: string, pageUrl: string): PageMeta {
  const headEnd = html.search(/<\/head>|<body[\s>]/i);
  const head = headEnd >= 0 ? html.slice(0, headEnd) : html;

  const meta = new Map<string, string>();
  for (const match of head.matchAll(/<meta\b[^>]*>/gi)) {
    const attrs = attributes(match[0]);
    const key = (attrs.property ?? attrs.name ?? "").toLowerCase();
    if (key && attrs.content !== undefined && !meta.has(key)) meta.set(key, attrs.content);
  }

  const titleTag = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(head)?.[1];
  const imageRaw = clean(
    meta.get("og:image") ?? meta.get("og:image:url") ?? meta.get("twitter:image"),
  );
  let image: string | null = null;
  if (imageRaw) {
    try {
      const resolved = new URL(imageRaw, pageUrl);
      if (resolved.protocol === "https:" || resolved.protocol === "http:") image = resolved.href;
    } catch {
      image = null;
    }
  }
  const lang = /<html\b[^>]*\blang\s*=\s*["']?([a-zA-Z-]+)/i.exec(html)?.[1]?.toLowerCase() ?? null;

  return {
    title: clean(meta.get("og:title") ?? meta.get("twitter:title") ?? titleTag),
    description: clean(
      meta.get("og:description") ?? meta.get("description") ?? meta.get("twitter:description"),
    ),
    image,
    lang,
  };
}

/** Cuts text to `max` characters at a word boundary, with an ellipsis when it was longer. */
export function clip(text: string, max: number) {
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 1);
  const space = cut.lastIndexOf(" ");
  return `${(space > max / 2 ? cut.slice(0, space) : cut).replace(/[\s,.;:–-]+$/, "")}…`;
}

/** "https://github.com/owner/repo(.git)(/tree/…)" → { owner, repo }, else null. */
export function parseGithubRepo(url: string) {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.protocol !== "https:" || !/^(www\.)?github\.com$/i.test(parsed.hostname)) return null;
  const [owner, rawRepo] = parsed.pathname.split("/").filter(Boolean);
  const repo = rawRepo?.replace(/\.git$/i, "");
  const name = /^[A-Za-z0-9_.-]{1,100}$/;
  if (!owner || !repo || !name.test(owner) || !name.test(repo)) return null;
  return { owner, repo };
}

/** A title from a repo name, for repos without a live page: "kasir-warung_v2" → "Kasir Warung V2". */
export function repoTitle(repo: string) {
  const words = repo.split(/[-_.\s]+/).filter(Boolean);
  return words.map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(" ") || null;
}

/**
 * The README's first real paragraph as plain text: headings, badges, images, HTML and code are
 * skipped, Markdown links keep their text.
 */
export function readmeSummary(markdown: string, max = 500) {
  const lines = markdown.replace(/\r\n?/g, "\n").split("\n");
  const paragraph: string[] = [];
  let inFence = false;
  for (const raw of lines) {
    const line = raw.trim();
    if (line.startsWith("```") || line.startsWith("~~~")) {
      inFence = !inFence;
      if (paragraph.length) break;
      continue;
    }
    if (inFence) continue;
    const skip =
      line === "" ||
      line.startsWith("#") ||
      line.startsWith("<") ||
      line.startsWith("!") ||
      line.startsWith("[![") ||
      line.startsWith("|") ||
      line.startsWith(">") ||
      /^[-*_=]{3,}$/.test(line);
    if (skip) {
      if (paragraph.length) break;
      continue;
    }
    paragraph.push(line.replace(/^[-*+]\s+/, ""));
  }
  const text = paragraph
    .join(" ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[*_`~]+/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return text ? clip(text, max) : null;
}

/** Calendar days (in WIB, UTC+7) with at least one commit. */
export function activeDays(dates: string[]) {
  const days = new Set<string>();
  for (const date of dates) {
    const time = Date.parse(date);
    if (Number.isFinite(time)) days.add(new Date(time + 7 * 3_600_000).toISOString().slice(0, 10));
  }
  return days.size;
}

/**
 * Rough build time from commit history: how long the first-to-last commit span was, and on how
 * many days work happened. Null with fewer than 3 commits: a single "initial commit" (an export
 * from an app builder, say) says nothing about how long the build took.
 */
export function estimateEffort(input: {
  commits: number;
  activeDays: number;
  spanHours: number;
}): BuildEffortGuess | null {
  if (input.commits < 3) return null;
  if (input.spanHours <= 5) return "hours";
  if (input.spanHours <= 18 || input.activeDays <= 1) return "overnight";
  if (input.activeDays <= 3) return "weekend";
  if (input.activeDays <= 7) return "week";
  return "longer";
}

const indonesianWords = new Set(
  "yang dan untuk dengan di ini itu buat bikin kamu aku dari ke jadi bisa tanpa atau juga lebih sudah pakai kita".split(
    " ",
  ),
);
const englishWords = new Set(
  "the and for with your you to of is are this that from build make without or also more into our".split(
    " ",
  ),
);

/** "id" or "en" from <html lang> or, failing that, common words; null when unsure. */
export function guessContentLang(lang: string | null, text: string): "id" | "en" | null {
  if (lang?.startsWith("id") || lang?.startsWith("in")) return "id";
  let id = 0;
  let en = 0;
  for (const word of text.toLowerCase().match(/[a-z]+/g) ?? []) {
    if (indonesianWords.has(word)) id++;
    else if (englishWords.has(word)) en++;
  }
  if (id >= 2 && id > en) return "id";
  if (en >= 2 && en > id) return "en";
  if (lang?.startsWith("en")) return "en";
  return null;
}
