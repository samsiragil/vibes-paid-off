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

/** Root files and folders that give a tool away (lowercased). A name ending in "*" is a prefix. */
const ROOT_FILE_TOOLS: Record<string, string> = {
  "claude.md": "claude-code",
  ".claude": "claude-code",
  ".cursor": "cursor",
  ".cursorrules": "cursor",
  ".windsurf": "windsurf",
  ".windsurfrules": "windsurf",
  "gemini.md": "gemini-cli",
  ".gemini": "gemini-cli",
  ".clinerules": "cline",
  ".roo": "roo-code",
  ".roomodes": "roo-code",
  ".kilocode": "kilo-code",
  ".kiro": "kiro",
  ".aider*": "aider",
  ".junie": "jetbrains-junie",
  ".trae": "trae",
  ".bolt": "bolt",
  ".replit": "replit",
  "replit.nix": "replit",
  ".idx": "firebase-studio",
  "vercel.json": "vercel",
  "netlify.toml": "netlify",
  "wrangler.*": "cloudflare",
  "fly.toml": "fly-io",
  "railway.*": "railway",
  "render.yaml": "render",
  procfile: "heroku",
  "firebase.json": "firebase",
  supabase: "supabase",
  prisma: "prisma",
  "drizzle.config.*": "drizzle",
  convex: "convex",
  "tailwind.config.*": "tailwind-css",
  "components.json": "shadcn-ui",
  "next.config.*": "nextjs",
  "astro.config.*": "astro",
  "nuxt.config.*": "nuxt",
  "svelte.config.*": "svelte",
  artisan: "laravel",
  "manage.py": "django",
  "go.mod": "go",
  "tsconfig.json": "typescript",
  "composer.json": "php",
};

/** npm packages; a key ending in "/" matches every package of that scope. */
const NPM_TOOLS: Record<string, string> = {
  next: "nextjs",
  react: "react",
  vue: "vue",
  nuxt: "nuxt",
  svelte: "svelte",
  "@sveltejs/": "svelte",
  astro: "astro",
  "@remix-run/": "remix",
  "@angular/core": "angular",
  "solid-js": "solid",
  tailwindcss: "tailwind-css",
  express: "express",
  hono: "hono",
  "@nestjs/core": "nestjs",
  "react-native": "react-native",
  expo: "expo",
  electron: "electron",
  "@tauri-apps/": "tauri",
  typescript: "typescript",
  "@supabase/supabase-js": "supabase",
  "@supabase/ssr": "supabase",
  firebase: "firebase",
  "firebase-admin": "firebase",
  convex: "convex",
  pocketbase: "pocketbase",
  appwrite: "appwrite",
  "node-appwrite": "appwrite",
  "@neondatabase/serverless": "neon",
  "@planetscale/database": "planetscale",
  "@libsql/client": "turso",
  mongodb: "mongodb",
  mongoose: "mongodb",
  pg: "postgresql",
  postgres: "postgresql",
  mysql: "mysql",
  mysql2: "mysql",
  "better-sqlite3": "sqlite",
  sqlite3: "sqlite",
  redis: "redis",
  ioredis: "redis",
  "@upstash/redis": "redis",
  prisma: "prisma",
  "@prisma/client": "prisma",
  "drizzle-orm": "drizzle",
  stripe: "stripe",
  "@stripe/stripe-js": "stripe",
  "midtrans-client": "midtrans",
  "xendit-node": "xendit",
  "@clerk/": "clerk",
  "@auth0/": "auth0",
  resend: "resend",
  twilio: "twilio",
  openai: "openai-api",
  "@anthropic-ai/sdk": "anthropic-api",
  "@google/genai": "gemini-api",
  "@google/generative-ai": "gemini-api",
  "@openrouter/ai-sdk-provider": "openrouter",
  "@huggingface/inference": "hugging-face",
  "@elevenlabs/elevenlabs-js": "elevenlabs",
  elevenlabs: "elevenlabs",
  replicate: "replicate",
  "@notionhq/client": "notion-api",
  "node-telegram-bot-api": "telegram-bot-api",
  telegraf: "telegram-bot-api",
  grammy: "telegram-bot-api",
  "lovable-tagger": "lovable",
  wrangler: "cloudflare",
  vercel: "vercel",
};

/** Python packages (normalized: lowercase, "_" → "-"). */
const PYTHON_TOOLS: Record<string, string> = {
  django: "django",
  fastapi: "fastapi",
  flask: "flask",
  openai: "openai-api",
  anthropic: "anthropic-api",
  "google-genai": "gemini-api",
  "google-generativeai": "gemini-api",
  supabase: "supabase",
  "firebase-admin": "firebase",
  stripe: "stripe",
  redis: "redis",
  pymongo: "mongodb",
  psycopg: "postgresql",
  psycopg2: "postgresql",
  "psycopg2-binary": "postgresql",
  twilio: "twilio",
  replicate: "replicate",
  elevenlabs: "elevenlabs",
  "huggingface-hub": "hugging-face",
  transformers: "hugging-face",
  "python-telegram-bot": "telegram-bot-api",
  aiogram: "telegram-bot-api",
  midtransclient: "midtrans",
  resend: "resend",
};

/** GitHub language names worth a tool of their own. */
const LANGUAGE_TOOLS: Record<string, string> = {
  TypeScript: "typescript",
  Python: "python",
  Go: "go",
  PHP: "php",
};

export type RepoManifests = {
  packageJson?: string;
  /** requirements.txt and pyproject.toml, joined. */
  python?: string;
  composerJson?: string;
  pubspec?: string;
  gemfile?: string;
};

function lookup(table: Record<string, string>, name: string) {
  if (table[name]) return table[name];
  for (const [key, slug] of Object.entries(table)) {
    if (key.endsWith("*") && name.startsWith(key.slice(0, -1))) return slug;
    if (key.endsWith("/") && name.startsWith(key)) return slug;
  }
  return null;
}

function jsonKeys(text: string | undefined, ...fields: string[]) {
  if (!text) return [];
  try {
    const json = JSON.parse(text) as Record<string, unknown>;
    return fields.flatMap((field) => {
      const value = json[field];
      return value && typeof value === "object" ? Object.keys(value) : [];
    });
  } catch {
    return [];
  }
}

/**
 * Catalog slugs a repo shows it uses, from its root file names (CLAUDE.md, .cursor, vercel.json…),
 * GitHub's language stats and its dependency manifests. Only strong signals: a tool is listed
 * when the repo itself names it.
 */
export function detectStack(input: {
  rootNames: string[];
  languages: string[];
  manifests: RepoManifests;
}): string[] {
  const found = new Set<string>();
  const add = (slug: string | null) => slug && found.add(slug);

  for (const name of input.rootNames) add(lookup(ROOT_FILE_TOOLS, name.toLowerCase()));
  for (const language of input.languages) add(LANGUAGE_TOOLS[language] ?? null);

  const { packageJson, python, composerJson, pubspec, gemfile } = input.manifests;
  for (const name of jsonKeys(packageJson, "dependencies", "devDependencies"))
    add(lookup(NPM_TOOLS, name.toLowerCase()));

  // Requirement lines ("fastapi>=0.110") and pyproject entries ("fastapi>=0.110", or a Poetry
  // key: fastapi = "^0.110") both start with the package name.
  for (const match of (python ?? "").matchAll(/^\s*["']?([A-Za-z0-9_.-]+)/gm))
    add(PYTHON_TOOLS[match[1].toLowerCase().replace(/_/g, "-")] ?? null);
  if (python) add("python");

  const composer = jsonKeys(composerJson, "require", "require-dev");
  if (composer.includes("laravel/framework")) add("laravel");
  if (composer.some((name) => name.startsWith("stripe/"))) add("stripe");

  if (pubspec) {
    if (/^\s+flutter:/m.test(pubspec) || /^\s+sdk:\s*flutter/m.test(pubspec)) add("flutter");
    if (/^\s+supabase_flutter:/m.test(pubspec)) add("supabase");
    if (/^\s+firebase_core:/m.test(pubspec)) add("firebase");
  }
  if (gemfile && /^\s*gem\s+["']rails["']/m.test(gemfile)) add("ruby-on-rails");

  return [...found];
}
